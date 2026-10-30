// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Fixed-supply, valueless demo asset. Not USDC and not API-payment aUSD.
contract DemoUSDV2 is ERC20 {
    constructor(address holder) ERC20("DisasterDAO Demo Dollar", "dUSD") {
        _mint(holder, 18_000 * 10 ** 6);
    }

    function decimals() public pure override returns (uint8) { return 6; }
}
