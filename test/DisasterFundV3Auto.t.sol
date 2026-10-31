// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {DisasterFundV3Auto as F, OracleTypes} from "../contracts/DisasterFundV3Auto.sol";
import {DisasterFundV3 as B} from "../contracts/DisasterFundV3.sol";
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
                true,
                0,
                0
            );
        }
        t = new DemoUSDV3(address(this));
        f = new F(t, n, d, e, a, p, 18000e6);
        t.approve(address(f), 18000e6);
        f.deposit(18000e6);
        f.activate();
    }

    function req(uint256 slot, uint256 severity) internal view returns (F.AutoRequest memory r) {
        string memory value = string.concat(
            vm.toString(severity / 100), ".", severity % 100 < 10 ? "0" : "", vm.toString(severity % 100)
        );
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
        if (id == 0) {
            bytes32 retryId = bytes32(f.applicationCount() + 1);
            vm.prank(n[0]);
            id = f.automaticSubmit(r, keccak256("purpose"), retryId);
        }
        vm.prank(n[0]);
        (bool authorized,) = f.automaticEligibility(r);
        if (authorized) {
            vm.prank(n[0]);
            uint256 rid = f.automaticReserve(id, r);
            f.claim(rid);
        }
        return id;
    }

    function testFirstAndUnchangedFollowupRequiresTwoPeers() public {
        claim(0, 710);
        assertEq(t.balanceOf(n[0]), 500e6);
        assertEq(f.totalPaid(), 500e6);
        assertGt(f.roundHolds(f.packageSnapshot()), 0);
        vm.warp(f.packageExpires() + 1);
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
        vm.warp(f.packageExpires() + 1);
        claim(0, 730);
        assertGt(f.totalPaid(), 500e6);
        vm.warp(f.packageExpires() + 1);
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
        vm.warp(f.packageExpires() + 1);
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
        vm.prank(n[1]);
        uint256 rid = f.automaticReserve(id, r);
        assertEq(f.reservationCount(), 2);
        assertGt(rid, 0);
        vm.warp(f.packageExpires() + 1);
        claim(1, 4000);
        vm.warp(f.packageExpires() + 1);
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
        assertEq(f.totalPaid(), 0);
        assertEq(f.totalReserved(), 0);
        assertEq(f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(1))), id);
        vm.expectRevert();
        f.automaticSubmit(r, keccak256("changed"), bytes32(uint256(1)));
        uint256 rid = f.automaticReserve(id, r);
        assertEq(f.automaticReserve(id, r), rid);
        assertEq(f.totalPaid(), 0);
        assertGt(f.totalReserved(), 0);
        bytes32 key = f.keyFor(n[0], keccak256(abi.encode(uint8(0))));
        assertEq(f.peak(key), 0);
        f.claim(rid);
        assertEq(f.peak(key), 710);
        assertEq(t.balanceOf(n[0]), 500e6);
        vm.expectRevert();
        f.claim(rid);
        vm.stopPrank();
    }

    function testFreshProofAndOwnershipRequiredAtReservation() public {
        F.AutoRequest memory r = req(0, 710);
        vm.prank(n[0]);
        uint256 id = f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(1)));
        vm.prank(n[1]);
        vm.expectRevert();
        f.automaticReserve(id, r);
        vm.warp(block.timestamp + 301);
        vm.prank(n[0]);
        vm.expectRevert();
        f.automaticReserve(id, r);
        r = req(0, 690);
        vm.prank(n[0]);
        vm.expectRevert();
        f.automaticReserve(id, r);
        r = req(0, 710);
        r.requested++;
        vm.prank(n[0]);
        vm.expectRevert();
        f.automaticReserve(id, r);
        assertEq(f.totalPaid(), 0);
    }

    function testExpiredReservationNeverRaisesPeak() public {
        F.AutoRequest memory r = req(0, 710);
        vm.prank(n[0]);
        uint256 id = f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(1)));
        vm.prank(n[0]);
        uint256 rid = f.automaticReserve(id, r);
        vm.warp(block.timestamp + 24 hours + 1);
        vm.expectRevert();
        f.claim(rid);
        f.release(rid);
        assertEq(f.totalPaid(), 0);
        assertEq(f.peak(f.keyFor(n[0], keccak256(abi.encode(uint8(0))))), 0);
    }

    function sigsFor(bytes32 digest, uint256 first) internal view returns (bytes[] memory sigs) {
        sigs = new bytes[](2);
        for (uint256 i; i < 2; i++) {
            (uint8 v, bytes32 x, bytes32 y) = vm.sign(first + i, digest);
            sigs[i] = abi.encodePacked(x, y, v);
        }
    }

    function externalOpen(uint256 ngo, uint8 slot, uint256 requested, uint256 externalFunding)
        internal
        returns (uint256 id)
    {
        B.Assessment memory assessment = B.Assessment(
            n[ngo],
            keccak256(abi.encode(slot)),
            1,
            keccak256("fixed-equal-package-policy-v1"),
            keccak256("external evidence and private purpose commitment"),
            4500e6,
            block.timestamp + 7 days,
            f.applicationCount() + 1,
            slot == 3 ? 45 : 30
        );
        B.Request memory r = B.Request(requested, requested, externalFunding, 0, true);
        bytes[] memory sigs =
            sigsFor(f.digest(keccak256("APPLICATION"), keccak256(abi.encode(f.assessmentHash(assessment), r))), 4);
        vm.prank(n[ngo]);
        id = f.open(assessment, r, sigs);
    }

    function externalReserve(uint256 id) internal returns (uint256 rid) {
        (uint256[] memory amounts,, bool uncertain, bool competing) = f.sharedQuote();
        (,, address ngo,,,,,,,,,) = f.applications(id);
        B.Assessment memory assessment;
        (
            assessment.ngo,
            assessment.incident,
            assessment.areaVersion,
            assessment.modelVersion,
            assessment.sources,
            assessment.maximum,
            assessment.expires,
            assessment.nonce,
            assessment.deadlineDays
        ) = f.assessments(id);
        uint256 index;
        for (uint8 slot; slot < 4; slot++) {
            if (assessment.incident == keccak256(abi.encode(slot))) {
                for (uint256 j; j < 3; j++) {
                    if (n[j] == ngo) index = uint256(slot) * 3 + j;
                }
            }
        }
        uint256 provisional;
        for (uint256 j; j < 12; j++) {
            if (j != index) provisional += amounts[j];
        }
        B.Grant[] memory grants = new B.Grant[](1);
        grants[0] = B.Grant(id, amounts[index]);
        B.Round memory r = B.Round(
            keccak256(abi.encode(id, f.roundNonce(), block.timestamp)),
            t.balanceOf(address(f)),
            f.effectiveReserved(),
            f.roundNonce(),
            block.timestamp + 1 hours,
            uncertain,
            competing,
            provisional
        );
        bytes[] memory sigs = sigsFor(f.digest(keccak256("ROUND"), f.roundPayload(grants, r)), 4);
        f.closeRound(grants, r, sigs);
        rid = f.automaticReservation(id);
    }

    function testSharedExternalAndOracleConsumeOneRoundWithoutExtraBudget() public {
        claim(0, 710);
        uint256 beforeReserved = f.totalReserved();
        uint256 beforeNonce = f.roundNonce();
        uint256 id = externalOpen(1, 0, 500e6, 100e6);
        uint256 rid = externalReserve(id);
        assertEq(f.totalReserved(), beforeReserved);
        assertEq(f.roundNonce(), beforeNonce);
        assertEq(t.balanceOf(n[1]), 0);
        f.claim(rid);
        assertEq(t.balanceOf(n[1]), 500e6);
        assertEq(f.totalPaid(), 1000e6);
        assertEq(f.totalReserved(), beforeReserved - 500e6);
        vm.expectRevert();
        f.claim(rid);
        vm.warp(f.packageExpires() + 1);
        f.releaseAutomaticHolds();
        assertEq(f.totalReserved(), 0);
    }

    function testExternalFundingAndCapApplyAcrossApprovalPaths() public {
        uint256 id = externalOpen(0, 0, 500e6, 3500e6);
        f.claim(externalReserve(id));
        assertEq(f.externalFor(f.keyFor(n[0], keccak256(abi.encode(uint8(0))))), 3500e6);
        vm.warp(f.packageExpires() + 1);
        F.AutoRequest memory r = req(0, 730);
        r.externalFunding = 3500e6;
        vm.prank(n[0]);
        id = f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(991)));
        vm.prank(n[1]);
        f.vote(id);
        vm.prank(n[2]);
        f.vote(id);
        vm.prank(n[0]);
        uint256 rid = f.automaticReserve(id, r);
        f.claim(rid);
        assertEq(f.totalPaid(), 550e6);
        assertEq(f.paidFor(f.keyFor(n[0], keccak256(abi.encode(uint8(0))))) + 3500e6, 4050e6);
    }

    function testCoverageRequiresTwoDataSignersAndExpires() public {
        bytes32 proof = keccak256("documented coverage");
        uint256 expires = block.timestamp + 1 hours;
        bytes32 digest = f.digest(keccak256("COVERAGE"), keccak256(abi.encode(uint8(15), proof, expires)));
        vm.expectRevert();
        f.attestCoverage(15, proof, expires, sigsFor(digest, 7));
        assertTrue(f.fundingUncertain());
        f.attestCoverage(15, proof, expires, sigsFor(digest, 4));
        assertFalse(f.fundingUncertain());
        (uint256[] memory amounts,,,) = f.sharedQuote();
        uint256 sum;
        for (uint256 i; i < 12; i++) {
            sum += amounts[i];
        }
        assertEq(sum, 18000e6);
        vm.warp(expires + 1);
        assertTrue(f.fundingUncertain());
    }

    function testExternalRoundCannotChooseAmountsOrSkipProvisionalPackages() public {
        uint256 id = externalOpen(0, 0, 500e6, 0);
        (uint256[] memory amounts,, bool uncertain, bool competing) = f.sharedQuote();
        B.Grant[] memory grants = new B.Grant[](1);
        grants[0] = B.Grant(id, amounts[0] + 1);
        B.Round memory r = B.Round(
            keccak256("wrong amounts"),
            t.balanceOf(address(f)),
            0,
            0,
            block.timestamp + 1 hours,
            uncertain,
            competing,
            0
        );
        bytes[] memory sigs = sigsFor(f.digest(keccak256("ROUND"), f.roundPayload(grants, r)), 4);
        vm.expectRevert();
        f.closeRound(grants, r, sigs);
        assertEq(f.totalReserved(), 0);
    }

    function testPreActivationAndSyntheticPublicNetworkRefused() public {
        F.AutoRequest memory r = req(0, 710);
        r.timestamp = f.activatedAt() - 1;
        vm.prank(n[0]);
        vm.expectRevert(F.OracleBeforeActivation.selector);
        f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(2)));
        OracleTypes.Policy[] memory p = new OracleTypes.Policy[](4);
        for (uint8 i; i < 4; i++) {
            p[i] = OracleTypes.Policy(
                keccak256(abi.encode(i)),
                vm.addr(31),
                keccak256(abi.encode("request", i)),
                keccak256("demo"),
                i,
                true,
                true,
                0,
                0
            );
        }
        vm.chainId(84532);
        vm.expectRevert();
        new F(t, n, d, e, a, p, 18000e6);
        vm.chainId(31337);
        F unfunded = new F(t, n, d, e, a, p, 18000e6);
        vm.expectRevert();
        unfunded.activate();
    }

    function testFuzzMixedApprovalPathsConserveFunds(uint96 seed_) public {
        for (uint256 step; step < 6; step++) {
            if (step > 0) vm.warp(f.packageExpires() + 1);
            uint256 random = uint256(keccak256(abi.encode(seed_, step)));
            uint256 ngo = random % 3;
            uint8 slot = uint8((random / 3) % 4);
            uint256 amount = (random / 12) % 4500e6 + 1;
            uint256 id;
            F.AutoRequest memory r;
            if (step % 2 == 0) {
                r = req(slot, slot == 0 ? 710 : slot == 1 ? 4000 : 200);
                r.requested = amount;
                r.capacity = amount;
                vm.prank(n[ngo]);
                id = f.automaticSubmit(r, keccak256("purpose"), bytes32(step + 1));
            } else {
                id = externalOpen(ngo, slot, amount, 0);
            }
            (,,,,,,,,, bool followup,,) = f.applications(id);
            if (followup) for (uint256 j; j < 3; j++) {
                if (j != ngo) {
                    vm.prank(n[j]);
                    f.vote(id);
                }
            }
            vm.prank(n[ngo]);
            (uint256 quote,,) = f.automaticQuote(slot, amount, amount, 0);
            if (quote > 0) {
                uint256 rid;
                if (step % 2 == 0) {
                    vm.prank(n[ngo]);
                    rid = f.automaticReserve(id, r);
                } else {
                    rid = externalReserve(id);
                }
                f.claim(rid);
            }
            assertLe(f.totalReserved(), t.balanceOf(address(f)));
            assertEq(f.totalPaid(), t.balanceOf(n[0]) + t.balanceOf(n[1]) + t.balanceOf(n[2]));
            assertEq(f.totalPaid() + t.balanceOf(address(f)), 18000e6);
            for (uint256 j; j < 3; j++) {
                for (uint8 k; k < 4; k++) {
                    assertLe(
                        f.paidFor(f.keyFor(n[j], keccak256(abi.encode(k))))
                            + f.reservedFor(f.keyFor(n[j], keccak256(abi.encode(k))))
                            + f.externalFor(f.keyFor(n[j], keccak256(abi.encode(k)))),
                        4050e6
                    );
                }
            }
        }
    }

    function testOriginalRealSourcesUsePinnedHistoricalWindowsWithoutEditingBytes() public {
        string memory usgs = vm.readFile("fixtures/usgs-testnet.json");
        string memory eonet = vm.readFile("fixtures/v2/eonet-real.json");
        uint256 usgsTime = vm.parseUint(vm.parseJsonString(usgs, ".timestamp"));
        uint256 eonetTime = vm.parseUint(vm.parseJsonString(eonet, ".timestamp"));
        vm.warp(usgsTime);
        OracleTypes.Policy[] memory p = new OracleTypes.Policy[](4);
        p[0] = OracleTypes.Policy(
            keccak256(abi.encode(uint8(0))),
            0x5aF744115e2577513D878D4263Db73b3E77E7630,
            0x226b958e9cea51240281d38535b7a0661ed95b7a21f978a122bf442ca7b8522c,
            keccak256("us6000jllz"),
            0,
            false,
            true,
            1675641600,
            1675727999
        );
        p[1] = OracleTypes.Policy(
            keccak256(abi.encode(uint8(1))),
            0x84A69892825178Fb1602fb78412E21728efee6a6,
            0x45400127cada55f95cd33e3e600b8c6f89c12961e6b66ed5a8cef01bc903a6ea,
            keccak256("EONET_22386"),
            1,
            false,
            true,
            1786320000,
            1786406399
        );
        for (uint8 i = 2; i < 4; i++) {
            p[i] = OracleTypes.Policy(
                keccak256(abi.encode(i)),
                vm.addr(31),
                keccak256(abi.encode("request", i)),
                keccak256("demo"),
                i,
                true,
                true,
                0,
                0
            );
        }
        f = new F(t, n, d, e, a, p, 18000e6);
        t.approve(address(f), 18000e6);
        f.deposit(18000e6);
        f.activate();
        F.AutoRequest memory r = F.AutoRequest(
            0,
            500e6,
            500e6,
            0,
            usgsTime,
            bytes(vm.parseJsonString(usgs, ".data")),
            vm.parseJsonBytes(usgs, ".signature")
        );
        vm.prank(n[0]);
        uint256 id = f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(1)));
        vm.prank(n[0]);
        f.claim(f.automaticReserve(id, r));
        assertEq(t.balanceOf(n[0]), 500e6);
        vm.warp(eonetTime);
        r = F.AutoRequest(
            1,
            500e6,
            500e6,
            0,
            eonetTime,
            bytes(vm.parseJsonString(eonet, ".data")),
            vm.parseJsonBytes(eonet, ".signature")
        );
        vm.prank(n[0]);
        id = f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(2)));
        vm.prank(n[0]);
        f.claim(f.automaticReserve(id, r));
        assertEq(t.balanceOf(n[0]), 1000e6);
        vm.warp(eonetTime + 301);
        vm.prank(n[1]);
        vm.expectRevert();
        f.automaticSubmit(r, keccak256("purpose"), bytes32(uint256(3)));
    }
}
