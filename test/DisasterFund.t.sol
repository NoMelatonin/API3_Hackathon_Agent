// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DisasterFund} from "../contracts/DisasterFund.sol";
import {DemoUSD} from "../contracts/DemoUSD.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AirnodeV2Attestation} from "../contracts/vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "../contracts/vendor/ProjectedJson.sol";

contract DisasterFundTest is Test {
    uint256 constant SIGNER_KEY = 0xBEEF;
    bytes32 constant REQUEST = 0x226b958e9cea51240281d38535b7a0661ed95b7a21f978a122bf442ca7b8522c;
    address constant REAL_SIGNER = 0x5aF744115e2577513D878D4263Db73b3E77E7630;
    address[3] ngos = [address(0x101), address(0x102), address(0x103)];
    address[3] committee = [address(0x201), address(0x202), address(0x203)];
    bytes32 constant REASON = keccak256("Oracle unavailable; historical exercise; post-review required");
    string constant GOOD = '{"eventId":"us6000jllz","eventTime":1675646254342,"eventType":"earthquake","latitude":37.2256,"longitude":37.0143,"magnitude":7.8,"status":"reviewed"}';
    DemoUSD token;
    DisasterFund fund;

    function setUp() public {
        vm.warp(1_800_000_000);
        token = new DemoUSD(address(this));
        fund = _fund(vm.addr(SIGNER_KEY));
    }

    function _fund(address signer) internal returns (DisasterFund f) {
        f = new DisasterFund(token, signer, REQUEST, ngos, committee);
        // Fresh fixed-supply asset for additional test funds, if needed.
        if (token.balanceOf(address(this)) < f.TOTAL_BUDGET()) deal(address(token), address(this), f.TOTAL_BUDGET());
        token.approve(address(f), f.TOTAL_BUDGET());
        f.deposit(f.TOTAL_BUDGET());
        f.activate();
    }

    function _sign(bytes32 request, uint256 timestamp, bytes memory data, uint256 key) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(request, timestamp, data))
        )));
        return abi.encodePacked(r, s, v);
    }

    function _claim(address ngo) internal {
        bytes memory data = bytes(GOOD);
        fund.claim(ngo, block.timestamp, data, _sign(REQUEST, block.timestamp, data, SIGNER_KEY));
    }

    function _changed(string memory from, string memory to, bytes4 expectedError) internal {
        bytes memory data = bytes(vm.replace(GOOD, from, to));
        bytes memory sig = _sign(REQUEST, block.timestamp, data, SIGNER_KEY);
        vm.expectPartialRevert(expectedError);
        fund.claim(ngos[0], block.timestamp, data, sig);
        assertEq(token.balanceOf(ngos[0]), 0);
        assertFalse(fund.claimed(ngos[0]));
    }

    function _approve(DisasterFund f, address ngo, bytes32 reason) internal {
        vm.prank(committee[0]); f.approveEmergency(ngo, reason);
        vm.prank(committee[1]); f.approveEmergency(ngo, reason);
    }

    function testValidClaimPaysFixedNgoNotRelayer() public {
        bytes memory data = bytes(GOOD);
        bytes memory sig = _sign(REQUEST, block.timestamp, data, SIGNER_KEY);
        vm.prank(address(0xBAD));
        fund.claim(ngos[0], block.timestamp, data, sig);
        assertEq(token.balanceOf(ngos[0]), fund.GRANT());
        assertEq(token.balanceOf(address(0xBAD)), 0);
        assertEq(fund.totalPaid(), fund.GRANT());
        assertEq(fund.remainingBudget(), 2 * fund.GRANT());
    }

    function testOneAttestationPaysEachNgoOnce() public {
        for (uint256 i; i < 3; ++i) _claim(ngos[i]);
        assertEq(fund.totalPaid(), fund.TOTAL_BUDGET());
        assertEq(token.balanceOf(address(fund)), 0);
        assertEq(fund.remainingBudget(), 0);
        bytes memory sig = _sign(REQUEST, block.timestamp, bytes(GOOD), SIGNER_KEY);
        vm.expectRevert(DisasterFund.AlreadyClaimed.selector);
        fund.claim(ngos[0], block.timestamp, bytes(GOOD), sig);
    }

    function testFreshSignatureDoesNotCreateNewClaim() public {
        _claim(ngos[0]); vm.warp(block.timestamp + 1);
        bytes memory sig = _sign(REQUEST, block.timestamp, bytes(GOOD), SIGNER_KEY);
        vm.expectRevert(DisasterFund.AlreadyClaimed.selector);
        fund.claim(ngos[0], block.timestamp, bytes(GOOD), sig);
    }

    function testIneligibleRecipient() public {
        bytes memory sig = _sign(REQUEST, block.timestamp, bytes(GOOD), SIGNER_KEY);
        vm.expectRevert(DisasterFund.IneligibleRecipient.selector);
        fund.claim(address(0xBAD), block.timestamp, bytes(GOOD), sig);
    }

    function testLowMagnitude() public { _changed("7.8", "6.99", DisasterFund.TriggerNotMet.selector); }
    function testUnreviewed() public { _changed("reviewed", "automatic", DisasterFund.TriggerNotMet.selector); }
    function testWrongEventId() public { _changed("us6000jllz", "other", DisasterFund.WrongEvent.selector); }
    function testWrongEventType() public { _changed("earthquake", "explosion", DisasterFund.WrongEvent.selector); }
    function testObservationBeforeWindow() public { _changed("1675646254342", "1675641599999", DisasterFund.ObservationOutsideWindow.selector); }
    function testObservationAfterWindow() public { _changed("1675646254342", "1675728000000", DisasterFund.ObservationOutsideWindow.selector); }
    function testLatitudeOutsideRegion() public { _changed("37.2256", "35.9", DisasterFund.OutsideRegion.selector); }
    function testLongitudeOutsideRegion() public { _changed("37.0143", "-37.0143", DisasterFund.OutsideRegion.selector); }

    function testNullAndMissingAreNotBelowThreshold() public {
        _changed("7.8", "null", ProjectedJson.UnexpectedValue.selector);
        bytes memory data = bytes(vm.replace(GOOD, '"magnitude":7.8,', ""));
        bytes memory sig = _sign(REQUEST, block.timestamp, data, SIGNER_KEY);
        vm.expectPartialRevert(ProjectedJson.FieldNotFound.selector);
        fund.claim(ngos[0], block.timestamp, data, sig);
    }

    function testFreshnessAtBoundary() public {
        uint256 timestamp = block.timestamp;
        bytes memory sig = _sign(REQUEST, timestamp, bytes(GOOD), SIGNER_KEY);
        vm.warp(timestamp + 300);
        fund.claim(ngos[0], timestamp, bytes(GOOD), sig);
    }

    function testOldResponse() public {
        uint256 timestamp = block.timestamp;
        bytes memory sig = _sign(REQUEST, timestamp, bytes(GOOD), SIGNER_KEY);
        vm.warp(timestamp + 301);
        vm.expectRevert(DisasterFund.ResponseTooOld.selector);
        fund.claim(ngos[0], timestamp, bytes(GOOD), sig);
    }

    function testFutureTimestamp() public {
        uint256 timestamp = block.timestamp + 1;
        bytes memory sig = _sign(REQUEST, timestamp, bytes(GOOD), SIGNER_KEY);
        vm.expectRevert(DisasterFund.FutureResponse.selector);
        fund.claim(ngos[0], timestamp, bytes(GOOD), sig);
    }

    function testResponseBeforeActivation() public {
        uint256 timestamp = block.timestamp - 1;
        bytes memory sig = _sign(REQUEST, timestamp, bytes(GOOD), SIGNER_KEY);
        vm.expectRevert(DisasterFund.ResponseBeforeActivation.selector);
        fund.claim(ngos[0], timestamp, bytes(GOOD), sig);
    }

    function testChangingTimestampCannotRefreshAnOldSignature() public {
        uint256 timestamp = block.timestamp;
        bytes memory sig = _sign(REQUEST, timestamp, bytes(GOOD), SIGNER_KEY);
        vm.warp(timestamp + 301);
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);
        fund.claim(ngos[0], block.timestamp, bytes(GOOD), sig);
        assertFalse(fund.claimed(ngos[0]));
        assertEq(fund.totalPaid(), 0);
    }

    function testMalformedAndMalleableSignaturesCannotPay() public {
        vm.expectRevert(); fund.claim(ngos[0], block.timestamp, bytes(GOOD), hex"01");
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(REQUEST, block.timestamp, bytes(GOOD)))
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, digest);
        uint256 order = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141;
        bytes memory malleated = abi.encodePacked(r, bytes32(order - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        vm.expectRevert(); fund.claim(ngos[0], block.timestamp, bytes(GOOD), malleated);
        assertFalse(fund.claimed(ngos[0]));
        assertEq(fund.totalPaid(), 0);
    }

    function testAllCommitteePairsCanApproveButSingleBitsCannot() public {
        for (uint256 i; i < 3; ++i) {
            vm.prank(committee[i]); fund.approveEmergency(ngos[i], REASON);
            vm.expectRevert(DisasterFund.QuorumNotMet.selector); fund.executeEmergency(ngos[i], REASON);
            vm.prank(committee[(i + 1) % 3]); fund.approveEmergency(ngos[i], REASON);
            fund.executeEmergency(ngos[i], REASON);
        }
        assertEq(fund.totalPaid(), fund.TOTAL_BUDGET());
    }

    function testTokenCallbackCannotReenterAnotherApprovedClaim() public {
        ReentrantToken malicious = new ReentrantToken();
        DisasterFund f = new DisasterFund(malicious, REAL_SIGNER, REQUEST, ngos, committee);
        malicious.mint(address(f), f.TOTAL_BUDGET()); f.activate();
        _approve(f, ngos[0], REASON); _approve(f, ngos[1], REASON);
        malicious.configure(f, ngos[1], REASON);
        f.executeEmergency(ngos[0], REASON);
        assertTrue(malicious.callbackBlocked());
        assertTrue(f.claimed(ngos[0])); assertFalse(f.claimed(ngos[1]));
        assertEq(f.totalPaid(), f.GRANT());
        assertEq(malicious.balanceOf(ngos[0]), f.GRANT());
        assertEq(malicious.balanceOf(ngos[1]), 0);
    }

    function testEmergencyRequiresTwoDistinctApproversSameReasonAndNgo() public {
        vm.prank(committee[0]); fund.approveEmergency(ngos[0], REASON);
        vm.prank(committee[0]); vm.expectRevert(DisasterFund.AlreadyApproved.selector);
        fund.approveEmergency(ngos[0], REASON);
        vm.prank(committee[1]); fund.approveEmergency(ngos[1], REASON);
        vm.prank(committee[1]); fund.approveEmergency(ngos[0], keccak256("different reason"));
        vm.expectRevert(DisasterFund.QuorumNotMet.selector);
        fund.executeEmergency(ngos[0], REASON);
        vm.prank(committee[1]); fund.approveEmergency(ngos[0], REASON);
        fund.executeEmergency(ngos[0], REASON);
        assertEq(token.balanceOf(ngos[0]), fund.GRANT());
    }

    function testOnlyCommitteeAndNonzeroReason() public {
        vm.expectRevert(DisasterFund.NotCommittee.selector);
        fund.approveEmergency(ngos[0], REASON);
        vm.prank(committee[0]); vm.expectRevert(DisasterFund.InvalidReason.selector);
        fund.approveEmergency(ngos[0], bytes32(0));
    }

    function testEmergencyThenOracleCannotPayTwice() public {
        _approve(fund, ngos[0], REASON);
        fund.executeEmergency(ngos[0], REASON);
        bytes memory sig = _sign(REQUEST, block.timestamp, bytes(GOOD), SIGNER_KEY);
        vm.expectRevert(DisasterFund.AlreadyClaimed.selector);
        fund.claim(ngos[0], block.timestamp, bytes(GOOD), sig);
        assertEq(fund.totalPaid(), fund.GRANT());
    }

    function testOracleThenEmergencyCannotPayTwice() public {
        _approve(fund, ngos[0], REASON);
        _claim(ngos[0]);
        vm.expectRevert(DisasterFund.AlreadyClaimed.selector);
        fund.executeEmergency(ngos[0], REASON);
        vm.prank(committee[2]); vm.expectRevert(DisasterFund.AlreadyClaimed.selector);
        fund.approveEmergency(ngos[0], keccak256("new reason"));
    }

    function testEmergencyReplayAndSharedBudget() public {
        for (uint256 i; i < 3; ++i) { _approve(fund, ngos[i], REASON); fund.executeEmergency(ngos[i], REASON); }
        vm.expectRevert(DisasterFund.AlreadyClaimed.selector); fund.executeEmergency(ngos[0], REASON);
        assertEq(fund.totalPaid(), fund.TOTAL_BUDGET());
    }

    function testActivationAndFunding() public {
        DisasterFund f = new DisasterFund(token, REAL_SIGNER, REQUEST, ngos, committee);
        vm.expectRevert(DisasterFund.InsufficientFunds.selector); f.activate();
        vm.prank(committee[0]); vm.expectRevert(DisasterFund.NotActive.selector); f.approveEmergency(ngos[0], REASON);
        vm.expectRevert(DisasterFund.NotActive.selector); f.claim(ngos[0], 0, "", "");
        vm.expectRevert(DisasterFund.AlreadyActive.selector); fund.activate();
        vm.expectRevert(DisasterFund.InsufficientFunds.selector); fund.deposit(0);
    }

    function testInvalidRoleConfigurations() public {
        address[3] memory bad = ngos;
        bad[1] = bad[0];
        vm.expectRevert(DisasterFund.InvalidConfiguration.selector);
        new DisasterFund(token, REAL_SIGNER, REQUEST, bad, committee);
        bad = committee; bad[0] = ngos[0];
        vm.expectRevert(DisasterFund.InvalidConfiguration.selector);
        new DisasterFund(token, REAL_SIGNER, REQUEST, ngos, bad);
        bad = committee; bad[0] = address(0);
        vm.expectRevert(DisasterFund.InvalidConfiguration.selector);
        new DisasterFund(token, REAL_SIGNER, REQUEST, ngos, bad);
    }

    function testTransferFailureRollsBackClaimAndBudget() public {
        // A transfer-failing asset cannot burn an entitlement. ReentrancyGuard is inherited from OpenZeppelin.
        FailingToken bad = new FailingToken();
        DisasterFund f = new DisasterFund(bad, REAL_SIGNER, REQUEST, ngos, committee);
        bad.mint(address(f), f.TOTAL_BUDGET()); f.activate();
        _approve(f, ngos[0], REASON);
        vm.expectRevert(); f.executeEmergency(ngos[0], REASON);
        assertFalse(f.claimed(ngos[0])); assertEq(f.totalPaid(), 0);
    }

    function testFuzzMixedPathsNeverExceedBudget(uint8 paths) public {
        for (uint256 i; i < 3; ++i) {
            if ((paths & uint8(1 << i)) == 0) _claim(ngos[i]);
            else { _approve(fund, ngos[i], REASON); fund.executeEmergency(ngos[i], REASON); }
        }
        assertEq(fund.totalPaid(), fund.TOTAL_BUDGET());
        assertEq(token.balanceOf(address(fund)), 0);
        for (uint256 i; i < 3; ++i) assertEq(token.balanceOf(ngos[i]), fund.GRANT());
    }

    function _fixture(string memory path) internal view returns (uint256 timestamp, bytes memory data, bytes memory signature) {
        string memory json = vm.readFile(path);
        return (vm.parseUint(vm.parseJsonString(json, ".timestamp")), bytes(vm.parseJsonString(json, ".data")),
            vm.parseJsonBytes(json, ".signature"));
    }

    function testRealResponsePaysAndFourOfficialCasesReject() public {
        (uint256 timestamp, bytes memory data, bytes memory sig) = _fixture("fixtures/usgs-real.json");
        vm.warp(timestamp); DisasterFund f = _fund(REAL_SIGNER);
        f.claim(ngos[0], timestamp, data, sig);
        assertEq(token.balanceOf(ngos[0]), f.GRANT());
        bytes memory edited = bytes(vm.replace(string(data), '"magnitude":7.8', '"magnitude":9.8'));
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);
        f.claim(ngos[1], timestamp, edited, sig);
        bytes memory forged = _sign(REQUEST, timestamp, data, SIGNER_KEY);
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);
        f.claim(ngos[1], timestamp, data, forged);
        (uint256 otherTime, bytes memory otherData, bytes memory otherSig) = _fixture("fixtures/usgs-other.json");
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);
        f.claim(ngos[1], otherTime, otherData, otherSig);
        vm.warp(timestamp + 301);
        vm.expectRevert(DisasterFund.ResponseTooOld.selector);
        f.claim(ngos[1], timestamp, data, sig);
        assertEq(token.balanceOf(ngos[1]), 0);
        assertFalse(f.claimed(ngos[1]));
    }
}

contract FailingToken is ERC20 {
    constructor() ERC20("Failing", "FAIL") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function transfer(address, uint256) public pure override returns (bool) { return false; }
}

contract ReentrantToken is ERC20 {
    DisasterFund private target;
    address private recipient;
    bytes32 private reason;
    bool private attempted;
    bool public callbackBlocked;
    constructor() ERC20("Reentrant", "REENTER") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function configure(DisasterFund fund_, address ngo_, bytes32 reason_) external {
        target = fund_; recipient = ngo_; reason = reason_;
    }
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (!attempted) {
            attempted = true;
            try target.executeEmergency(recipient, reason) { callbackBlocked = false; }
            catch { callbackBlocked = true; }
        }
        return super.transfer(to, amount);
    }
}
