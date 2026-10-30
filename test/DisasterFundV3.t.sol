// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {DisasterFundV3 as F} from "../contracts/DisasterFundV3.sol";
import {DemoUSDV2} from "../contracts/DemoUSDV2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DisasterFundV3Test is Test {
    F f;
    DemoUSDV2 t;
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
        t = new DemoUSDV2(address(this));
        f = new F(t, n, d, e, a);
        t.approve(address(f), 18000e6);
        f.deposit(18000e6);
    }

    function signatures(bytes32 hash, uint256 key) internal pure returns (bytes[] memory sigs) {
        sigs = new bytes[](2);
        for (uint256 i; i < 2; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(key + i, hash);
            sigs[i] = abi.encodePacked(r, s, v);
        }
    }

    function assess(uint256 nonce, address ngo) internal view returns (F.Assessment memory) {
        return F.Assessment(
            ngo,
            keccak256("incident"),
            1,
            keccak256("model"),
            keccak256("sources"),
            4500e6,
            block.timestamp + 7 days,
            nonce,
            30
        );
    }

    function open(uint256 nonce, address ngo) internal returns (uint256) {
        F.Assessment memory x = assess(nonce, ngo);
        F.Request memory r = F.Request(4500e6, 4500e6, 0, 0, false);
        bytes32 h = f.digest(keccak256("APPLICATION"), keccak256(abi.encode(f.assessmentHash(x), r)));
        vm.prank(ngo);
        return f.open(x, r, signatures(h, 4));
    }

    function round(uint256 id, uint256 amount, bool uncertain, bool competing) internal {
        F.Grant[] memory grants = new F.Grant[](1);
        grants[0] = F.Grant(id, amount);
        F.Round memory r = F.Round(
            keccak256(abi.encode(id)),
            t.balanceOf(address(f)),
            f.totalReserved(),
            f.roundNonce(),
            block.timestamp + 1 hours,
            uncertain,
            competing,
            0
        );
        f.closeRound(grants, r, signatures(f.digest(keccak256("ROUND"), f.roundPayload(grants, r)), 4));
    }

    function receipt(uint256 id, bytes32 manifest) internal {
        f.receipt(
            id,
            manifest,
            block.timestamp,
            signatures(f.digest(keccak256("RECEIPT"), keccak256(abi.encode(id, manifest, block.timestamp))), 7)
        );
    }

    function review(uint256 id, bytes32 manifest, uint8 status) internal {
        bytes32 reason = keccak256("checked fictitious invoices and delivery");
        f.review(
            id,
            status,
            reason,
            signatures(f.digest(keccak256("REVIEW"), keccak256(abi.encode(id, manifest, status, reason))), 7)
        );
    }

    function attemptRound(uint256 id, uint256 amount, bool uncertain, bool competing) external {
        round(id, amount, uncertain, competing);
    }

    function attemptOpen(uint256 nonce, address ngo) external {
        open(nonce, ngo);
    }

    function attemptReceipt(uint256 id, bytes32 m) external {
        receipt(id, m);
    }

    function testSharedPoolReserveClaimAndReplay() public {
        uint256 id = open(1, n[0]);
        round(id, 4000e6, true, true);
        assertEq(f.totalReserved(), 4000e6);
        f.claim(1);
        assertEq(t.balanceOf(n[0]), 4000e6);
        assertEq(f.totalReserved(), 0);
        assertEq(f.totalPaid(), 4000e6);
        vm.expectRevert();
        f.claim(1);
        assertEq(t.balanceOf(address(f)) + f.totalPaid(), 18000e6);
    }

    function testRestrictedMaximumAndAtomicDuplicate() public {
        uint256 id = open(1, n[0]);
        vm.expectRevert(F.Budget.selector);
        this.attemptRound(id, 4500e6, true, true);
        assertEq(f.totalReserved(), 0);
        round(id, 4050e6, true, true);
    }

    function testWrongDomainDuplicateSignerAndAmountTamper() public {
        F.Assessment memory x = assess(1, n[0]); // DOMAIN remains immutable; signing another chain's domain is rejected
        F.Request memory r = F.Request(4500e6, 4500e6, 0, 0, false);
        bytes32 h = f.digest(keccak256("APPLICATION"), keccak256(abi.encode(f.assessmentHash(x), r)));
        bytes[] memory sigs = signatures(h, 4);
        sigs[1] = sigs[0];
        vm.prank(n[0]);
        vm.expectRevert();
        f.open(x, r, sigs);
        sigs = signatures(h, 4);
        r.requested--;
        vm.prank(n[0]);
        vm.expectRevert();
        f.open(x, r, sigs);
        F other = new F(t, n, d, e, a);
        r.requested++;
        vm.prank(n[0]);
        vm.expectRevert();
        other.open(x, r, sigs);
        vm.chainId(1);
        bytes32 wrong = keccak256(abi.encodePacked("wrong chain", h));
        vm.prank(n[0]);
        vm.expectRevert();
        f.open(x, r, signatures(wrong, 4));
    }

    function testExpiredAssessmentAndWrongRole() public {
        F.Assessment memory x = assess(1, n[0]);
        x.expires = block.timestamp;
        F.Request memory r = F.Request(1e6, 1e6, 0, 0, false);
        vm.prank(n[0]);
        vm.expectRevert();
        f.open(x, r, signatures(bytes32(0), 4));
        x.expires += 1 days;
        bytes[] memory wrong =
            signatures(f.digest(keccak256("APPLICATION"), keccak256(abi.encode(f.assessmentHash(x), r))), 7);
        vm.prank(n[0]);
        vm.expectRevert();
        f.open(x, r, wrong);
    }

    function testStaleRoundSnapshotAndLateClaimRelease() public {
        uint256 id = open(1, n[0]);
        round(id, 1000e6, false, false);
        vm.warp(block.timestamp + 24 hours + 1);
        vm.expectRevert(F.Expired.selector);
        f.claim(1);
        f.release(1);
        assertEq(f.totalReserved(), 0);
        vm.expectRevert();
        f.release(1);
    }

    function testDeadlineCheckedEvenIfWorkerOffline() public {
        uint256 id = open(1, n[0]);
        round(id, 1000e6, false, false);
        f.claim(1);
        vm.warp(block.timestamp + 30 days);
        assertFalse(f.isBlocked(n[0]));
        vm.warp(block.timestamp + 1);
        assertTrue(f.isBlocked(n[0]));
        vm.expectRevert();
        this.attemptOpen(2, n[0]);
    }

    function testTimelyReceiptDoesNotMeanAcceptedAndIndependentAppeal() public {
        uint256 id = open(1, n[0]); // replace due from paid time
        round(id, 1000e6, false, false);
        f.claim(1);
        bytes32 m = keccak256("salted synthetic manifest");
        receipt(1, m);
        vm.warp(block.timestamp + 31 days);
        assertFalse(f.isBlocked(n[0]));
        assertFalse(f.acceptedHistory(n[0]));
        review(1, m, 4);
        assertTrue(f.isBlocked(n[0]));
        vm.prank(n[0]);
        f.appeal(1);
        bytes32 reason = keccak256("independent resolution");
        bytes32 h = f.digest(
            keccak256("RESOLVE"), keccak256(abi.encode(uint256(1), m, uint8(5), block.timestamp - 1 days, reason))
        );
        (,,,, uint256 due,,,,,,) = f.evidence(1);
        h = f.digest(keccak256("RESOLVE"), keccak256(abi.encode(uint256(1), m, uint8(5), due, reason)));
        vm.expectRevert();
        f.resolve(1, reason, signatures(h, 7));
        f.resolve(1, reason, signatures(h, 10));
        assertFalse(f.isBlocked(n[0]));
        assertTrue(f.acceptedHistory(n[0]));
    }

    function testRequestForInformationAndOneTimeExtension() public {
        uint256 id = open(1, n[0]);
        round(id, 1000e6, false, false);
        f.claim(1);
        bytes32 reason = keccak256("access obstruction");
        (,,,, uint256 due,,,,,,) = f.evidence(1);
        bytes32 h = f.digest(keccak256("EXTEND"), keccak256(abi.encode(uint256(1), due, uint256(30), reason)));
        f.extend(1, 30, reason, signatures(h, 7));
        vm.expectRevert();
        f.extend(1, 1, reason, signatures(h, 7));
        bytes32 m = keccak256("m");
        receipt(1, m);
        review(1, m, 3);
        vm.warp(block.timestamp + 14 days + 1);
        assertTrue(f.isBlocked(n[0]));
        vm.expectRevert();
        this.attemptReceipt(1, keccak256("late"));
    }

    function testBothFollowupRoutesAndCumulativeLimit() public {
        uint256 id = open(1, n[0]);
        round(id, 1000e6, false, false);
        f.claim(1);
        uint256 second = open(2, n[0]);
        vm.prank(n[0]);
        vm.expectRevert();
        f.vote(second);
        vm.prank(n[1]);
        f.vote(second);
        vm.prank(n[2]);
        f.vote(second);
        vm.warp(block.timestamp + 6 hours);
        round(second, 1000e6, false, false);
        f.claim(2);
        receipt(1, keccak256("m1"));
        review(1, keccak256("m1"), 2);
        receipt(2, keccak256("m2"));
        review(2, keccak256("m2"), 2);
        uint256 third = open(3, n[0]);
        F.Assessment memory x = assess(3, n[0]);
        f.authorizeFollowup(
            third, signatures(f.digest(keccak256("FOLLOWUP"), keccak256(abi.encode(third, f.assessmentHash(x)))), 7)
        );
        vm.warp(block.timestamp + 6 hours);
        vm.expectRevert();
        this.attemptRound(third, 3000e6, false, false);
        round(third, 2500e6, false, false);
        f.claim(3);
        assertEq(f.totalPaid(), 4500e6);
    }

    function testDepositAfterClosedRoundCannotChangeAllocation() public {
        uint256 id = open(1, n[0]);
        round(id, 1000e6, false, false);
        vm.expectRevert(F.Blocked.selector);
        this.attemptOpen(2, n[0]);
        f.claim(1);
        vm.prank(n[0]);
        t.approve(address(f), 100e6);
        vm.prank(n[0]);
        f.deposit(100e6);
        assertEq(f.totalReserved(), 0);
        assertEq(f.totalPaid(), 1000e6);
        assertEq(t.balanceOf(address(f)), 17100e6);
    }

    function testSameRoundSnapshotAndAssessmentNonceCannotBeReused() public {
        uint256 id = open(1, n[0]);
        round(id, 1000e6, false, false);
        f.claim(1);
        F.Assessment memory x = assess(1, n[0]);
        x.sources = keccak256("changed but reused nonce");
        F.Request memory req = F.Request(1, 1, 0, 0, false);
        bytes[] memory sigs =
            signatures(f.digest(keccak256("APPLICATION"), keccak256(abi.encode(f.assessmentHash(x), req))), 4);
        vm.prank(n[0]);
        vm.expectRevert(F.Replay.selector);
        f.open(x, req, sigs);
        F.Grant[] memory grants = new F.Grant[](0);
        F.Round memory r = F.Round(
            keccak256(abi.encode(id)), t.balanceOf(address(f)), 0, 1, block.timestamp + 1 hours, false, false, 0
        );
        vm.warp(block.timestamp + 6 hours);
        r.validUntil = block.timestamp + 1 hours;
        sigs = signatures(f.digest(keccak256("ROUND"), f.roundPayload(grants, r)), 4);
        vm.expectRevert(F.Invalid.selector);
        f.closeRound(grants, r, sigs);
    }

    function testDuplicateGrantAndProvisionalExhaustionAreAtomic() public {
        uint256 id = open(1, n[0]);
        F.Grant[] memory grants = new F.Grant[](2);
        grants[0] = F.Grant(id, 1000e6);
        grants[1] = grants[0];
        F.Round memory r = F.Round(keccak256("dup"), 18000e6, 0, 0, block.timestamp + 1 hours, true, true, 0);
        bytes[] memory sigs = signatures(f.digest(keccak256("ROUND"), f.roundPayload(grants, r)), 4);
        vm.expectRevert(F.Invalid.selector);
        f.closeRound(grants, r, sigs);
        assertEq(f.totalReserved(), 0);
        assertEq(f.reservationCount(), 0);
        grants = new F.Grant[](0);
        r.provisional = 18000e6;
        sigs = signatures(f.digest(keccak256("ROUND"), f.roundPayload(grants, r)), 4);
        vm.expectRevert(F.Budget.selector);
        f.closeRound(grants, r, sigs);
        r.provisional = 1000e6;
        sigs = signatures(f.digest(keccak256("ROUND"), f.roundPayload(grants, r)), 4);
        f.closeRound(grants, r, sigs);
        assertEq(f.totalReserved(), 1000e6);
        vm.warp(block.timestamp + 24 hours + 1);
        f.releaseHold(r.snapshot);
        assertEq(f.totalReserved(), 0);
    }

    function testTransferFailureRollsBackReservationAndPaidTotals() public {
        uint256 id = open(1, n[0]);
        round(id, 1000e6, false, false);
        vm.mockCall(address(t), abi.encodeWithSelector(t.transfer.selector, n[0], uint256(1000e6)), abi.encode(false));
        vm.expectRevert();
        f.claim(1);
        assertEq(f.totalReserved(), 1000e6);
        assertEq(f.totalPaid(), 0);
        assertEq(t.balanceOf(address(f)), 18000e6);
        vm.clearMockedCalls();
        f.claim(1);
        assertEq(f.totalPaid(), 1000e6);
    }

    function testFuzzConcurrentReservationsNeverExceedBalance(uint256 x, uint256 y, uint256 z) public {
        uint256[3] memory amounts = [bound(x, 1, 4050e6), bound(y, 1, 4050e6), bound(z, 1, 4050e6)];
        for (uint256 i; i < 3; i++) {
            uint256 id = open(i + 1, n[i]);
            if (i > 0) vm.warp(block.timestamp + 6 hours);
            round(id, amounts[i], true, true);
        }
        assertLe(f.totalReserved(), t.balanceOf(address(f)));
        for (uint256 i; i < 3; i++) {
            f.claim(i + 1);
        }
        assertLe(f.totalPaid(), 18000e6);
        assertEq(f.totalReserved(), 0);
    }
}

contract V3Handler is Test {
    F public f;
    DemoUSDV2 public token;
    uint256 public serial;

    constructor(F fund, DemoUSDV2 t) {
        f = fund;
        token = t;
    }

    function allocateAndClaim(uint256 seed) external {
        address ngo = f.ngos(seed % 3);
        uint256 max = 4500e6;
        bytes32 incident = keccak256(abi.encode(++serial));
        F.Assessment memory a = F.Assessment(
            ngo, incident, 1, keccak256("model"), keccak256("sources"), max, block.timestamp + 1 days, serial, 30
        );
        F.Request memory req = F.Request(max, max, 0, 0, false);
        bytes32 h = f.digest(keccak256("APPLICATION"), keccak256(abi.encode(f.assessmentHash(a), req)));
        bytes[] memory sigs = _sign(h);
        vm.prank(ngo);
        try f.open(a, req, sigs) returns (uint256 id) {
            F.Grant[] memory grants = new F.Grant[](1);
            grants[0] = F.Grant(id, bound(seed, 1, 4050e6));
            uint256 balance = token.balanceOf(address(f));
            F.Round memory r = F.Round(
                keccak256(abi.encode(serial)),
                balance,
                f.totalReserved(),
                f.roundNonce(),
                block.timestamp + 1 hours,
                true,
                true,
                0
            );
            vm.warp(block.timestamp + 6 hours);
            r.validUntil = block.timestamp + 1 hours;
            try f.closeRound(grants, r, _sign(f.digest(keccak256("ROUND"), f.roundPayload(grants, r)))) {
                try f.claim(f.reservationCount()) {} catch {}
            } catch {}
        } catch {}
    }

    function release(uint256 seed) external {
        vm.warp(block.timestamp + 1 days);
        uint256 count = f.reservationCount();
        if (count > 0) try f.release(seed % count + 1) {} catch {}
    }

    function _sign(bytes32 h) private pure returns (bytes[] memory sigs) {
        sigs = new bytes[](2);
        for (uint256 i; i < 2; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(i + 4, h);
            sigs[i] = abi.encodePacked(r, s, v);
        }
    }
}

contract DisasterFundV3Invariant is StdInvariant, Test {
    F f;
    DemoUSDV2 t;

    function setUp() public {
        vm.chainId(31337);
        vm.warp(1800000000);
        address[3] memory n;
        address[3] memory d;
        address[3] memory e;
        address[3] memory a;
        for (uint256 i; i < 3; i++) {
            n[i] = vm.addr(i + 1);
            d[i] = vm.addr(i + 4);
            e[i] = vm.addr(i + 7);
            a[i] = vm.addr(i + 10);
        }
        t = new DemoUSDV2(address(this));
        f = new F(t, n, d, e, a);
        t.approve(address(f), 18000e6);
        f.deposit(18000e6);
        V3Handler h = new V3Handler(f, t);
        targetContract(address(h));
    }

    function invariant_ReservationsCoveredAndPaymentsConserved() public view {
        assertLe(f.totalReserved(), t.balanceOf(address(f)));
        assertEq(f.totalPaid() + t.balanceOf(address(f)), 18000e6);
    }
}
