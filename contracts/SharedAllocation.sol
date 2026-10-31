// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Equal package weights; integer remainders follow registry order.
contract SharedAllocation {
    function allocate(uint256 budget, uint256[] memory limits) external pure returns (uint256[] memory amounts) {
        amounts = new uint256[](limits.length);
        while (budget > 0) {
            uint256 active;
            for (uint256 i; i < limits.length; i++) if (amounts[i] < limits[i]) active++;
            if (active == 0) break;
            uint256 share = budget / active;
            uint256 used;
            for (uint256 i; i < limits.length; i++) {
                if (amounts[i] == limits[i]) continue;
                uint256 add = share == 0 ? 1 : share;
                if (add > limits[i] - amounts[i]) add = limits[i] - amounts[i];
                if (add > budget - used) add = budget - used;
                amounts[i] += add;
                used += add;
            }
            budget -= used;
        }
    }
}
