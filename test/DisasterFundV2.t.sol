// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DisasterFundV2 as Fund} from "../contracts/DisasterFundV2.sol";
import {DemoUSDV2} from "../contracts/DemoUSDV2.sol";
import {PayoutMath} from "../contracts/PayoutMath.sol";
import {StrictJson} from "../contracts/StrictJson.sol";
import {ProjectedJson} from "../contracts/vendor/ProjectedJson.sol";
import {AirnodeV2Attestation} from "../contracts/vendor/AirnodeV2Attestation.sol";

contract DisasterFundV2Test is Test {
    uint256 constant KEY = 0xBEEF;
    bytes32 constant REQUEST = keccak256("synthetic test request; not AirnodeHub evidence");
    address[3] ngos = [address(0x101), address(0x102), address(0x103)];
    address[3] committee = [address(0x201), address(0x202), address(0x203)];
    DemoUSDV2 token;
    Fund fund;
    string constant QUAKE = '{"eventId":"us6000jllz","eventTime":1675646254342,"eventType":"earthquake","latitude":37.2256,"longitude":37.0143,"magnitude":7.8,"status":"reviewed"}';
    string constant WIND = '{"category":"severeStorms","eventId":"EONET_22386","geometryType":"Point","latitude":27.1,"longitude":160.7,"observedAt":"2026-08-10T06:00:00Z","source":"JTWC","unit":"kts","windSpeed":35.00}';
    string constant HEALTH = '{"count":1,"recordId":123,"indicator":"MALARIA_EST_INCIDENCE","spatialType":"COUNTRY","country":"NGA","year":2022,"dim1":null,"dim2":null,"dim3":null,"incidence":200,"low":150,"high":500}';

    function configs(address signer) internal pure returns (Fund.Campaign[3] memory c) {
        c[0] = Fund.Campaign(signer, REQUEST, 7e6, 8e6, 500e6, 2000e6, true);
        c[1] = Fund.Campaign(signer, REQUEST, 34e6, 64e6, 500e6, 2000e6, true);
        c[2] = Fund.Campaign(signer, REQUEST, 100e6, 300e6, 500e6, 2000e6, true);
    }
    function setUp() public {
        vm.warp(1_800_000_000);
        token = new DemoUSDV2(address(this));
        fund = new Fund(token, configs(vm.addr(KEY)), ngos, committee);
        token.transfer(address(fund), fund.TOTAL_BUDGET()); fund.activate();
    }
    function sign(uint256 timestamp, bytes memory data, bytes32 request, uint256 key) internal pure returns(bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(request, timestamp, data)))));
        return abi.encodePacked(r,s,v);
    }
    function claim(uint8 id, uint256 ngo, string memory json) internal {
        bytes memory data = bytes(json);
        fund.claim(id, ngos[ngo], block.timestamp, data, sign(block.timestamp, data, REQUEST, KEY));
    }
    function reject(uint8 id, string memory json, bytes4 error_) internal {
        bytes memory data = bytes(json);
        bytes memory sig = sign(block.timestamp, data, REQUEST, KEY);
        bool before_ = fund.claimed(id, ngos[0]);
        vm.expectPartialRevert(error_);
        fund.claim(id, ngos[0], block.timestamp, data, sig);
        assertEq(fund.claimed(id, ngos[0]), before_);
    }
    function emergency(uint8 id, uint256 ngo) internal {
        for(uint256 i; i<2; ++i) { vm.prank(committee[i]); fund.approveEmergency(id, ngos[ngo], bytes32(uint256(1))); }
        fund.executeEmergency(id, ngos[ngo], bytes32(uint256(1)));
    }
    function testAllCurvesBoundaryAndIntermediate() public pure {
        uint256[3] memory t = [uint256(7e6),34e6,100e6];
        uint256[3] memory c = [uint256(8e6),64e6,300e6];
        for(uint8 i; i<3; ++i) {
            assertEq(PayoutMath.payout(i,t[i]-1,t[i],c[i],500e6,2000e6),0);
            assertEq(PayoutMath.payout(i,t[i],t[i],c[i],500e6,2000e6),500e6);
            assertGt(PayoutMath.payout(i,t[i]+1,t[i],c[i],500e6,2000e6),500e6);
            assertLt(PayoutMath.payout(i,c[i]-1,t[i],c[i],500e6,2000e6),2000e6);
            assertEq(PayoutMath.payout(i,c[i],t[i],c[i],500e6,2000e6),2000e6);
            assertEq(PayoutMath.payout(i,type(uint256).max,t[i],c[i],500e6,2000e6),2000e6);
        }
        assertEq(PayoutMath.payout(1,35e6,34e6,64e6,500e6,2000e6),535204081);
        assertEq(PayoutMath.payout(2,200e6,100e6,300e6,500e6,2000e6),1250e6);
    }
    function testHighPrecisionIndependentDecimalReference() public view {
        string memory reference_ = vm.readFile("test/fixtures/payout-reference.json");
        uint256[] memory xs = vm.parseJsonUintArray(reference_, ".x");
        uint256[] memory ys = vm.parseJsonUintArray(reference_, ".y");
        for(uint256 i; i<xs.length; ++i) {
            assertApproxEqAbs(PayoutMath.payout(0,xs[i],7e6,8e6,500e6,2000e6),ys[i],1);
        }
    }
    function testFuzzMonotonicAndCapped(uint8 curve_, uint256 a_, uint256 b_) public pure {
        uint8 curve = uint8(bound(curve_,0,2));
        uint256 t = curve == 0 ? 7e6 : curve == 1 ? 34e6 : 100e6;
        uint256 c = curve == 0 ? 8e6 : curve == 1 ? 64e6 : 300e6;
        uint256 a = bound(a_,0,c*2); uint256 b = bound(b_,a,c*2);
        uint256 p = PayoutMath.payout(curve,a,t,c,500e6,2000e6);
        assertLe(p,PayoutMath.payout(curve,b,t,c,500e6,2000e6)); assertLe(p,2000e6);
    }
    function testCampaignsPayDifferentAmountsAndSharePool() public {
        claim(0,0,QUAKE); claim(1,0,WIND); claim(2,0,HEALTH);
        assertEq(fund.payoutCount(),3);
        assertEq(fund.campaignPaid(1),535204081);
        assertEq(fund.campaignPaid(2),1250e6);
        assertEq(fund.totalPaid(),token.balanceOf(ngos[0]));
    }
    function testReplayAndEscalationNeverPayTwice() public {
        claim(0,0,QUAKE);
        reject(0,vm.replace(QUAKE,"7.8","8.5"),Fund.AlreadyClaimed.selector);
        vm.prank(committee[0]); vm.expectRevert(Fund.AlreadyClaimed.selector);
        fund.approveEmergency(0,ngos[0],bytes32(uint256(1)));
        emergency(1,0);
        reject(1,WIND,Fund.AlreadyClaimed.selector);
    }
    function testFuzzMixedPathsBudget(uint16 paths) public {
        for(uint8 id;id<3;++id) for(uint256 n;n<3;++n) {
            if((paths & (1 << (id*3+n))) != 0) emergency(id,n);
            else claim(id,n,id==0 ? vm.replace(QUAKE,"7.8","9") : id==1 ? vm.replace(WIND,"35.00","100") : vm.replace(HEALTH,"\"incidence\":200","\"incidence\":300"));
            assertLe(fund.campaignPaid(id),6000e6); assertLe(fund.totalPaid(),18000e6);
        }
        assertEq(fund.payoutCount(),9);
    }
    function testMalformedMissingDuplicateAndPrecision() public {
        reject(0,vm.replace(QUAKE,"7.8","null"),ProjectedJson.UnexpectedValue.selector);
        reject(0,vm.replace(QUAKE,'"magnitude":7.8,',""),ProjectedJson.FieldNotFound.selector);
        reject(0,vm.replace(QUAKE,'"magnitude":7.8','"magnitude":7.8,"magnitude":9'),StrictJson.AmbiguousData.selector);
        reject(0,vm.replace(QUAKE,"7.8","6.9999999"),StrictJson.AmbiguousData.selector);
        reject(0,vm.replace(QUAKE,"7.8","-1"),ProjectedJson.UnexpectedValue.selector);
        reject(0,vm.replace(QUAKE,"7.8","6.999999"),Fund.TriggerNotMet.selector);
    }
    function testWrongSourceUnitDateAndRegion() public {
        reject(1,vm.replace(WIND,"kts","mph"),Fund.WrongEvent.selector);
        reject(1,vm.replace(WIND,"severeStorms","wildfires"),Fund.WrongEvent.selector);
        reject(1,vm.replace(WIND,"06:00:00","12:00:00"),Fund.ObservationOutsideWindow.selector);
        reject(1,vm.replace(WIND,"160.7","150.7"),Fund.OutsideRegion.selector);
        reject(0,vm.replace(QUAKE,"reviewed","automatic"),Fund.TriggerNotMet.selector);
    }
    function testHealthWrongDimensionsCountPeriodAndInterval() public {
        reject(2,vm.replace(HEALTH,'"count":1','"count":2'),Fund.WrongEvent.selector);
        reject(2,vm.replace(HEALTH,'"count":1','"count":0'),Fund.WrongEvent.selector);
        reject(2,vm.replace(HEALTH,"2022","2023"),Fund.WrongEvent.selector);
        reject(2,vm.replace(HEALTH,"NGA","DEU"),Fund.WrongEvent.selector);
        reject(2,vm.replace(HEALTH,'"dim1":null','"dim1":"SEX_MLE"'),Fund.WrongEvent.selector);
        reject(2,vm.replace(HEALTH,'"low":150','"low":201'),Fund.WrongEvent.selector);
    }
    function testTamperWrongRequestSignerAndFreshness() public {
        bytes memory data = bytes(QUAKE);
        bytes memory sig = sign(block.timestamp,data,REQUEST,KEY);
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);
        fund.claim(0,ngos[0],block.timestamp,bytes(vm.replace(QUAKE,"7.8","8.0")),sig);
        sig = sign(block.timestamp,data,keccak256("other request"),KEY);
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector); fund.claim(0,ngos[0],block.timestamp,data,sig);
        sig = sign(block.timestamp,data,REQUEST,0xBAD);
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector); fund.claim(0,ngos[0],block.timestamp,data,sig);
        uint256 time = block.timestamp;
        sig = sign(time,data,REQUEST,KEY);
        vm.warp(time+299); assertGt(fund.quote(0,time,data,sig),0);
        vm.warp(time+300); assertGt(fund.quote(0,time,data,sig),0);
        vm.warp(time+301); vm.expectRevert(Fund.ResponseTooOld.selector); fund.quote(0,time,data,sig);
    }
    function testFutureAndPreActivation() public {
        bytes memory data = bytes(QUAKE);
        bytes memory sig = sign(block.timestamp+1,data,REQUEST,KEY);
        vm.expectRevert(Fund.FutureResponse.selector); fund.quote(0,block.timestamp+1,data,sig);
        sig = sign(block.timestamp-1,data,REQUEST,KEY);
        vm.expectRevert(Fund.ResponseBeforeActivation.selector); fund.quote(0,block.timestamp-1,data,sig);
    }
    function testDefaultDisabledHealthRejectsEvenValidTestSignature() public {
        Fund.Campaign[3] memory c = configs(vm.addr(KEY)); c[2].oracleEnabled=false;
        Fund f = new Fund(token,c,ngos,committee); deal(address(token),address(f),18000e6); f.activate();
        bytes memory sig = sign(block.timestamp,bytes(HEALTH),REQUEST,KEY);
        vm.expectRevert(Fund.OracleDisabled.selector); f.claim(2,ngos[0],block.timestamp,bytes(HEALTH),sig);
    }
    function testUnderfundedAndInvalidConfiguration() public {
        Fund.Campaign[3] memory c = configs(vm.addr(KEY));
        Fund f = new Fund(token,c,ngos,committee); deal(address(token),address(f),18000e6-1);
        vm.expectRevert(Fund.InsufficientFunds.selector); f.activate();
        c[0].cap=c[0].threshold;
        vm.expectRevert(Fund.InvalidConfiguration.selector); new Fund(token,c,ngos,committee);
    }
    function testRealEonetResponseAcceptedAndTamperRejected() public {
        string memory json = vm.readFile("fixtures/v2/eonet-real.json");
        uint256 timestamp = vm.parseUint(vm.parseJsonString(json,".timestamp"));
        bytes memory data = bytes(vm.parseJsonString(json,".data"));
        bytes memory sig = vm.parseJsonBytes(json,".signature");
        Fund.Campaign[3] memory c = configs(vm.addr(KEY));
        c[1].airnode=0x84A69892825178Fb1602fb78412E21728efee6a6;
        c[1].requestHash=0x45400127cada55f95cd33e3e600b8c6f89c12961e6b66ed5a8cef01bc903a6ea;
        vm.warp(timestamp);
        Fund f = new Fund(token,c,ngos,committee); deal(address(token),address(f),18000e6); f.activate();
        assertEq(f.quote(1,timestamp,data,sig),535204081);
        f.claim(1,ngos[0],timestamp,data,sig);
        assertEq(f.campaignPaid(1),535204081);
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);
        f.claim(1,ngos[1],timestamp,bytes(vm.replace(string(data),"35.00","64.00")),sig);
    }
}
