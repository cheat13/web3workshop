// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract KSNToken is ERC20 {
    constructor() ERC20("Kritsana", "KSN") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}