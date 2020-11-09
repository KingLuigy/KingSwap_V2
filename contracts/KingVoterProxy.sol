// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

interface IKingVoterCalc {
    function balanceOf(address _voter) external view returns (uint256);

    function totalSupply() external view returns (uint256);
}

contract KingVoterProxy {
    IKingVoterCalc public voteCalc;
    address public owner;

    constructor(address _voteCalcAddr) public {
        voteCalc = IKingVoterCalc(_voteCalcAddr);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "Not Owner");
        _;
    }

    function decimals() external pure returns (uint8) {
        return uint8(18);
    }

    function name() external pure returns (string memory) {
        return "KingToken";
    }

    function symbol() external pure returns (string memory) {
        return "$KING";
    }

    function totalSupply() external view returns (uint256) {
        return voteCalc.totalSupply();
    }

    //sum user deposit kingnum
    function balanceOf(address _voter) external view returns (uint256) {
        return voteCalc.balanceOf(_voter);
    }

    function setCalcAddr(address _calcAddr) public onlyOwner {
        voteCalc = IKingVoterCalc(_calcAddr);
    }
}
