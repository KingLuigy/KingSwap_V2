// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../KingDecks.sol";

contract MockKingDecks is KingDecks {

    uint256[] public __mockArr;

    constructor (address _treasury) public KingDecks(_treasury) {
    }

    function __computeEarlyWithdrawal(
        Deposit memory d,
        TermSheet memory tS,
        uint256 timeNow
    ) external pure returns (uint256 amountToUser, uint256 fees) {
        return _computeEarlyWithdrawal(d, tS, timeNow);
    }

    function __isAllowedNftId(
        uint256 nftId,
        uint256 allowedBitMask
    ) external pure returns(bool) {
        return _isAllowedNftId(nftId, allowedBitMask);
    }

    function __addArrElements(uint256[] calldata els) external {
        for (uint256 i = 0; i < els.length; i++) {
            __mockArr.push(els[i]);
        }
    }

    function __removeArrayElement(uint256 el) external {
        _removeArrayElement(__mockArr, el);
    }

    function __mockArrLength() external view returns(uint256) {
        return __mockArr.length;
    }
}
