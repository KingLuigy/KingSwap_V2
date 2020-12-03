// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../RoyalDecks.sol";

contract MockRoyalDecks is RoyalDecks {
    UserStakes internal _mockStakes;

    constructor(address king) public RoyalDecks(king) {
    }

    function __addUserStake(uint256 nftId, Stake memory stake) external {
        _addUserStake(_mockStakes, nftId, stake);
    }

    function __removeUserStake(uint256 nftId) external {
        _removeUserStake(_mockStakes, nftId);
    }

    function __ids() external view returns (uint256[] memory) {
        return _mockStakes.ids;
    }

    function __stake(uint256 nftId) external view returns (Stake memory) {
        return _mockStakes.data[nftId];
    }
}
