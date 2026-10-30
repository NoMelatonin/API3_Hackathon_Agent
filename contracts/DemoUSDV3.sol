// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Valueless local-only test asset: 18k fund seed + 18k simulated donor balance.
contract DemoUSDV3 is ERC20 {
    constructor(address holder) ERC20("DisasterDAO Local Demo Dollar", "dUSD") {
        require(block.chainid == 31337, "Local only");
        _mint(holder, 36000e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
