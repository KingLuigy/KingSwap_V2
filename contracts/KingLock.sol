pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./KingToken.sol";
import "./Archbishop.sol";

contract KingLock is ERC20("KingLockToken", "KingLock"), Ownable {
    using SafeMath for uint256;
    using Address for address;

    KingToken public king;
    Archbishop public archbishop;
    address public withDrawAddr;

    constructor(KingToken _king, Archbishop _archbishop) public {
        require(address(_king) != address(0) && address(_archbishop) != address(0), "invalid address");
        king = _king;
        archbishop = _archbishop;
        _mint(address(this), 1);
    }

    function deposit(uint256 _pid) public onlyOwner {
        _approve(address(this), address(archbishop), 1);
        archbishop.deposit(_pid, 1);
    }

    function withdrawFromArchbishop(uint256 _pid) public {
        archbishop.deposit(_pid, 0);
    }

    function withdrawToContract(uint256 _amount) public onlyOwner {
        require(withDrawAddr != address(0), "invalid address");
        uint256 totalAmount = king.balanceOf(address(this));
        require(_amount > 0 && _amount <= totalAmount, "invalid amount");
        king.transfer(withDrawAddr, _amount);
    }

    function setwithdrawContractAddr(address _withDrawaddr) public onlyOwner {
        withDrawAddr = _withDrawaddr;
    }
}
