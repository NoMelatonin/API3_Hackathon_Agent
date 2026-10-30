// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @notice Demo funding curves, not estimates of damage or humanitarian need.
/// @dev expWad is pinned by vendor/versions.json (Solady, MIT). Inputs use six decimal places.
library PayoutMath {
    uint256 internal constant SCALE = 1e6;
    error InvalidCurve();

    function payout(uint8 curve, uint256 x, uint256 threshold, uint256 cap, uint256 minimum, uint256 maximum)
        internal pure returns (uint256)
    {
        if (curve > 2 || threshold == 0 || cap <= threshold || cap > 1_000_000 * SCALE
            || minimum == 0 || minimum > maximum || maximum > 2_000 * SCALE) revert InvalidCurve();
        if (x < threshold) return 0;
        if (x >= cap) return maximum; // Bound before squaring or exponentiation.
        uint256 numerator;
        uint256 denominator;
        if (curve == 0) {
            // exp(ln(10) * 1.5 * deltaMagnitude); cap width limited to 2 magnitude units.
            if (cap - threshold > 2 * SCALE) revert InvalidCurve();
            int256 factor = 3_453_877_639_491_068_526; // 1.5 * ln(10), WAD.
            numerator = uint256(FixedPointMathLib.expWad(int256(x - threshold) * factor / int256(SCALE))) - 1e18;
            denominator = uint256(FixedPointMathLib.expWad(int256(cap - threshold) * factor / int256(SCALE))) - 1e18;
        } else if (curve == 1) {
            numerator = x * x - threshold * threshold;
            denominator = cap * cap - threshold * threshold;
        } else {
            numerator = x - threshold;
            denominator = cap - threshold;
        }
        return minimum + (maximum - minimum) * numerator / denominator;
    }
}
