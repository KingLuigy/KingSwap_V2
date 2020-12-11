pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Stake ERC-20 tokens to "farm" more tokens.
contract QueenDecks is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // The amount to return on stake withdrawal is calculated as:
    // `amountDue = Stake.amount * TermSheet.rewardFactor/1e+6` (1)

    struct TermSheet {
        uint176 minAmount;     // Min token amount to stake
        uint32 maxFactor;      // Max stake amount multiplier, scaled by 1e+4:
                               // `maxAmount = minAmount * maxFactor/1e+4`
                               // (if set to 0, the stake amount is unlimited)
        uint32 rewardFactor;   // Reward multiplier, scaled by 1e+6 (see (1))
        uint16 lockHours;      // Staking period in hours
        uint16 rewardLockHours;// Min time between accrued reward withdrawals
                               // if not set, interim withdrawals not allowed
        address token;         // ERC-20 contract of the token to stake
        bool enabled;          // If staking is enabled
    }

    struct Stake {
        uint256 amount;        // Token amount staked
        uint32 unlockTime;     // UNIX-time the stake may be withdrawn since
        uint32 lastRewardTime; // UNIX-time the reward last time withdrawn at
        uint32 rewardFactor;   // see TermSheet.rewardFactor
        uint16 rewardLockHours;// see TermSheet.rewardLockHours
        uint16 lockHours;      // see TermSheet.lockHours
    }

    // All stakes of a user
    // (note, the stake ID includes the address of the token staked)
    struct UserStakes {
        // Set of (unique) stake IDs (see `encodeStakeId` function)
        uint256[] ids;
        // Mapping from stake ID to stake data
        mapping(uint256 => Stake) data;
    }

    // Emergency withdrawals enabled by default
    bool public emergencyWithdrawEnabled = true;

    // Emergency fees factor, scaled by 1e+4:
    // `fees = Stake.amount * emergencyFeesFactor / 1e+4`
    uint16 emergencyFeesFactor = 500; // i.e. 5%

    // Number of stakes made so far
    uint48 public stakeQty;

    // Account that controls (holds) the tokens staked
    address public treasury;

    // Info on each TermSheet
    TermSheet[] internal termSheets;

    // Mappings from staked token address to amount staked
    mapping(address => uint256) public amountsStaked; // in token units
    // Mappings from staked token address to amount due
    mapping(address => uint256) public amountsDue; // in token units

    // Mapping from user account to user stakes
    mapping(address => UserStakes) internal stakes;

    event Deposit(
        address indexed token,
        address indexed user,
        uint256 stakeId,
        uint256 amount,        // amount staked
        uint256 amountDue,     // amount to be returned
        uint256 unlockTime     // UNIX-time when the stake is unlocked
    );

    // User withdraws the stake (including reward due)
    event Withdraw(
        address indexed user,
        uint256 stakeId,
        uint256 amount         // amount sent to user (in token units)
    );

    // User withdraws interim reward
    event Reward(
        address indexed user,
        uint256 stakeId,
        uint256 amount         // amount sent to user (in token units)
    );

    event Emergency(bool enabled);
    event EmergencyFactor(uint256 factor);

    event EmergencyWithdraw(
        address indexed user,
        uint256 stakeId,
        uint256 amount,        // amount sent to user (in token units)
        uint256 reward,        // cancelled reward (in token units)
        uint256 fees           // withheld fees (in token units)
    );

    event NewTermSheet(
        uint256 indexed termsId, // index in the `termSheets` array
        address indexed token,   // here and further - see `struct TermSheet`
        uint256 minAmount,
        uint256 maxFactor,
        uint256 lockHours,
        uint256 rewardLockHours,
        uint256 rewardFactor
    );

    event TermsEnabled(uint256 indexed termsId);
    event TermsDisabled(uint256 indexed termsId);

    constructor(address _treasury) public {
        _revertZeroAddress(_treasury);
        treasury = _treasury;
    }

    receive() external payable {
        revert("QDeck::can't receive ethers");
    }

    // Stake ID uniquely identifies a stake
    // (note, `stakeNum` uniquely identifies a stake, rest is for UI sake)
    function encodeStakeId(
        address token,         // token contract address
        uint256 stakeNum,      // uniq nonce (limited to 48 bits)
        uint256 unlockTime,    // UNIX time (limited to 32 bits)
        uint256 stakeHours     // Stake duration (limited to 16 bits)
    ) public pure returns (uint256) {
        require(stakeNum < 2**48, "QDeck::stakeNum_EXCEEDS_48_BITS");
        require(unlockTime < 2**32, "QDeck::unlockTime_EXCEEDS_32_BITS");
        require(stakeHours < 2**16, "QDeck::stakeHours_EXCEEDS_16_BITS");
        return _encodeStakeId(token, stakeNum, unlockTime, stakeHours);
    }

    function decodeStakeId(uint256 stakeId)
        public
        pure
        returns (
            address token,
            uint256 stakeNum,
            uint256 unlockTime,
            uint256 stakeHours
        )
    {
        token = address(stakeId >> 96);
        stakeNum = (stakeId >> 48) & (2**48 - 1);
        unlockTime = (stakeId >> 16) & (2**32 - 1);
        stakeHours = stakeId & (2**16 - 1);
    }

    function stakeIds(address user) external view returns (uint256[] memory) {
        _revertZeroAddress(user);
        UserStakes storage userStakes = stakes[user];
        return userStakes.ids;
    }

    function stakeData(
        address user,
        uint256 stakeId
    ) external view returns (Stake memory)
    {
        return stakes[_nonZeroAddr(user)].data[stakeId];
    }

    function getAmountDue(Stake memory stake) external view returns(uint256) {
        Stake memory stake = userStakes.data[stakeId];
        return stake.amount == 0
            ? 0
            : _rewardDue(stake, now).add(stake.amount);
    }

    function termSheet(uint256 termsId) external view returns (TermSheet memory) {
        return termSheets[_validTermsID(termsId)];
    }

    function termsLength() external view returns (uint256) {
        return termSheets.length;
    }

    function deposit(uint256 termsId, uint256 amount) public nonReentrant {
        TermSheet memory tS = termSheets[_validTermsID(termsId)];
        require(tS.enabled, "deposit: terms disabled");

        require(amount >= tS.minAmount, "deposit: too small amount");
        if (tS.maxFactor != 0) {
            require(
                amount <= uint256(tS.minAmount).sub(tS.maxFactor).div(1e4),
                "deposit: too big amount"
            );
        }

        uint48 stakeNum = stakeQty + 1;
        require(stakeNum != 0, "QDeck::stakeQty_OVERFLOW");

        uint256 _amountDue = amount.mul(tS.rewardFactor).div(1e6);
        uint32 unlockTime = safe32(now + tS.lockHours * 3600);

        uint256 stakeId = _encodeStakeId(tS.token, stakeNum, now, tS.lockHours);

        IERC20(ts.token).safeTransferFrom(msg.sender, treasury, amount);

        _addUserStake(
            stakes[msg.sender],
            stakeId,
            Stake(
                amount,
                unlockTime,
                safe32(now),
                tS.rewardFactor,
                tS.rewardLockHours,
                tS.lockHours
            )
        );
        stakeQty = stakeNum;
        amountsStaked[tS.token] = amountsStaked[tS.token].add(amount);
        amountsDue[tS.token] = amountsDue[tS.token].add(_amountDue);

        emit Deposit(tS.token, msg.sender, stakeId, amount, _amountDue, unlockTime);
    }

    // Withdraw staked token amount due (including the reward)
    function withdraw(uint256 stakeId) public nonReentrant {
        _withdraw(stakeId, false);
    }

    // Withdraw reward accrued so far (if interim withdrawals allowed)
    function withdrawReward(uint256 stakeId) public {
        _withdrawReward(stakeId);
    }

    // Withdraw staked token amount w/o the reward
    // !!! All rewards entitled be lost. Use in emergency only !!!
    function emergencyWithdraw(uint256 stakeId) public nonReentrant {
        _withdraw(stakeId, true);
    }

    function addTerms(TermSheet[] memory _termSheets) public onlyOwner {
        for (uint256 i = 0; i < _termSheets.length; i++) {
            _addTermSheet(_termSheets[i]);
        }
    }

    function enableTerms(uint256 termsId) external onlyOwner {
        termSheets[_validTermsID(termsId)].enabled = true;
        emit TermsEnabled(termsId);
    }

    function disableTerms(uint256 termsId) external onlyOwner {
        termSheets[_validTermsID(termsId)].enabled = false;
        emit TermsDisabled(termsId);
    }

    function enableEmergencyWithdraw() external onlyOwner {
        emergencyWithdrawEnabled = true;
        emit Emergency(true);
    }

    function disableEmergencyWithdraw() external onlyOwner {
        emergencyWithdrawEnabled = false;
        emit Emergency(false);
    }

    function setEmergencyFeesFactor(uint256 factor) external onlyOwner {
        require(factor < 5000, "QDeck::INVALID_factor"); // less then 50%
        emergencyFeesFactor = factor;
        emit EmergencyFactor(factor);
    }

    // Save occasional airdrop or mistakenly transferred tokens
    function transferFromContract(
        IERC20 token,
        uint amount,
        address to
    ) external onlyOwner {
        _revertZeroAddress(to);
        token.safeTransfer(to, amount);
    }

    function _withdraw(uint256 stakeId, bool isEmergency) internal {
        address token = _tokenFromId(stakeId);
        UserStakes storage userStakes = stakes[msg.sender];
        Stake memory stake = userStakes.data[stakeId];

        require(stake.amount != 0, "QDeck::unknown or returned stake");
        uint256 reward = _rewardDue(stake, now);
        uint256 amountDue = stake.amount.add(reward);

        uint256 amountToUser;
        if (isEmergency) {
            require(emergencyWithdrawEnabled, "withdraw: emergency disabled");
            uint256 fees = stake.amount.mul(emergencyFeesFactor).div(1e+4);
            amountToUser = stake.amount.sub(fees);
            emit EmergencyWithdraw(msg.sender, stakeId, amountToUser, reward, fee);
        } else {
            require(now >= stake.unlockTime, "withdraw: stake is locked");
            amountToUser = amountDue;
            emit Withdraw(msg.sender, stakeId, amountToUser);
        }

        _removeUserStake(userStakes, stakeId);
        amountsStaked[token] = amountsStaked[token].sub(stake.amount);
        amountsDue[token] = amountsDue[token].sub(amountDue);

        IERC20(token).safeTransferFrom(treasury, msg.sender, amountToUser);
    }

    function _withdrawReward(uint256 stakeId) internal {
        address token = _tokenFromId(stakeId);
        UserStakes storage userStakes = stakes[msg.sender];
        Stake memory stake = userStakes.data[stakeId];
        require(stake.amount != 0, "QDeck::unknown or returned stake");
        require(stake.rewardLockHours != 0, "QDeck::reward is locked");

        uint256 allowedTime = stake.lastRewardTime + stake.rewardLockHours * 3600;
        require(now >= allowedTime, "QDeck::reward withdrawal not yet allowed");

        uint256 reward = _rewardDue(stake, now);
        if (reward == 0) return;

        stakes[msg.sender][stakeId].lastRewardTime = safe32(now);
        amountsDue[token] = amountsDue[token].sub(reward);

        IERC20(token).safeTransferFrom(treasury, msg.sender, reward);
        emit Reward(msg.sender, stakeId, reward);
    }

    function _rewardDue(
        Stake memory stake,
        uint256 timestamp
    ) internal view returns(uint256 reward) {
        reward = 0;
        if (
            (stake.amount != 0) &&
            (timestamp > stake.lastRewardTime) &&
            (stake.lastRewardTime < stake.unlockTime)
        ) {
            reward = stake.amount
                .mul(stake.rewardFactor)
                .mul(timestamp.sub(stake.lastRewardTime))
                .div(uint256(stake.lockHours) * 3600)
                .div(1e6);
        }
    }

    function _addTermSheet(TermSheet memory tS) internal {
        _revertZeroAddress(tS.token);
        require(
            tS.minAmount != 0 && tS.lockHours != 0 && tS.rewardFactor != 0,
            "QDeck::add:INVALID_ZERO_PARAM"
        );
        require(_isMissingTerms(tS), "QDeck::add:TERMS_DUPLICATED");

        termSheets.push(tS);

        emit NewTermSheet(
            termSheets.length - 1,
            tS.token,
            tS.minAmount,
            tS.maxFactor,
            tS.lockHours,
            tS.rewardLockHours,
            tS.rewardFactor
        );
        if (tS.enabled) emit TermsEnabled(termSheets.length);
    }

    // Returns `true` if the term sheet has NOT been yet added.
    function _isMissingTerms(TermSheet memory newSheet)
        internal
        view
        returns (bool)
    {
        for (uint256 i = 0; i < termSheets.length; i++) {
            TermSheet memory sheet = termSheets[i];
            if (
                sheet.token == newSheet.token &&
                sheet.minAmount == newSheet.minAmount &&
                sheet.maxFactor == newSheet.maxFactor &&
                sheet.lockHours == newSheet.lockHours &&
                sheet.rewardLockHours == newSheet.rewardLockHours &&
                sheet.rewardFactor == newSheet.rewardFactor
            ) {
                return false;
            }
        }
        return true;
    }

    function _addUserStake(
        UserStakes storage userStakes,
        uint256 stakeId,
        Stake memory stake
    ) internal {
        require(
            userStakes.data[stakeId].amount == 0,
            "QDeck:DUPLICATED_STAKE_ID"
        );
        userStakes.data[stakeId] = stake;
        userStakes.ids.push(stakeId);
    }

    function _removeUserStake(UserStakes storage userStakes, uint256 stakeId)
        internal
    {
        require(
            userStakes.data[stakeId].amount != 0,
            "QDeck:INVALID_STAKE_ID"
        );
        userStakes.data[stakeId].amount = 0;
        _removeArrayElement(userStakes.ids, stakeId);
    }

    // Assuming the given array does contain the given element
    function _removeArrayElement(uint256[] storage arr, uint256 el) internal {
        uint256 lastIndex = arr.length - 1;
        if (lastIndex != 0) {
            uint256 replaced = arr[lastIndex];
            if (replaced != el) {
                // Shift elements until the one being removed is replaced
                do {
                    uint256 replacing = replaced;
                    replaced = arr[lastIndex - 1];
                    lastIndex--;
                    arr[lastIndex] = replacing;
                } while (replaced != el && lastIndex != 0);
            }
        }
        // Remove the last (and quite probably the only) element
        arr.pop();
    }

    function _encodeStakeId(
        address token,
        uint256 stakeNum,
        uint256 unlockTime,
        uint256 stakeHours
    ) internal pure returns (uint256) {
        require(stakeNum < 2**48, "QDeck::stakeNum_EXCEEDS_48_BITS");
        return
          uint256(token) << 96 |
          stakeNum << 48 |
          unlockTime << 16 |
          stakeHours;
    }

    function _tokenFromId(uint256 stakeId) internal pure returns(address) {
        address token = address(stakeId >> 96);
        _revertZeroAddress(token);
        return token;
    }

    function _revertZeroAddress(address _address) internal pure {
        require(_address != address(0), "QDeck::ZERO_ADDRESS");
    }

    function _nonZeroAddr(address _address) private pure returns (address) {
        _revertZeroAddress(_address);
        return _address;
    }

    function _validTermsID(uint256 termsId) private view returns (uint256) {
        require(termsId < termSheets.length, "QDeck::INVALID_TERMS_ID");
        return termsId;
    }
}
