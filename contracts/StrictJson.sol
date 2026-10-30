// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {JSONParserLib} from "solady/utils/JSONParserLib.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";

library StrictJson {
    using JSONParserLib for JSONParserLib.Item;
    error AmbiguousData();

    /// @dev Projections are small flat objects. Decode keys before comparing, including escaped aliases.
    function validate(bytes memory data) internal pure {
        if (data.length > 8192) revert AmbiguousData();
        JSONParserLib.Item memory root = JSONParserLib.parse(string(data));
        if (!root.isObject() || root.size() > 20) revert AmbiguousData();
        JSONParserLib.Item[] memory fields = root.children();
        for (uint256 i; i < fields.length; ++i) {
            bytes32 key = keccak256(bytes(JSONParserLib.decodeString(fields[i].key())));
            for (uint256 j; j < i; ++j) {
                if (key == keccak256(bytes(JSONParserLib.decodeString(fields[j].key())))) revert AmbiguousData();
            }
        }
    }

    /// @dev Reject precision loss instead of rounding an invalid or just-below-threshold input upward.
    function _precision(bytes memory data, string memory key) private pure {
        JSONParserLib.Item memory item = JSONParserLib.parse(string(data)).at(string.concat('"', key, '"'));
        string memory raw = item.isString() ? JSONParserLib.decodeString(item.value()) : item.value();
        bytes memory value = bytes(raw);
        bool fraction;
        uint256 decimals;
        for (uint256 i; i < value.length; ++i) {
            if (value[i] == '.') fraction = true;
            else if (fraction && ++decimals > 6) revert AmbiguousData();
        }
    }

    function number(bytes memory data, string memory key) internal pure returns (uint256) {
        _precision(data, key);
        return ProjectedJson.readUint(data, key, 6);
    }

    function integer(bytes memory data, string memory key) internal pure returns (uint256) {
        uint256 scaled = number(data, key);
        if (scaled % 1e6 != 0) revert AmbiguousData();
        return scaled / 1e6;
    }

    function signedNumber(bytes memory data, string memory key) internal pure returns (int256) {
        _precision(data, key);
        return ProjectedJson.readInt(data, key, 6);
    }
}
