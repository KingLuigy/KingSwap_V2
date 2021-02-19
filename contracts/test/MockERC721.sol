// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    constructor(
        string memory myName,
        string memory mySymbol,
        address mintTo,
        uint256 totalSupply
    ) public ERC721(myName, mySymbol) {
        for (uint256 i = 1; i <= totalSupply; i++) {
            _mint(mintTo, i);
            _setTokenURI(i, "https://github.com/KingLuigy/KingSwap_V2/blob/develop/test/resources/mockERC721.json");
        }
    }
}
