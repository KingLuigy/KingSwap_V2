// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../RoyalDecks.sol";

contract MockRoyalDecks is RoyalDecks {
    Stakes internal __stakes;

    constructor() public {}

    function __addUserStake(uint256 nftId, Stake memory stake) external {
        _addUserStake(__stakes, nftId, stake);
    }

    function __removeUserStake(uint256 nftId) external {
        _removeUserStake(__stakes, nftId);
    }

    function __ids() external view returns (uint256[] memory) {
        return __stakes.ids;
    }

    function __stake(uint256 nftId) external view returns (Stake memory) {
        return __stakes.data[nftId];
    }
}
