pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "./interfaces/IMigratorChef.sol";
import "./Archbishop.sol";
import "./interfaces/IStakingRewards.sol";

contract KingUniV2 is Ownable, ERC20("Wrapped UniSwap Liquidity Token", "WULP") {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 kingRewardDebt; // $KING reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of $KINGs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accKingPerShare) - user.kingRewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accKingPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `kingRewardDebt` gets updated.
        uint256 uniRewardDebt; // similar with kingRewardDebt
        uint256 firstDepositTime;
    }

    // Info of each user that stakes LP tokens.
    mapping(address => UserInfo) public userInfo;

    IStakingRewards public uniStaking;
    uint256 public lastRewardBlock; // Last block number that $KINGs distribution occurs.
    uint256 public accKingPerShare; // Accumulated $KINGs per share, times 1e12. See below.
    uint256 public accUniPerShare; // Accumulated UNIs per share, times 1e12. See below.

    // The UNI Token.
    IERC20 public uniToken;
    // The $KING TOKEN!
    KingToken public king;
    Archbishop public archbishop;
    IERC20 public lpToken; // Address of LP token contract.

    // The migrator contract. It has a lot of power. Can only be set through governance (owner).
    IMigratorChef public migrator;
    // The address to receive UNI token fee.
    address public uniTokenFeeReceiver;
    // The ratio of UNI token fee (10%).
    uint8 public uniFeeRatio = 10;
    uint8 public isMigrateComplete = 0;

    //Liquidity Event
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor(
        Archbishop _archbishop,
        address _uniLpToken,
        address _uniStaking,
        address _uniToken,
        KingToken _king,
        address _uniTokenFeeReceiver
    ) public {
        archbishop = _archbishop;
        uniStaking = IStakingRewards(_uniStaking);
        uniToken = IERC20(_uniToken);
        king = _king;
        uniTokenFeeReceiver = _uniTokenFeeReceiver;
        lpToken = IERC20(_uniLpToken);
    }

    ////////////////////////////////////////////////////////////////////
    //Migrate liquidity to kingswap
    ///////////////////////////////////////////////////////////////////
    function setMigrator(IMigratorChef _migrator) public onlyOwner {
        migrator = _migrator;
    }

    function migrate() public onlyOwner {
        require(address(migrator) != address(0), "migrate: no migrator");
        updatePool();
        //get all lp and uni reward from uniStaking
        uniStaking.withdraw(totalSupply());
        //get all wrapped lp and $KING reward from archbishop
        uint256 poolIdInArchbishop = archbishop.lpTokenPID(address(this)).sub(1);
        archbishop.withdraw(poolIdInArchbishop, totalSupply());
        uint256 bal = lpToken.balanceOf(address(this));
        lpToken.safeApprove(address(migrator), bal);
        IERC20 newLpToken = migrator.migrate(lpToken);
        require(bal == newLpToken.balanceOf(address(this)), "migrate: bad");
        lpToken = newLpToken;
        isMigrateComplete = 1;
    }

    // View function to see pending $KINGs and UNIs on frontend.
    function pending(address _user) external view returns (uint256 _king, uint256 _uni) {
        UserInfo storage user = userInfo[_user];
        uint256 tempAccKingPerShare = accKingPerShare;
        uint256 tempAccUniPerShare = accUniPerShare;

        if (isMigrateComplete == 0 && block.number > lastRewardBlock && totalSupply() != 0) {
            uint256 poolIdInArchbishop = archbishop.lpTokenPID(address(this)).sub(1);
            uint256 kingReward = archbishop.pendingKing(poolIdInArchbishop, address(this));
            tempAccKingPerShare = tempAccKingPerShare.add(kingReward.mul(1e12).div(totalSupply()));
            uint256 uniReward = uniStaking.earned(address(this));
            tempAccUniPerShare = tempAccUniPerShare.add(uniReward.mul(1e12).div(totalSupply()));
        }
        _king = user.amount.mul(tempAccKingPerShare).div(1e12).sub(user.kingRewardDebt);
        _uni = user.amount.mul(tempAccUniPerShare).div(1e12).sub(user.uniRewardDebt);
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool() public {
        if (block.number <= lastRewardBlock || isMigrateComplete == 1) {
            return;
        }

        if (totalSupply() == 0) {
            lastRewardBlock = block.number;
            return;
        }
        uint256 kingBalance = king.balanceOf(address(this));
        uint256 poolIdInArchbishop = archbishop.lpTokenPID(address(this)).sub(1);
        // Get $KING Reward from Archbishop
        archbishop.deposit(poolIdInArchbishop, 0);
        uint256 kingReward = king.balanceOf(address(this)).sub(kingBalance);
        accKingPerShare = accKingPerShare.add(kingReward.mul(1e12).div((totalSupply())));
        uint256 uniReward = uniStaking.earned(address(this));
        uniStaking.getReward();
        accUniPerShare = accUniPerShare.add(uniReward.mul(1e12).div(totalSupply()));
        lastRewardBlock = block.number;
    }

    function _mintWulp(address _addr, uint256 _amount) internal {
        lpToken.safeTransferFrom(_addr, address(this), _amount);
        _mint(address(this), _amount);
    }

    function _burnWulp(address _to, uint256 _amount) internal {
        lpToken.safeTransfer(address(_to), _amount);
        _burn(address(this), _amount);
    }

    // Deposit LP tokens to Archbishop for $KING allocation.
    function deposit(uint256 _amount) public {
        require(isMigrateComplete == 0 || (isMigrateComplete == 1 && _amount == 0), "already migrate");
        UserInfo storage user = userInfo[msg.sender];
        updatePool();
        if (_amount > 0 && user.firstDepositTime == 0) user.firstDepositTime = block.number;
        uint256 pendingKing = user.amount.mul(accKingPerShare).div(1e12).sub(user.kingRewardDebt);
        uint256 pendingUni = user.amount.mul(accUniPerShare).div(1e12).sub(user.uniRewardDebt);
        user.amount = user.amount.add(_amount);
        user.kingRewardDebt = user.amount.mul(accKingPerShare).div(1e12);
        user.uniRewardDebt = user.amount.mul(accUniPerShare).div(1e12);
        if (pendingKing > 0) _safeKingTransfer(msg.sender, pendingKing);
        if (pendingUni > 0) {
            uint256 uniFee = pendingUni.mul(uniFeeRatio).div(100);
            uint256 uniToUser = pendingUni.sub(uniFee);
            _safeUniTransfer(uniTokenFeeReceiver, uniFee);
            _safeUniTransfer(msg.sender, uniToUser);
        }
        if (_amount > 0) {
            //generate wrapped uniswap lp token
            _mintWulp(msg.sender, _amount);

            //approve and stake to uniswap
            lpToken.approve(address(uniStaking), _amount);
            uniStaking.stake(_amount);

            //approve and stake to archbishop
            _approve(address(this), address(archbishop), _amount);
            uint256 poolIdInArchbishop = archbishop.lpTokenPID(address(this)).sub(1);
            archbishop.deposit(poolIdInArchbishop, _amount);
        }

        emit Deposit(msg.sender, _amount);
    }

    // Withdraw LP tokens from KingUni.
    function withdraw(uint256 _amount) public {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool();
        uint256 pendingKing = user.amount.mul(accKingPerShare).div(1e12).sub(user.kingRewardDebt);
        uint256 pendingUni = user.amount.mul(accUniPerShare).div(1e12).sub(user.uniRewardDebt);
        user.amount = user.amount.sub(_amount);
        user.kingRewardDebt = user.amount.mul(accKingPerShare).div(1e12);
        user.uniRewardDebt = user.amount.mul(accUniPerShare).div(1e12);
        if (pendingKing > 0) _safeKingTransfer(msg.sender, pendingKing);
        if (pendingUni > 0) {
            uint256 uniFee = pendingUni.mul(uniFeeRatio).div(100);
            uint256 uniToUser = pendingUni.sub(uniFee);
            _safeUniTransfer(uniTokenFeeReceiver, uniFee);
            _safeUniTransfer(msg.sender, uniToUser);
        }
        if (_amount > 0) {
            if (isMigrateComplete == 0) {
                uint256 poolIdInArchbishop = archbishop.lpTokenPID(address(this)).sub(1);
                //unstake wrapped lp token from archbishop
                archbishop.withdraw(poolIdInArchbishop, _amount);
                //unstake uniswap lp token from uniswap
                uniStaking.withdraw(_amount);
            }

            _burnWulp(address(msg.sender), _amount);
        }

        emit Withdraw(msg.sender, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() public {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount > 0, "emergencyWithdraw: not good");
        uint256 _amount = user.amount;
        user.amount = 0;
        user.kingRewardDebt = 0;
        user.uniRewardDebt = 0;
        {
            if (isMigrateComplete == 0) {
                uint256 poolIdInArchbishop = archbishop.lpTokenPID(address(this)).sub(1);
                //unstake wrapped lp token from archbishop
                archbishop.withdraw(poolIdInArchbishop, _amount);
                //unstake lp token from uniswap
                uniStaking.withdraw(_amount);
            }

            _burnWulp(address(msg.sender), _amount);
        }
        emit EmergencyWithdraw(msg.sender, _amount);
    }

    // Safe $KING transfer function, just in case if rounding error causes pool to not have enough $KINGs.
    function _safeKingTransfer(address _to, uint256 _amount) internal {
        uint256 kingBal = king.balanceOf(address(this));
        if (_amount > kingBal) {
            king.transfer(_to, kingBal);
        } else {
            king.transfer(_to, _amount);
        }
    }

    // Safe uni transfer function
    function _safeUniTransfer(address _to, uint256 _amount) internal {
        uint256 uniBal = uniToken.balanceOf(address(this));
        if (_amount > uniBal) {
            uniToken.transfer(_to, uniBal);
        } else {
            uniToken.transfer(_to, _amount);
        }
    }

    function setUniTokenFeeReceiver(address _uniTokenFeeReceiver) public onlyOwner {
        uniTokenFeeReceiver = _uniTokenFeeReceiver;
    }
}
