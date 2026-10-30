// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";

/// @notice Feasibility probe only: authenticates and reads, never holds funds.
contract ResponseProbe {
    function read(bytes32 expectedRequest, uint256 timestamp, bytes calldata data, bytes calldata signature)
        external pure returns (uint256 magnitude, uint256 eventTime, string memory eventId)
    {
        AirnodeV2Attestation.verify(0x5aF744115e2577513D878D4263Db73b3E77E7630, expectedRequest, timestamp, data, signature);
        return (ProjectedJson.readUint(data, "magnitude", 2), ProjectedJson.readUint(data, "eventTime", 0),
            ProjectedJson.readString(data, "eventId"));
    }
}
