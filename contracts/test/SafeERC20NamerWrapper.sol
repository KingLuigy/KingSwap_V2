// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.6.0;

import "../kingswap/libraries/SafeERC20Namer.sol";

contract SafeERC20NamerWrapper {
    function getTokenSymbol(address token) view public returns (string memory) {
        return SafeERC20Namer.tokenSymbol(token);
    }

    function getTokenName(address token) view public returns (string memory) {
        return SafeERC20Namer.tokenName(token);
    }
}