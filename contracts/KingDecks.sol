pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../KingSwap_Private/contracts/kingswap/interfaces/IERC20.sol";

/**
 * It accepts deposits of a pre-defined ERC-20 token(s), the "deposit" token.
 * The deposit token will be repaid with another ERC-20 token, the "repay"
 * token (e.g. a stable-coin) at a pre-defined rate.
 *
 * On top of the deposit token, a particular NFT (ERC-721) may be required to
 * be deposited as well. In this case, this exact NFT instance will be returned.
 *
 * Note the `treasury` account that borrows and repays tokens.
 */
contract KingDecks is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    enum TokenType {unknown, Erc20, Erc721, Erc1155}

    struct Token {
        address addr;
        TokenType type;
    }

    // List of main (hard-coded) tokens
    // FIXME: update token zero addresses
    address private KingAddr = 0x5a731151d6510Eb475cc7a0072200cFfC9a3bFe5;
    address private KingNftAddr = 0;
    address private QueenNftAddr = 0;
    address private KnightNftAddr = 0;
    address private KingWerewolfNftAddr = 0;
    address private QueenVampzNftAddr = 0;
    address private KnightMummyNftAddr = 0;
    address private UsdtAddr = 0xdac17f958d2ee523a2206206994597c13d831ec7;
    address private UsdcAddr = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48;
    address private DaiAddr = 0x6b175474e89094c44da98b954eedeac495271d0f;
    address private WethAddr = 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2;
    address private WbtcAddr = 0x2260fac5e5542a773aa44fbcfedf7c193bc2c599;

    // Extra tokens (addition to the hard-coded tokens list)
    Token[] private extraTokens;
    // ID of extraTokens[0]
    uint256 extraTokensStartId = 32;

    function getTokenData(
        uint256 tokenId
    ) external view returns(address, TokenType) {
        return _token(uint8(tokenId));
    }

    function addExtraErc20Tokens(
        address[] addresses,
        TokenType[] types
    ) external onlyOwner {
        require(
            addresses.length + extraTokens.length + extraTokensStartId < 256,
            "too many tokens to add"
        );
        for (uint256 i = 0; i < addresses.length; i++) {
            require(addresses[i] != address(0), "invalid token address");
            require(types[i] != TokenType.unknown, "invalid token type");
            extraTokens.push(Token(addresses[i], types[i]));
        }
    }

    // Declared "virtual" to facilitate tests
    function _token(
        uint8 tokenId
    ) internal view virtual returns(address, TokenType) {
        if (tokenId == 1) return (KingAddr, TokenType.Erc20);
        if (tokenId == 2) return (UsdtAddr, TokenType.Erc20);
        if (tokenId == 3) return (UsdcAddr, TokenType.Erc20);
        if (tokenId == 4) return (DaiAddr, TokenType.Erc20);
        if (tokenId == 5) return (WethAddr, TokenType.Erc20);
        if (tokenId == 6) return (WbtcAddr, TokenType.Erc20);

        if (tokenId = 16) return (KingNftAddr, TokenType.Erc721);
        if (tokenId = 17) return (QueenNftAddr, TokenType.Erc721);
        if (tokenId = 18) return (KnightNftAddr, TokenType.Erc721);
        if (tokenId = 19) return (KingWerewolfNftAddr, TokenType.Erc721);
        if (tokenId = 20) return (QueenVampzNftAddr, TokenType.Erc721);
        if (tokenId = 21) return (KnightMummyNftAddr, TokenType.Erc721);

        if (tokenId >= extraTokensStartId) {
            uint256 i = tokenId - extraTokensStartId;
            Token memory token = extraTokens[i];
            return (token.addr, token.type);
        }

        return (address(0), TokenType.unknown);
    }

    // On a deposit withdrawal, a user receives the "repay" token,
    // (but not the originally deposited ERC-20 token).
    // The amount, in the  "repay" token units, is calculated as:
    // `amountDue = Deposit.amount * TermSheet.rate/1e+6`         (1)

    struct DepositLimits {
        // Min token amount to deposit
        uint224 minAmount;
        // Max deposit amount multiplier, scaled by 1e+4
        // (no limit, if set to 0):
        // `maxAmount = minAmount * maxAmountFactor/1e4`
        uint32 maxAmountFactor;
    }

    struct TermSheet {
        // Rate to compute the "repay" amount, scaled by 1e+6 (see (1))
        uint32 rate;
        // ID (index in `_depositLimits` + 1) of deposit amount limits
        // (no limitation, if 0)
        uint16 limitsId;
        // Deposit period in hours
        uint16 lockHours;
        // Min time between interim partial withdrawals
        // (set to 0 to disallow interim withdrawals)
        uint16 minInterimHours;
        // ID of the ERC-20 token to deposit
        uint8 depositTokenId;
        // ID of the ERC-20 token to return (instead of the deposited token)
        uint8 repayTokenId;
        // ID of the ERC-721 token (contract) to deposit
        // (no ERC-721 token required, if set to 0)
        uint8 nftTokenId;
        // Bit-mask for NFT numbers allowed to deposit
        // (no limitations on NFT numbers, if set to 0)
        uint64 allowedNftNumBitMask;
        // If depositing under this term sheet are enabled
        bool enabled;
    }

    struct Deposit {
        uint208 amount;         // Amount deposited, in "deposit" token units
        uint32 repaymentTime;   // time the final withdrawal is allowed since
        uint16 termsId;         // Term Sheet ID (index in `_termSheets` + 1)
        uint208 amountDue;      // Amount due, in "repay" token units
        uint32 lastWithdrawTime;// time of the most recent interim withdrawal
        uint16 nftId;           // ID of the deposited NFT instance, if any
    }

    // Deposits of a user
    struct UserDeposits {
        // Set of (unique) deposit IDs
        uint256[] ids;
        // Mapping from deposit ID to deposit data
        mapping(uint256 => Deposit) data;
    }

    // Emergency fees factor, scaled by 1e+4:
    // `fees = amountDue * emergencyFeesFactor / 1e+4`
    uint16 public emergencyFeesFactor = 500; // i.e. 5%

    // Number of deposits made so far
    uint32 public depositQty;

    // Account that controls the tokens deposited
    address public treasury;

    // Limits on "deposit" token amount
    DepositLimits[] private _depositLimits;

    // Info on each TermSheet
    TermSheet[] internal _termSheets;

    // Mappings from a deposited token contract ID to the amount deposited
    mapping(uint256 => uint256) public amountsDeposited; // in token units
    // Mappings from a deposited token ID to the amount due
    mapping(uint256 => uint256) public amountsDue; // in "repay" token units

    // Mapping from user account to user deposits
    mapping(address => UserDeposits) internal deposits;

    event Deposit(
        uint256 indexed depositToken,
        uint256 indexed repaymentToken,
        address indexed user,
        uint256 depositId,
        uint256 termsId,
        uint256 amount, // amount deposited (in deposit token units)
        uint256 amountDue, // amount to be returned (in "repay" token units)
        uint256 repaymentTime // UNIX-time when the deposit is unlocked
    );

    // User withdraws the deposit
    event Withdraw(
        address indexed user,
        uint256 depositId,
        uint256 amount // amount sent to user (in deposit token units)
    );

    event InterimWithdraw(
        address indexed user,
        uint256 depositId,
        uint256 amount, // amount sent to user (in "repay" token units)
        uint256 fees // withheld fees (in "repay" token units)
    );

    event NewTermSheet(
        uint256 indexed termsId // index in the `_termSheets` array + 1
    );
    event TermsEnabled(uint256 indexed termsId);
    event TermsDisabled(uint256 indexed termsId);

    constructor(address _treasury) public {
        _setTreasury(_treasury);
    }

    function depositIds(address user) external view returns (uint256[] memory) {
        _revertZeroAddress(user);
        UserDeposits storage userDeposits = deposits[user];
        return userDeposits.ids;
    }

    function depositData(address user, uint256 depositId)
        external
        view
        returns (Deposit memory)
    {
        return deposits[_nonZeroAddr(user)].data[depositId];
    }

    function getAmountDue(address user, uint256 depositId)
        external
        view
        returns (uint256 amount) // in "repay" token units
    {
        Deposit memory deposit = deposits[_nonZeroAddr(user)].data[depositId];
        return deposit.amountDue;
    }

    function termSheet(uint256 termsId)
        external
        view
        returns (TermSheet memory)
    {
        return _termSheets[_validTermsID(termsId) - 1];
    }

    function termSheetsNum() external view returns (uint256) {
        return _termSheets.length;
    }

    function allTermSheets() external view returns(TermSheet[] memory) {
        return _termSheets;
    }

    function depositLimits(uint256 limitsId)
    external
    view
    returns (TermSheet memory)
    {
        return _depositLimits[_validLimitsID(limitsId) - 1];
    }

    function depositLimitsNum() external view returns (uint256) {
        return _depositLimits.length;
    }

    function allDepositLimits() external view returns(DepositLimits[] memory) {
        return _depositLimits;
    }

    function deposit(
        uint256 termsId,    // term sheet ID
        uint256 amount,     // amount in deposit token units
        uint256 nftId       // ID of the NFT instance (0 if no NFT required)
    ) public nonReentrant
    {
        TermSheet memory tS = _termSheets[_validTermsID(termsId) - 1];
        require(tS.enabled, "deposit: terms disabled or unknown");

        uint256 amountDue = amount.mul(tS.rate).div(1e6);
        require(amount < 2**208, "KDecks:O1");
        require(amountDue < 2**208, "KDecks:O2");

        if (tS.limitsId != 0) {
            DepositLimits memory l = _depositLimits[tS.limitsId - 1];
            require(amount >= l.minAmount, "deposit: too small amount");
            if (limits.maxAmountFactor != 0) {
                require(
                    amount <= uint256(l.minAmount).mul(l.maxAmountFactor).div(1e4),
                    "deposit: too big amount"
                );
            }
        }

        uint256 depositId = depositQty + 1;

        uint32 repaymentTime = safe32(now.add(uint256(tS.lockHours) * 3600));

        if (tS.nftTokenId == 0) {
            require(nftId == 0, "deposit: unexpected non-zero nftId");
        } else {
            require(
                _isAllowedNftId(nftId, tS.allowedNftNumBitMask),
                "deposit: disallowed NFT instance"
            );

            Token memory token = _token(tS.nftTokenId);
            IERC721(token.addr).safeTransferFrom(
                msg.sender,
                address(this),
                nftId,
                _NFT_PASS
            );
        }

        Token memory token = _token(tS.depositTokenId);
        IERC20(token.addr).safeTransferFrom(msg.sender, treasury, amount);

        _addUserDeposit(
            deposits[msg.sender],
            depositId,
            Deposit(
                uint208(amount),
                repaymentTime,
                uint16(termsId),
                uint208(amountDue),
                safe32(now),
                uint16(nftId)
            )
        );
        depositQty = uint32(depositId); // overflow risk ignored
        amountsDeposited[tS.depositTokenId] = amountsDeposited[tS.depositTokenId].add(amount);
        amountsDue[tS.repayTokenId] = amountsDue[tS.repayTokenId].add(amountDue);

        emit Deposit(
            tS.depositTokenId,
            tS.repayTokenId,
            msg.sender,
            depositId,
            termsId,
            amount,
            amountDue,
            repaymentTime
        );
    }

    // Entirely withdraw the deposit (when the deposit period ends)
    function withdraw(uint256 depositId) public nonReentrant {
        _withdraw(depositId, false);
    }

    // Interim withdrawal of the unlocked "repay" token amount
    // (!!! note, early withdrawal fees get charged)
    function interimWithdraw(uint256 depositId) public nonReentrant {
        _interimWithdraw(depositId);
    }

    function addTerms(TermSheet[] memory _termSheets) public onlyOwner {
        for (uint256 i = 0; i < _termSheets.length; i++) {
            _addTermSheet(_termSheets[i]);
        }
    }

    function enableTerms(uint256 termsId) external onlyOwner {
        _termSheets[_validTermsID(termsId) - 1].enabled = true;
        emit TermsEnabled(termsId);
    }

    function disableTerms(uint256 termsId) external onlyOwner {
        _termSheets[_validTermsID(termsId) - 1].enabled = false;
        emit TermsDisabled(termsId);
    }

    function setEmergencyFeesFactor(uint256 factor) external onlyOwner {
        require(factor < 5000, "KDecks:INVALID_factor"); // less then 50%
        emergencyFeesFactor = uint16(factor);
        emit EmergencyFactor(factor);
    }

    function setTreasury(address _treasury) public onlyOwner {
        _setTreasury(_treasury);
    }

    // Save occasional airdrop or mistakenly transferred tokens
    function transferFromContract(
        IERC20 token,
        uint256 amount,
        address to
    ) external onlyOwner {
        _revertZeroAddress(to);
        token.safeTransfer(to, amount);
    }

    // Equals to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
    bytes4 private constant _ERC721_RECEIVED = 0x150b7a02;
    // Equals to `bytes4(keccak256("KingDecks"))`
    bytes private constant _NFT_PASS = abi.encodePacked(bytes4(0xb0e68bdd));

    // Implementation of the ERC721 Receiver
    function onERC721Received(address, address, uint256, bytes calldata data)
    external
    returns (bytes4) {
        // Only accept transfers with _NFT_PASS passed as `data`
        return (data.length == 4 && data[0] == 0xb0 && data[3] == 0xdd)
        ? _ERC721_RECEIVED
        : bytes4(0);
    }

    function _withdraw(uint256 depositId, bool isInterim) internal {
        address token = _tokenFromId(depositId);
        UserDeposits storage userDeposits = deposits[msg.sender];
        Deposit memory deposit = userDeposits.data[depositId];

        require(deposit.amountDue != 0, "KDecks:unknown or repaid deposit");
        (uint256 amountDue, uint256 reward) = _amountDueOn(deposit, now);

        uint256 amountToUser;
        if (isInterim) {
            uint256 fees = deposit.amount.mul(emergencyFeesFactor).div(1e4);
            amountToUser = deposit.amount.sub(fees);
            emit InterimWithdraw(
                msg.sender,
                depositId,
                amountToUser,
                reward,
                fees
            );
        } else {
            require(now >= deposit.repaymentTime, "withdraw: deposit is locked");
            amountToUser = amountDue;
            emit Withdraw(msg.sender, depositId, amountToUser);
        }

        if (now > deposit.lastWithdrawTime) {
            userDeposits.data[depositId].lastWithdrawTime = safe32(now);
        }

        _removeUserDeposit(userDeposits, depositId);
        amountsDeposited[token] = amountsDeposited[token].sub(deposit.amount);
        amountsDue[token] = amountsDue[token].sub(amountDue);

        IERC20(token).safeTransferFrom(treasury, msg.sender, amountToUser);
    }

    function _interimWithdraw(uint256 depositId) internal {
        address token = _tokenFromId(depositId);
        UserDeposits storage userDeposits = deposits[msg.sender];
        Deposit memory deposit = userDeposits.data[depositId];
        require(deposit.amountDue != 0, "KDecks:unknown or returned deposit");
        require(deposit.minInterimHours != 0, "KDecks:reward is locked");

        uint256 allowedTime = deposit.lastWithdrawTime +
            deposit.minInterimHours *
            3600;
        require(now >= allowedTime, "KDecks:withdrawal not yet allowed");

        (, uint256 reward) = _amountDueOn(deposit, now);
        if (reward == 0) return;

        deposits[msg.sender].data[depositId].lastWithdrawTime = safe32(now);
        amountsDue[token] = amountsDue[token].sub(reward);

        IERC20(token).safeTransferFrom(treasury, msg.sender, reward);
        emit Reward(msg.sender, depositId, reward);
    }

    function _amountDueOn (Deposit memory deposit, uint256 timestamp)
        internal
        pure
        returns (uint256 totalDue, uint256 rewardAccrued)
    {
        totalDue = deposit.amount;
        rewardAccrued = 0;
        if (
            (deposit.amountDue != 0) &&
            (timestamp > deposit.lastWithdrawTime) &&
            (deposit.lastWithdrawTime < deposit.repaymentTime)
        ) {
            uint256 end = timestamp > deposit.repaymentTime
                ? deposit.repaymentTime
                : timestamp;
            uint256 fullyDue = deposit.amount.mul(deposit.rate).div(1e6);

            rewardAccrued = fullyDue
                .sub(deposit.amount)
                .mul(end.sub(deposit.lastWithdrawTime))
                .div(uint256(deposit.lockHours) * 3600);
            totalDue = totalDue.add(rewardAccrued);
        }
    }

    function _addTermSheet(TermSheet memory tS) internal {
        _revertZeroAddress(tS.depositTokenId);
        Token memory token = _token(tS.depositTokenId);
        require(
            token.type == TokenType.Erc20,
            "KDecks:add:INVALID_DEPOSIT_TOKEN"
        );

        _revertZeroAddress(tS.repayTokenId);
        token = _token(tS.repayTokenId);
        require(
            token.type == TokenType.Erc20,
            "KDecks:add:INVALID_REPAY_TOKEN"
        );

        if (tS.nftTokenId != 0) {
            token = _token(tS.nftTokenId);
            require(
                token.type == TokenType.Erc721,
                "KDecks:add:INVALID_NFT_TOKEN"
            );
        }

        require(
            tS.minAmount != 0 && tS.lockHours != 0 && tS.rate >= 1e6,
            "KDecks:add:INVALID_ZERO_PARAM"
        );
        require(_isMissingTerms(tS), "KDecks:add:TERMS_DUPLICATED");

        // Risk of termsId (16 bits) overflow ignored
        _termSheets.push(tS);

        emit NewTermSheet(
            _termSheets.length,
            tS.token,
            tS.minAmount,
            tS.maxAmountFactor,
            tS.lockHours,
            tS.minInterimHours,
            tS.rate
        );
        if (tS.enabled) emit TermsEnabled(_termSheets.length);
    }

    // Returns `true` if the term sheet has NOT been yet added.
    function _isMissingTerms(TermSheet memory newSheet)
        internal
        view
        returns (bool)
    {
        for (uint256 i = 1; i <= _termSheets.length; i++) {
            TermSheet memory sheet = _termSheets[i];
            if (
                sheet.depositTokenId == newSheet.depositTokenId &&
                sheet.repayTokenId == newSheet.repayTokenId &&
                sheet.nftTokenId == newSheet.nftTokenId &&
                sheet.allowedNftNumBitMask == newSheet.allowedNftNumBitMask &&
                sheet.minAmount == newSheet.minAmount &&
                sheet.maxAmountFactor == newSheet.maxAmountFactor &&
                sheet.lockHours == newSheet.lockHours &&
                sheet.minInterimHours == newSheet.minInterimHours &&
                sheet.rate == newSheet.rate
            ) {
                return false;
            }
        }
        return true;
    }

    function _isAllowedNftId(
        uint256 nftId,
        uint256 allowedBitMask
    ) internal pure returns(bool) {
        if (allowedBitMask == 0) return true;
        uint256 idBitMask = nftId == 1 ? 1 : (2 << (nftId - 2));
        return (allowedBitMask & idBitMask) != 0;
    }

    function _addUserDeposit(
        UserDeposits storage userDeposits,
        uint256 depositId,
        Deposit memory deposit
    ) internal {
        require(
            userDeposits.data[depositId].amount == 0,
            "KDecks:DUPLICATED_DEPOSIT_ID"
        );
        userDeposits.data[depositId] = deposit;
        userDeposits.ids.push(depositId);
    }

    function _removeUserDeposit(UserDeposits storage userDeposits, uint256 depositId)
    internal
    {
        require(
            userDeposits.data[depositId].amount != 0,
            "KDecks:INVALID_DEPOSIT_ID"
        );
        userDeposits.data[depositId].amountDue = 0;
        _removeArrayElement(userDeposits.ids, depositId);
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

    function _setTreasury(address _treasury) internal {
        _revertZeroAddress(_treasury);
        treasury = _treasury;
    }

    function _revertZeroAddress(address _address) private pure {
        require(_address != address(0), "KDecks:ZERO_ADDRESS");
    }

    function _nonZeroAddr(address _address) private pure returns (address) {
        _revertZeroAddress(_address);
        return _address;
    }

    function _validTermsID(uint256 termsId) private view returns (uint256) {
        require(
            termsId != 0 && termsId <= _termSheets.length,
            "KDecks:INVALID_TERMS_ID"
        );
        return termsId;
    }

    function _validLimitsID(uint256 limitsId) private view returns (uint256) {
        require(
            limitsId != 0 && limitsId <= _depositLimits.length,
            "KDecks:INVALID_LIMITS_ID"
        );
        return limitsId;
    }

    function safe32(uint256 n) private pure returns (uint32) {
        require(n < 2**32, "KDecks:UNSAFE_UINT32");
        return uint32(n);
    }
}
