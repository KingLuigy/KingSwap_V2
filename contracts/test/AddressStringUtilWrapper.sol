// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.6.0;

import "../kingswap/libraries/AddressStringUtil.sol";

contract AddressStringUtilWrapper {
    function toAsciiString(address addr, uint len) pure public returns (string memory) {
        return AddressStringUtil.toAsciiString(addr, len);
    }
}