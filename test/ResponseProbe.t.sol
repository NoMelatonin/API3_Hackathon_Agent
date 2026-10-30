// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ResponseProbe} from "../contracts/ResponseProbe.sol";
import {AirnodeV2Attestation} from "../contracts/vendor/AirnodeV2Attestation.sol";

contract ResponseProbeTest is Test {
    bytes32 constant REQUEST_HASH = 0x226b958e9cea51240281d38535b7a0661ed95b7a21f978a122bf442ca7b8522c;
    uint256 constant TIME = 1793370000;
    ResponseProbe probe;

    function setUp() public { probe = new ResponseProbe(); }

    function testWrongKeyRejectedBeforeParsing() public {
        bytes memory data = bytes("not even JSON");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(REQUEST_HASH, TIME, data))
        )));
        vm.expectRevert(abi.encodeWithSelector(AirnodeV2Attestation.NotSignedByAirnode.selector, vm.addr(1)));
        probe.read(REQUEST_HASH, TIME, data, abi.encodePacked(r, s, v));
    }

    /// @dev This is the blocking feasibility gate. Must pass, never merely skip, before building the fund.
    function testRealAirnodeResponse() public {
        string memory path = "fixtures/usgs-real.json";
        if (!vm.exists(path)) { vm.skip(true); return; }
        string memory json = vm.readFile(path);
        assertEq(vm.parseJsonBytes32(json, ".requestHash"), REQUEST_HASH, "wrong request fixture");
        assertEq(vm.parseJsonAddress(json, ".airnode"), 0x5aF744115e2577513D878D4263Db73b3E77E7630);
        (uint256 magnitude, uint256 eventTime, string memory eventId) = probe.read(
            REQUEST_HASH, vm.parseUint(vm.parseJsonString(json, ".timestamp")),
            bytes(vm.parseJsonString(json, ".data")), vm.parseJsonBytes(json, ".signature")
        );
        assertEq(magnitude, 780);
        assertEq(eventTime, 1675646254342);
        assertEq(eventId, "us6000jllz");
    }
}
