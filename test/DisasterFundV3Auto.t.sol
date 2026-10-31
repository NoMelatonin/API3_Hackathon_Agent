// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {DisasterFundV3Auto as F, OracleTypes} from "../contracts/DisasterFundV3Auto.sol";
import {DemoUSDV3} from "../contracts/DemoUSDV3.sol";

contract DisasterFundV3AutoTest is Test {
    F f;
    DemoUSDV3 t;
    address[3] n;
    address[3] d;
    address[3] e;
    address[3] a;

    function setUp() public {
        vm.chainId(31337);
        vm.warp(1800000000);
        for (uint256 i; i < 3; i++) {
            n[i] = vm.addr(i + 1);
            d[i] = vm.addr(i + 4);
            e[i] = vm.addr(i + 7);
            a[i] = vm.addr(i + 10);
        }
        OracleTypes.Policy[] memory p = new OracleTypes.Policy[](4);
        for (uint8 i; i < 4; i++) {
            p[i] = OracleTypes.Policy(
                keccak256(abi.encode(i)),
                vm.addr(31),
                keccak256(abi.encode("request", i)),
                keccak256("demo"),
                i,
                true,
                true
            );
        }
        t = new DemoUSDV3(address(this));
        f = new F(t, n, d, e, a, p);
        t.approve(address(f), 18000e6);
        f.deposit(18000e6);
    }

    function req(uint256 slot, uint256 severity) internal view returns (F.AutoRequest memory r) {
        string memory value =
            string.concat(vm.toString(severity / 100), ".", severity % 100 < 10 ? "0" : "", vm.toString(severity % 100));
        bytes memory data = bytes(
            string.concat(
                '{"eventId":"demo","severity":',
                value,
                ',"unit":"',
                slot == 0 ? "magnitude" : slot == 1 ? "kts" : "level",
                '","latitude":',
                slot == 0 ? "37" : slot == 1 ? "14" : "-18",
                ',"longitude":',
                slot == 0 ? "37" : slot == 1 ? "122" : "35",
                ',"observedAt":',
                vm.toString(block.timestamp),
                ',"synthetic":true}'
            )
        );
        bytes32 h = keccak256(abi.encodePacked(keccak256(abi.encode("request", uint8(slot))), block.timestamp, data));
        (uint8 v, bytes32 x, bytes32 y) =
            vm.sign(31, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h)));
        r = F.AutoRequest(slot, 500e6, 500e6, 0, block.timestamp, data, abi.encodePacked(x, y, v));
    }

    function claim(uint256 slot, uint256 severity) internal returns (uint256) {
        F.AutoRequest memory r = req(slot, severity);
        uint256 id = f.openApplication(f.keyFor(n[0], keccak256(abi.encode(uint8(slot)))));
        if (id == 0) { bytes32 retryId = bytes32(f.applicationCount()+1); vm.prank(n[0]); id = f.automaticSubmit(r, keccak256("purpose"), retryId); }
        vm.prank(n[0]);
        (bool authorized,) = f.automaticEligibility(r);
        if (authorized) {
            vm.prank(n[0]); uint256 rid = f.automaticReserve(id, r);
            f.claim(rid);
        }
        return id;
    }

    function testFirstAndUnchangedFollowupRequiresTwoPeers() public {
        claim(0, 710);
        assertEq(t.balanceOf(n[0]), 500e6);
        assertEq(f.totalPaid(), 500e6);
        assertTrue(f.usedRoundSnapshot(keccak256(abi.encode(address(f), uint256(0), f.keyFor(n[0], keccak256(abi.encode(uint8(0))))))));
        vm.warp(f.lastRoundAt() + 6 hours);
        uint256 id = claim(0, 710);
        assertEq(f.totalPaid(), 500e6);
        vm.prank(n[1]);
        f.vote(id);
        claim(0, 710);
        assertEq(f.totalPaid(), 500e6);
        vm.prank(n[2]);
        f.vote(id);
        claim(0, 710);
        assertGt(f.totalPaid(), 500e6);
        assertLe(f.totalPaid(), 4050e6);
        assertLe(f.totalReserved(), t.balanceOf(address(f)));
    }

    function testWorseningNeedsNoPeerVote() public {
        claim(0, 710);
        vm.warp(f.lastRoundAt() + 6 hours);
        claim(0, 730);
        assertGt(f.totalPaid(), 500e6);
        vm.warp(f.lastRoundAt() + 6 hours);
        uint256 before_ = f.totalPaid();
        claim(0, 730);
        assertEq(f.totalPaid(), before_);
    }

    function testAcceptedEvidenceAllowsUnchangedFollowup() public {
        claim(0, 710);
        bytes32 m = keccak256("manifest");
        bytes[] memory sigs = new bytes[](2);
        bytes32 digest = f.digest(keccak256("RECEIPT"), keccak256(abi.encode(uint256(1), m, block.timestamp)));
        for (uint256 i; i < 2; i++) {
            (uint8 v, bytes32 x, bytes32 y) = vm.sign(i + 7, digest);
            sigs[i] = abi.encodePacked(x, y, v);
        }
        f.receipt(1, m, block.timestamp, sigs);
        digest = f.digest(keccak256("REVIEW"), keccak256(abi.encode(uint256(1), m, uint8(2), keccak256("checked"))));
        for (uint256 i; i < 2; i++) {
            (uint8 v, bytes32 x, bytes32 y) = vm.sign(i + 7, digest);
            sigs[i] = abi.encodePacked(x, y, v);
        }
        f.review(1, 2, keccak256("checked"), sigs);
        vm.warp(f.lastRoundAt() + 6 hours);
        claim(0, 710);
        assertGt(f.totalPaid(), 500e6);
    }

    function testStaleFutureTamperedWrongRequestAndWeakRejected() public {
        F.AutoRequest memory r = req(0, 710);
        vm.warp(block.timestamp + 301);
        vm.prank(n[0]);
        vm.expectRevert();
        f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(99)));
        r = req(0, 710);
        r.timestamp++;
        vm.prank(n[0]);
        vm.expectRevert();
        f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(99)));
        r = req(0, 710);
        r.data = bytes('{"severity":9}');
        vm.prank(n[0]);
        vm.expectRevert();
        f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(99)));
        r = req(0, 710);
        r.slot = 1;
        vm.prank(n[0]);
        vm.expectRevert();
        f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(99)));
        r = req(0, 690);
        vm.prank(n[0]);
        vm.expectRevert();
        f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(99)));
    }

    function testAllHazardsAndEvidenceBlock() public {
        claim(2, 200);
        assertEq(f.totalPaid(), 500e6);
        vm.warp(block.timestamp + 31 days);
        F.AutoRequest memory r = req(2, 300);
        vm.prank(n[0]);
        vm.expectRevert();
        f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(99)));
    }

    function testRoundDelayAndForeignNGO() public {
        claim(0, 710);
        F.AutoRequest memory r = req(1, 4000);
        vm.prank(n[1]);
        uint256 id = f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(99)));
        vm.prank(n[1]); vm.expectRevert(); f.automaticReserve(id, r);
        vm.warp(f.lastRoundAt() + 6 hours);
        claim(1, 4000);
        vm.warp(f.lastRoundAt() + 6 hours);
        claim(3, 200);
        r = req(0, 730);
        vm.prank(vm.addr(99));
        vm.expectRevert();
        f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(99)));
    }
    function testSeparateStepsAndImmutableRetries() public {
        F.AutoRequest memory r = req(0, 710);
        vm.startPrank(n[0]);
        uint256 id = f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(1)));
        assertEq(f.totalPaid(), 0); assertEq(f.totalReserved(), 0);
        assertEq(f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(1))), id);
        vm.expectRevert(); f.automaticSubmit(r, keccak256("changed"), bytes32(uint256(1)));
        uint256 rid = f.automaticReserve(id, r);
        assertEq(f.automaticReserve(id, r), rid);
        assertEq(f.totalPaid(), 0); assertGt(f.totalReserved(), 0);
        bytes32 key = f.keyFor(n[0], keccak256(abi.encode(uint8(0))));
        assertEq(f.peak(key), 0);
        f.claim(rid); assertEq(f.peak(key), 710); assertEq(t.balanceOf(n[0]), 500e6);
        vm.expectRevert(); f.claim(rid);
        vm.stopPrank();
    }
    function testFreshProofAndOwnershipRequiredAtReservation() public {
        F.AutoRequest memory r = req(0, 710);
        vm.prank(n[0]); uint256 id = f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(1)));
        vm.prank(n[1]); vm.expectRevert(); f.automaticReserve(id, r);
        vm.warp(block.timestamp + 301);
        vm.prank(n[0]); vm.expectRevert(); f.automaticReserve(id, r);
        r = req(0, 690);
        vm.prank(n[0]); vm.expectRevert(); f.automaticReserve(id, r);
        r = req(0, 710); r.requested++;
        vm.prank(n[0]); vm.expectRevert(); f.automaticReserve(id, r);
        assertEq(f.totalPaid(),0);
    }
    function testExpiredReservationNeverRaisesPeak() public {
        F.AutoRequest memory r = req(0, 710);
        vm.prank(n[0]); uint256 id = f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(1)));
        vm.prank(n[0]); uint256 rid = f.automaticReserve(id,r);
        vm.warp(block.timestamp + 24 hours + 1);
        vm.expectRevert(); f.claim(rid);
        f.release(rid);
        assertEq(f.totalPaid(),0);
        assertEq(f.peak(f.keyFor(n[0],keccak256(abi.encode(uint8(0))))),0);
    }

}
