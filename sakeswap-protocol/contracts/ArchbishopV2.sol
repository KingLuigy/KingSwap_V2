pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./KingToken.sol";

// Archbishop will crown the King and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once $KING is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract ArchbishopV2 is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 amountStoken; // How many S tokens the user has provided.
        uint256 amountLPtoken; // How many LP tokens the user has provided.
        uint256 pengdingKing; // record $KING amount when user withdraw lp.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 lastWithdrawBlock; // user last withdraw time;

        //
        // We do some fancy math here. Basically, any point in time, the amount of $KINGs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accKingPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accKingPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        IERC20 sToken; // Address of S token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool (for $KINGs distribution).
        uint256 lastRewardBlock; // Last block number that $KINGs distribution occurs.
        uint256 accKingPerShare; // Accumulated $KINGs per share, times 1e12. See below.
        uint256 multiplierSToken; // times 1e8;
        bool kingLockSwitch; // true - have $KING withdraw interval, default 1 months
                             // false - no withdraw interval, but have $KING withdraw fee, default 10%
    }

    // The $KING TOKEN!
    KingToken public king;
    // kingServant address.
    address public kingServant;
    // admin address.
    address public admin;
    // receive $KING fee address
    address public kingFeeAddress;
    // Block number when trade mining speed up period ends.
    uint256 public tradeMiningSpeedUpEndBlock;
    // Block number when phase II yield farming period ends.
    uint256 public yieldFarmingIIEndBlock;
    // Block number when trade mining period ends.
    uint256 public tradeMiningEndBlock;
    // trade mining speed end block num,about 1 months.
    uint256 public tradeMiningSpeedUpEndBlockNum = 192000;
    // phase II yield farming end block num,about 6 months.
    uint256 public yieldFarmingIIEndBlockNum = 1152000;
    // trade mining end block num,about 12 months.
    uint256 public tradeMiningEndBlockNum = 2304000;
    // $KING tokens created per block for phase II yield farming.
    uint256 public kingPerBlockYieldFarming = 5 * 10**18;
    // $KING tokens created per block for trade mining.
    uint256 public kingPerBlockTradeMining = 10 * 10**18;
    // Bonus muliplier for trade mining.
    uint256 public constant BONUS_MULTIPLIER = 2;
    // withdraw block num interval,about 1 months.
    uint256 public withdrawInterval = 192000;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when $KING mining starts.
    uint256 public startBlock;
    // The ratio of withdraw lp fee(default is 0%)
    uint8 public lpFeeRatio = 0;
    // The ratio of withdraw $KING fee if no withdraw interval(default is 10%)
    uint8 public kingFeeRatio = 10;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens and S tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amountLPtoken, uint256 amountStoken);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amountLPtoken);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amountLPtoken);

    constructor(
        KingToken _king,
        address _admin,
        address _kingServant,
        address _kingFeeAddress,
        uint256 _startBlock
    ) public {
        king = _king;
        admin = _admin;
        kingServant = _kingServant;
        kingFeeAddress = _kingFeeAddress;
        startBlock = _startBlock;
        tradeMiningSpeedUpEndBlock = startBlock.add(tradeMiningSpeedUpEndBlockNum);
        yieldFarmingIIEndBlock = startBlock.add(yieldFarmingIIEndBlockNum);
        tradeMiningEndBlock = startBlock.add(tradeMiningEndBlockNum);
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // DO NOT add the same LP token more than once.
    function _checkValidity(IERC20 _lpToken, IERC20 _sToken) internal view {
        for (uint256 i = 0; i < poolInfo.length; i++) {
            require(poolInfo[i].lpToken != _lpToken && poolInfo[i].sToken != _sToken, "pool exist");
        }
    }

    // Add a new lp to the pool. Can only be called by the admin.
    function add(
        uint256 _allocPoint,
        uint256 _multiplierSToken,
        IERC20 _lpToken,
        IERC20 _sToken,
        bool _withUpdate
    ) public {
        require(msg.sender == admin, "add:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        _checkValidity(_lpToken, _sToken);
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                sToken: _sToken,
                allocPoint: _allocPoint,
                multiplierSToken: _multiplierSToken,
                lastRewardBlock: lastRewardBlock,
                accKingPerShare: 0,
                kingLockSwitch: true
            })
        );
    }

    // Update the given pool's $KING allocation point. Can only be called by the admin.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) public {
        require(msg.sender == admin, "set:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    function setMultiplierSToken(
        uint256 _pid,
        uint256 _multiplierSToken,
        bool _withUpdate
    ) public {
        require(msg.sender == admin, "sms:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        poolInfo[_pid].multiplierSToken = _multiplierSToken;
    }

    // set $KING withdraw switch. Can only be called by the admin.
    function setKingLockSwitch(
        uint256 _pid,
        bool _kingLockSwitch,
        bool _withUpdate
    ) public {
        require(msg.sender == admin, "s:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        poolInfo[_pid].kingLockSwitch = _kingLockSwitch;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256 multipY, uint256 multipT) {
        uint256 _toFinalY = _to > yieldFarmingIIEndBlock ? yieldFarmingIIEndBlock : _to;
        uint256 _toFinalT = _to > tradeMiningEndBlock ? tradeMiningEndBlock : _to;
        // phase II yield farming multiplier
        if (_from >= yieldFarmingIIEndBlock) {
            multipY = 0;
        } else {
            multipY = _toFinalY.sub(_from);
        }
        // trade mining multiplier
        if (_from >= tradeMiningEndBlock) {
            multipT = 0;
        } else {
            if (_toFinalT <= tradeMiningSpeedUpEndBlock) {
                multipT = _toFinalT.sub(_from).mul(BONUS_MULTIPLIER);
            } else {
                if (_from < tradeMiningSpeedUpEndBlock) {
                    multipT = tradeMiningSpeedUpEndBlock.sub(_from).mul(BONUS_MULTIPLIER).add(
                        _toFinalT.sub(tradeMiningSpeedUpEndBlock)
                    );
                } else {
                    multipT = _toFinalT.sub(_from);
                }
            }
        }
    }

    function getKingPerBlock(uint256 blockNum) public view returns (uint256) {
        if (blockNum <= tradeMiningSpeedUpEndBlock) {
            return kingPerBlockYieldFarming.add(kingPerBlockTradeMining.mul(BONUS_MULTIPLIER));
        } else if (blockNum > tradeMiningSpeedUpEndBlock && blockNum <= yieldFarmingIIEndBlock) {
            return kingPerBlockYieldFarming.add(kingPerBlockTradeMining);
        } else if (blockNum > yieldFarmingIIEndBlock && blockNum <= tradeMiningEndBlock) {
            return kingPerBlockTradeMining;
        } else {
            return 0;
        }
    }

    // Handover the kingtoken mintage right.
    function handoverKingMintage(address newOwner) public onlyOwner {
        king.transferOwnership(newOwner);
    }

    // View function to see pending $KINGs on frontend.
    function pendingKing(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accKingPerShare = pool.accKingPerShare;
        uint256 lpTokenSupply = pool.lpToken.balanceOf(address(this));
        uint256 sTokenSupply = pool.sToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpTokenSupply != 0) {
            uint256 totalSupply = lpTokenSupply.add(sTokenSupply.mul(pool.multiplierSToken).div(1e8));
            (uint256 multipY, uint256 multipT) = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 kingRewardY = multipY.mul(kingPerBlockYieldFarming).mul(pool.allocPoint).div(totalAllocPoint);
            uint256 kingRewardT = multipT.mul(kingPerBlockTradeMining).mul(pool.allocPoint).div(totalAllocPoint);
            uint256 kingReward = kingRewardY.add(kingRewardT);
            accKingPerShare = accKingPerShare.add(kingReward.mul(1e12).div(totalSupply));
        }
        return user.amount.mul(accKingPerShare).div(1e12).add(user.pengdingKing).sub(user.rewardDebt);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpTokenSupply = pool.lpToken.balanceOf(address(this));
        uint256 sTokenSupply = pool.sToken.balanceOf(address(this));
        if (lpTokenSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        (uint256 multipY, uint256 multipT) = getMultiplier(pool.lastRewardBlock, block.number);
        if (multipY == 0 && multipT == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 kingRewardY = multipY.mul(kingPerBlockYieldFarming).mul(pool.allocPoint).div(totalAllocPoint);
        uint256 kingRewardT = multipT.mul(kingPerBlockTradeMining).mul(pool.allocPoint).div(totalAllocPoint);
        uint256 kingReward = kingRewardY.add(kingRewardT);
        uint256 totalSupply = lpTokenSupply.add(sTokenSupply.mul(pool.multiplierSToken).div(1e8));
        if (king.owner() == address(this)) {
            king.mint(address(this), kingRewardT);
        }
        pool.accKingPerShare = pool.accKingPerShare.add(kingReward.mul(1e12).div(totalSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to ArchbishopV2 for $KING allocation.
    function deposit(
        uint256 _pid,
        uint256 _amountlpToken,
        uint256 _amountsToken
    ) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        if (_amountlpToken <= 0 && user.pengdingKing == 0) {
            require(user.amountLPtoken > 0, "deposit:invalid");
        }
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accKingPerShare).div(1e12).add(user.pengdingKing).sub(user.rewardDebt);
        uint256 _originAmountStoken = user.amountStoken;
        user.amountLPtoken = user.amountLPtoken.add(_amountlpToken);
        user.amountStoken = user.amountStoken.add(_amountsToken);
        user.amount = user.amount.add(_amountlpToken.add(_amountsToken.mul(pool.multiplierSToken).div(1e8)));
        user.pengdingKing = pending;
        if (pool.kingLockSwitch) {
            if (block.number > (user.lastWithdrawBlock.add(withdrawInterval))) {
                user.lastWithdrawBlock = block.number;
                user.pengdingKing = 0;
                user.amountStoken = _amountsToken;
                user.amount = user.amountLPtoken.add(_amountsToken.mul(pool.multiplierSToken).div(1e8));
                pool.sToken.safeTransfer(address(1), _originAmountStoken);
                if (pending > 0) {
                    _safeKingTransfer(msg.sender, pending);
                }
            }
        } else {
            user.lastWithdrawBlock = block.number;
            user.pengdingKing = 0;
            if (_amountlpToken == 0 && _amountsToken == 0) {
                user.amountStoken = 0;
                user.amount = user.amountLPtoken;
                pool.sToken.safeTransfer(address(1), _originAmountStoken);
            }
            if (pending > 0) {
                uint256 kingFee = pending.mul(kingFeeRatio).div(100);
                uint256 kingToUser = pending.sub(kingFee);
                _safeKingTransfer(msg.sender, kingToUser);
                _safeKingTransfer(kingFeeAddress, kingFee);
            }
        }
        user.rewardDebt = user.amount.mul(pool.accKingPerShare).div(1e12);
        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amountlpToken);
        pool.sToken.safeTransferFrom(address(msg.sender), address(this), _amountsToken);
        emit Deposit(msg.sender, _pid, _amountlpToken, _amountsToken);
    }

    // Withdraw LP tokens from Archbishop.
    function withdraw(uint256 _pid, uint256 _amountLPtoken) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amountLPtoken >= _amountLPtoken, "withdraw: LP amount not enough");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accKingPerShare).div(1e12).add(user.pengdingKing).sub(user.rewardDebt);
        user.amountLPtoken = user.amountLPtoken.sub(_amountLPtoken);
        uint256 _amountStoken = user.amountStoken;
        user.amountStoken = 0;
        user.amount = user.amountLPtoken;
        user.rewardDebt = user.amount.mul(pool.accKingPerShare).div(1e12);
        if (pool.kingLockSwitch) {
            if (block.number > (user.lastWithdrawBlock.add(withdrawInterval))) {
                user.lastWithdrawBlock = block.number;
                user.pengdingKing = 0;
                _safeKingTransfer(msg.sender, pending);
            } else {
                user.pengdingKing = pending;
            }
        } else {
            user.lastWithdrawBlock = block.number;
            user.pengdingKing = 0;
            uint256 kingFee = pending.mul(kingFeeRatio).div(100);
            uint256 kingToUser = pending.sub(kingFee);
            _safeKingTransfer(msg.sender, kingToUser);
            _safeKingTransfer(kingFeeAddress, kingFee);
        }
        uint256 lpTokenFee;
        uint256 lpTokenToUser;
        if (block.number < tradeMiningEndBlock) {
            lpTokenFee = _amountLPtoken.mul(lpFeeRatio).div(100);
            pool.lpToken.safeTransfer(kingServant, lpTokenFee);
        }
        lpTokenToUser = _amountLPtoken.sub(lpTokenFee);
        pool.lpToken.safeTransfer(address(msg.sender), lpTokenToUser);
        pool.sToken.safeTransfer(address(1), _amountStoken);
        emit Withdraw(msg.sender, _pid, lpTokenToUser);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amountLPtoken > 0, "withdraw: LP amount not enough");
        uint256 _amountLPtoken = user.amountLPtoken;
        uint256 _amountStoken = user.amountStoken;
        user.amount = 0;
        user.amountLPtoken = 0;
        user.amountStoken = 0;
        user.rewardDebt = 0;

        uint256 lpTokenFee;
        uint256 lpTokenToUser;
        if (block.number < tradeMiningEndBlock) {
            lpTokenFee = _amountLPtoken.mul(lpFeeRatio).div(100);
            pool.lpToken.safeTransfer(kingServant, lpTokenFee);
        }
        lpTokenToUser = _amountLPtoken.sub(lpTokenFee);
        pool.lpToken.safeTransfer(address(msg.sender), lpTokenToUser);
        pool.sToken.safeTransfer(address(1), _amountStoken);
        emit EmergencyWithdraw(msg.sender, _pid, lpTokenToUser);
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

    // Update admin address by owner.
    function setAdmin(address _adminaddr) public onlyOwner {
        require(_adminaddr != address(0), "invalid address");
        admin = _adminaddr;
    }

    // Update kingServant address by admin.
    function setKingServant(address _kingServant) public {
        require(msg.sender == admin, "sm:Call must come from admin.");
        require(_kingServant != address(0), "invalid address");
        kingServant = _kingServant;
    }

    // Update kingFee address by admin.
    function setKingFeeAddress(address _kingFeeAddress) public {
        require(msg.sender == admin, "sf:Call must come from admin.");
        require(_kingFeeAddress != address(0), "invalid address");
        kingFeeAddress = _kingFeeAddress;
    }

    // update tradeMiningSpeedUpEndBlock by owner
    function setTradeMiningSpeedUpEndBlock(uint256 _endBlock) public {
        require(msg.sender == admin, "tmsu:Call must come from admin.");
        require(_endBlock > startBlock, "invalid endBlock");
        tradeMiningSpeedUpEndBlock = _endBlock;
    }

    // update yieldFarmingIIEndBlock by owner
    function setYieldFarmingIIEndBlock(uint256 _endBlock) public {
        require(msg.sender == admin, "yf:Call must come from admin.");
        require(_endBlock > startBlock, "invalid endBlock");
        yieldFarmingIIEndBlock = _endBlock;
    }

    // update tradeMiningEndBlock by owner
    function setTradeMiningEndBlock(uint256 _endBlock) public {
        require(msg.sender == admin, "tm:Call must come from admin.");
        require(_endBlock > startBlock, "invalid endBlock");
        tradeMiningEndBlock = _endBlock;
    }

    function setKingFeeRatio(uint8 newRatio) public {
        require(msg.sender == admin, "sfr:Call must come from admin.");
        require(newRatio >= 0 && newRatio <= 100, "invalid ratio");
        kingFeeRatio = newRatio;
    }

    function setLpFeeRatio(uint8 newRatio) public {
        require(msg.sender == admin, "lp:Call must come from admin.");
        require(newRatio >= 0 && newRatio <= 100, "invalid ratio");
        lpFeeRatio = newRatio;
    }

    function setWithdrawInterval(uint256 _blockNum) public {
        require(msg.sender == admin, "i:Call must come from admin.");
        withdrawInterval = _blockNum;
    }

    // set kingPerBlock phase II yield farming
    function setKingPerBlockYieldFarming(uint256 _kingPerBlockYieldFarming, bool _withUpdate) public {
        require(msg.sender == admin, "yield:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        kingPerBlockYieldFarming = _kingPerBlockYieldFarming;
    }

    // set kingPerBlock trade mining
    function setKingPerBlockTradeMining(uint256 _kingPerBlockTradeMining, bool _withUpdate) public {
        require(msg.sender == admin, "trade:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        kingPerBlockTradeMining = _kingPerBlockTradeMining;
    }
}
