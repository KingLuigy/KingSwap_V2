pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./libraries/SafeMath96.sol";
import "./libraries/SafeMath32.sol";


contract RoyalDecks is Ownable, ReentrancyGuard, ERC721Holder {
    using SafeMath for uint256;
    using SafeMath96 for uint96;
    using SafeMath32 for uint32;

    using SafeERC20 for IERC20;

    // The $KING amount to return (on withdrawal) is calculated as:
    // `amountDue = amountStaked * kingFactor/1e+6`             (1)

    struct Stake {
        uint96 amountStaked;   // $KING amount staked on `startTime`
        uint96 amountDue;      // $KING amount due on (and after) `unlockTime`
        uint32 startTime;      // UNIX-time the tokens get staked on
        uint32 unlockTime;     // UNIX-time the tokens get locked until
    }

    struct TermSheet {
        address nft;           // ERC-721 contract of the NFT to stake
        uint96 minAmount;      // Min $KING amount to stake (with the NFT)
        uint32 lockSeconds;    // Staking period in Seconds
        uint96 kingFactor;     // Multiplier, scaled by 1e+6 (see (1) above)
        bool enabled;          // If staking is enabled
    }

    // All stakes of a user
    struct UserStakes {
        // Set of (unique) stake IDs (see `encodeStakeId` function)
        uint256[] ids;
        // stake ID => stake data
        mapping(uint256 => Stake) data;
    }

    // The $KING token contract
    address public king;
    // Amounts in $KING
    uint96 public amountStaked;
    uint96 public amountDue;

    // Info on each TermSheet
    TermSheet[] internal termSheets;

    // User account => user stakes
    mapping(address => UserStakes) internal stakes;

    event Deposit(
        address indexed user,
        uint256 stakeId,       // ID of the NFT
        uint256 amountStaked,  // $KING amount staked
        uint256 amountDue,     // $KING amount to be returned
        uint256 unlockTime     // UNIX-time when the stake is unlocked
    );

    event Withdraw(
        address indexed user,
        uint256 stakeId        // ID of the NFT
    );

    event NewTermSheet(
        uint256 indexed terms, // ID of the term sheet
        address indexed nft,   // Address of the ERC-721 contract
        uint96 minAmount,      // Min $KING amount to stake
        uint32 lockSeconds,    // Staking period in seconds
        uint96 kingFactor      // See (1) above
    );

    event TermsEnabled(uint256 indexed terms);
    event TermsDisabled(uint256 indexed terms);

    constructor(address _king) public {
        king = _king;
    }

    // Stake ID uniquely identifies a stake
    // (note a limitation on nftId range supported)
    function encodeStakeId(address nft, uint256 nftId, uint256 startTime)
        public
        pure
        returns(uint256)
    {
        require(nftId < 2**32, "RDeck::nftId_EXCEEDS_64_BITS");
        return (uint256(nft) << 96) | (nftId << 32) | startTime;
    }

    function decodeStakeId(uint256 stakeId)
        public
        pure
        returns(address nft, uint256 nftId, uint256 startTime)
    {
        nft = address(stakeId >> 96);
        nftId = (stakeId >> 32) & (2**64 - 1);
        startTime = stakeId & (2**32 - 1);
    }

    function termSheet(uint256 terms) external view returns (TermSheet memory) {
        return termSheets[_validTermsID(terms)];
    }

    function stakeIds(address user) external view returns (uint256[] memory)
    {
        UserStakes storage userStakes = stakes[user];
        return userStakes.ids;
    }

    function stakeData(
        address user,
        uint256 stakeId
    ) external view returns (Stake memory) {
        return stakes[_nonZeroAddr(user)].data[stakeId];
    }

    function termsLength() external view returns (uint256) {
        return termSheets.length;
    }

    function addTerms(TermSheet[] memory _termSheets) public onlyOwner {
        for (uint256 i = 0; i < _termSheets.length; i++) {
            _addTerms(_termSheets[i]);
        }
    }

    function enableTerms(uint256 terms) external {
        termSheets[_validTermsID(terms)].enabled = true;
        emit TermsEnabled(terms);
    }

    function disableTerms(uint256 terms) external {
        termSheets[_validTermsID(terms)].enabled = false;
        emit TermsDisabled(terms);
    }

    // Deposit 1 NFT and `kingAmount` of $KING tokens
    function deposit(
        uint256 terms, // term sheet ID
        uint256 nftId, // NFT ID
        uint256 kingAmount
    ) public nonReentrant {
        TermSheet memory _termSheet = termSheets[_validTermsID(terms)];
        require(_termSheet.enabled, "deposit: terms disabled");

        uint96 amount = SafeMath96.fromUint(kingAmount);
        require(
            amount >= _termSheet.minAmount,
            "deposit: too small kingAmount"
        );

        uint256 stakeId = encodeStakeId(_termSheet.nft, nftId, now);

        IERC20(king)
            .safeTransferFrom(msg.sender, address(this), amount);
        IERC721(_termSheet.nft)
            .safeTransferFrom(msg.sender, address(this), nftId);

        UserStakes storage userStakes = stakes[msg.sender];
        uint32 startTime = SafeMath32.fromUint(now);
        uint32 unlockTime = startTime.add(_termSheet.lockSeconds);
        uint96 _amountDue = SafeMath96.fromUint(
            kingAmount.mul(uint256(_termSheet.kingFactor))
            .div(1e6)
        );
        _addUserStake(
            userStakes,
            stakeId,
            Stake(
                amount,
                _amountDue,
                startTime,
                SafeMath32.fromUint(unlockTime)
            )
        );
        amountStaked = amountStaked.add(amount);
        amountDue = amountDue.add(_amountDue);

        emit Deposit(
            msg.sender,
            stakeId,
            kingAmount,
            _amountDue,
            unlockTime
        );
    }

    // Withdraw staked 1 NFT and entire $KING token amount due
    function withdraw(uint256 stakeId) public nonReentrant {
        (address nft, uint256 nftId, ) = decodeStakeId(stakeId);

        UserStakes storage userStakes = stakes[msg.sender];
        Stake memory stake = userStakes.data[stakeId];
        require(stake.amountDue != 0, "withdraw: unknown or returned stake");
        require(now >= stake.unlockTime, "withdraw: stake is locked");

        _removeUserStake(userStakes, stakeId);
        amountStaked = amountStaked.sub(stake.amountStaked);
        amountDue = amountDue.sub(stake.amountDue);

        IERC20(king).safeTransfer(msg.sender, stake.amountDue);
        IERC721(nft).safeTransferFrom(address(this), msg.sender, nftId);

        emit Withdraw(msg.sender, stakeId);
    }

    function _addTerms(TermSheet memory tSheet) internal {
        _revertZeroAddress(tSheet.nft);
        require(
            (tSheet.minAmount != 0) &&
                (tSheet.lockSeconds != 0) &&
                (tSheet.kingFactor != 0),
            "RDeck::add:INVALID_ZERO_PARAM"
        );
        require(_isMissingTerms(tSheet), "RDeck::add:TERMS_DUPLICATED");
        termSheets.push(tSheet);

        emit NewTermSheet(
            termSheets.length - 1,
            tSheet.nft,
            tSheet.minAmount,
            tSheet.lockSeconds,
            tSheet.kingFactor
        );
        if (tSheet.enabled) emit TermsEnabled(termSheets.length);
    }

    function _safeKingTransfer(address _to, uint256 _amount) internal {
        uint256 kingBal = IERC20(king).balanceOf(address(this));
        IERC20(king).safeTransfer(_to, _amount > kingBal ? kingBal : _amount);
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
                sheet.nft == newSheet.nft &&
                sheet.minAmount == newSheet.minAmount &&
                sheet.lockSeconds == newSheet.lockSeconds &&
                sheet.kingFactor == newSheet.kingFactor
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
            userStakes.data[stakeId].amountDue == 0,
            "RDeck:DUPLICATED_NFT_ID"
        );
        userStakes.data[stakeId] = stake;
        userStakes.ids.push(stakeId);
    }

    function _removeUserStake(UserStakes storage userStakes, uint256 stakeId)
        internal
    {
        require(userStakes.data[stakeId].amountDue != 0, "RDeck:INVALID_STAKE_ID");
        userStakes.data[stakeId].amountDue = 0;
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
                    arr.pop();
                    lastIndex--;
                    arr[lastIndex] = replacing;
                } while (replaced != el && lastIndex != 0);
                return;
            }
        }
        // Remove the last (and quite probably the only) element
        arr.pop();
    }

    function _revertZeroAddress(address _address) internal pure {
        require(_address != address(0), "RDeck::ZERO_ADDRESS");
    }

    function _nonZeroAddr(address _address) private pure returns (address) {
        _revertZeroAddress(_address);
        return _address;
    }

    function _validTermsID(uint256 terms) private view returns (uint256) {
        require(terms < termSheets.length, "RDeck::INVALID_TERMS_ID");
        return terms;
    }
}
