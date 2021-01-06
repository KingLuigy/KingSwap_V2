pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * It accepts deposits of a pre-defined ERC-20 token(s), the "deposit" token.
 * The deposit token will be repaid with another ERC-20 token, the "repay"
 * token (e.g. a stable-coin), at a pre-defined rate.
 *
 * On top of the deposit token, a particular NFT (ERC-721) instance may be
 * required to be deposited as well. If so, this exact NFT will be returned.
 *
 * Note the `treasury` account that borrows and repays tokens.
 */
contract KingDecks is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // "Listed" (hard-coded) tokens
    address private KingAddr = 0x5a731151d6510Eb475cc7a0072200cFfC9a3bFe5;
    address private KingNftAddr = 0x4c9c971fbEFc93E0900988383DC050632dEeC71E;
    address private QueenNftAddr = 0x3068b3313281f63536042D24562896d080844c95;
    address private KnightNftAddr = 0xF85C874eA05E2225982b48c93A7C7F701065D91e;
    address private KingWerewolfNftAddr = 0x39C8788B19b0e3CeFb3D2f38c9063b03EB1E2A5a;
    address private QueenVampzNftAddr = 0x440116abD7338D9ccfdc8b9b034F5D726f615f6d;
    address private KnightMummyNftAddr = 0x91cC2cf7B0BD7ad99C0D8FA4CdfC93C15381fb2d;
    //
    address private UsdtAddr = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address private UsdcAddr = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address private DaiAddr = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address private WethAddr = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private WbtcAddr = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    // Index of extraTokens[0] in the `extraTokens` array + 1
    uint256 private constant extraTokensStartId = 33;

    enum TokenType {unknown, Erc20, Erc721, Erc1155}

    struct Token {
        address addr;
        TokenType _type;
    }

    struct DepositLimits {
        // Min token amount to deposit
        uint224 minAmount;
        // Max deposit amount multiplier, scaled by 1e+4
        // (no limit, if set to 0):
        // `maxAmount = minAmount * maxAmountFactor/1e4`
        uint32 maxAmountFactor;
    }

    struct TermSheet {
        // If depositing under this term sheet is enabled
        bool enabled;
        // ID of the ERC-20 token to deposit
        uint8 inTokenId;
        // ID of the ERC-721 token (contract) to deposit
        // (if set to 0, no ERC-721 token required)
        uint8 nfTokenId;
        // ID of the ERC-20 token to return instead of the deposited token
        uint8 outTokenId;
        // Fees on early withdrawal, in 1/256 shares of the amount withdrawn
        uint8 earlyWithdrawFees;
        // Amount allowed to withdraw early, in 1/256 "repay" amount shares
        uint8 earlyWithdrawMaxAmount;
        // ID (index in `_depositLimits` + 1) of deposit amount limits
        // (if set to 0, no limitations applied)
        uint16 limitsId;
        // Deposit period in hours
        uint16 depositHours;
        // Min time between interim (early) withdrawals
        // (if set to 0, interim withdrawals disallowed)
        uint16 minInterimHours;
        // Rate to compute the "repay" amount, scaled by 1e+6 (see (1))
        uint64 rate;
        // Bit-mask for NFT IDs (in the range 1..64) allowed to deposit
        // (if set to 0, no limitations on NFT IDs applied)
        uint64 allowedNftNumBitMask;
    }

    // On a deposit withdrawal, a user receives the "repay" token,
    // (but not the originally deposited ERC-20 token).
    // The amount, in the  "repay" token units, is calculated as:
    // `amountDue = Deposit.amount * TermSheet.rate/1e+6`         (1)

    struct Deposit {
        uint160 amountDue;      // Amount due, in "repay" token units
        uint32 repaymentTime;   // time the final withdrawal is allowed since
        uint32 lastWithdrawTime;// time of the most recent interim withdrawal
        uint16 termsId;         // Term Sheet ID (index in `_termSheets` + 1)
        uint16 nftId;           // ID of the deposited NFT instance, if any
    }

    // Deposits of a user
    struct UserDeposits {
        // Set of (unique) deposit IDs
        uint256[] ids;
        // Mapping from deposit ID to deposit data
        mapping(uint256 => Deposit) data;
    }

    // Number of deposits made so far
    uint32 public depositQty;

    // Account that controls the tokens deposited
    address public treasury;

    // Limits on "deposit" token amount
    DepositLimits[] private _depositLimits;

    // Info on each TermSheet
    TermSheet[] internal _termSheets;

    // Mappings from a "repay" token ID to the amount due
    mapping(uint256 => uint256) public amountsDue; // in "repay" token units

    // Mapping from user account to user deposits
    mapping(address => UserDeposits) internal deposits;

    // Extra tokens (addition to the hard-coded tokens list)
    Token[] private extraTokens;

    event NewDeposit(
        uint256 indexed inTokenId,
        uint256 indexed outTokenId,
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

    // termsId is the index in the `_termSheets` array + 1
    event NewTermSheet(uint256 indexed termsId);
    event TermsEnabled(uint256 indexed termsId);
    event TermsDisabled(uint256 indexed termsId);

    constructor(address _treasury) public {
        _setTreasury(_treasury);
    }

    // Note, `serialNum` identifies a deposit, rest is for gas saving & UI sake
    function encodeDepositId(
        uint256 serialNum,     // Unique (incremental) ID
        uint256 outTokenId,    // ID of the ERC-20 to repay deposit in
        uint256 nfTokenId,     // ID of the (contract of) deposited ERC-721
        uint256 nftId          // ID of the deposited NFT instance
    ) public pure returns (uint256 depositId) {
        depositId = serialNum<<32 | outTokenId<<24 | nfTokenId<<16 | nftId;
    }

    function getTokenData(
        uint256 tokenId
    ) external view returns(address, TokenType) {
        return _token(uint8(tokenId));
    }

    function decodeDepositId(uint256 depositId) public pure
    returns (
        uint256 serialNum,
        uint8 outTokenId,
        uint8 nfTokenId,
        uint16 nftId
    ) {
        serialNum = depositId >> 32;
        outTokenId = uint8(depositId >> 24);
        nfTokenId = uint8(depositId >> 16);
        nftId = uint16(depositId);
    }

    function depositIds(
        address user
    ) external view returns (uint256[] memory) {
        _revertZeroAddress(user);
        UserDeposits storage userDeposits = deposits[user];
        return userDeposits.ids;
    }

    function depositData(
        address user,
        uint256 depositId
    ) external view returns (Deposit memory) {
        return deposits[_nonZeroAddr(user)].data[depositId];
    }

    function termSheet(
        uint256 termsId
    ) external view returns (TermSheet memory) {
        return _termSheets[_validTermsID(termsId) - 1];
    }

    function termSheetsNum() external view returns (uint256) {
        return _termSheets.length;
    }

    function allTermSheets() external view returns(TermSheet[] memory) {
        return _termSheets;
    }

    function depositLimits(
        uint256 limitsId
    ) external view returns (DepositLimits memory) {
        return _depositLimits[_validLimitsID(limitsId) - 1];
    }

    function depositLimitsNum() external view returns (uint256) {
        return _depositLimits.length;
    }

    function allDepositLimits() external view returns(DepositLimits[] memory)
    {
        return _depositLimits;
    }

    function deposit(
        uint256 termsId,    // term sheet ID
        uint256 amount,     // amount in deposit token units
        uint256 nftId       // ID of the NFT instance (0 if no NFT required)
    ) public nonReentrant {
        TermSheet memory tS = _termSheets[_validTermsID(termsId) - 1];
        require(tS.enabled, "KDecks:terms disabled or unknown");

        if (tS.limitsId != 0) {
            DepositLimits memory l = _depositLimits[tS.limitsId - 1];
            require(amount >= l.minAmount, "KDecks:too small deposit amount");
            if (l.maxAmountFactor != 0) {
                require(
                    amount <=
                        uint256(l.minAmount).mul(l.maxAmountFactor).div(1e4),
                    "KDecks:too big deposit amount"
                );
            }
        }

        uint256 serialNum = depositQty + 1;
        depositQty = uint32(serialNum); // overflow risk ignored

        uint256 depositId = encodeDepositId(
            serialNum,
            tS.outTokenId,
            tS.nfTokenId,
            nftId
        );

        uint256 amountDue = amount.mul(tS.rate).div(1e6);
        require(amountDue < 2**160, "KDecks:O2");
        uint32 repaymentTime = safe32(now.add(uint256(tS.depositHours) * 3600));

        if (tS.nfTokenId == 0) {
            require(nftId == 0, "KDecks:unexpected non-zero nftId");
        } else {
            require(
                nftId < 2**16 &&
                _isAllowedNftId(nftId, tS.allowedNftNumBitMask),
                "KDecks:disallowed NFT instance"
            );
            IERC721(_tokenAddr(tS.nfTokenId))
                .safeTransferFrom(msg.sender, address(this), nftId, _NFT_PASS);
        }

        IERC20(_tokenAddr(tS.inTokenId))
            .safeTransferFrom(msg.sender, treasury, amount);

        _registerDeposit(
            deposits[msg.sender],
            depositId,
            Deposit(
                uint160(amountDue),
                repaymentTime,
                safe32(now),
                uint16(termsId),
                uint8(nftId)
            )
        );
        amountsDue[tS.outTokenId] = amountsDue[tS.outTokenId].add(amountDue);

        emit NewDeposit(
            tS.inTokenId,
            tS.outTokenId,
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

    // Early withdrawal of the unlocked "repay" token amount (beware of fees!!)
    function interimWithdraw(uint256 depositId) public nonReentrant {
        _withdraw(depositId, true);
    }

    function addTerms(TermSheet[] memory termSheets) public onlyOwner {
        for (uint256 i = 0; i < termSheets.length; i++) {
            _addTermSheet(termSheets[i]);
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

    function addLimits(DepositLimits[] memory limits) public onlyOwner {
        for (uint256 i = 0; i < limits.length; i++) {
            _addLimit(limits[i]);
        }
    }

    function addExtraErc20Tokens(
        address[] memory addresses,
        TokenType[] memory types
    ) external onlyOwner {
        require(
            addresses.length + extraTokens.length + extraTokensStartId <= 256,
            "KDecks:TOO_MANY_TOKENS"
        );
        for (uint256 i = 0; i < addresses.length; i++) {
            require(addresses[i] != address(0), "KDecks:INVALID_TOKEN_ADDRESS");
            require(types[i] != TokenType.unknown, "KDecks:INVALID_TOKEN_TYPE");
            extraTokens.push(Token(addresses[i], types[i]));
        }
    }

    function setTreasury(address _treasury) public onlyOwner {
        _setTreasury(_treasury);
    }

    // Save occasional airdrop or mistakenly transferred tokens
    function transferFromContract(IERC20 token, uint256 amount, address to)
        external
        onlyOwner
    {
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
        returns (bytes4)
    {
        // Only accept transfers with _NFT_PASS passed as `data`
        return (data.length == 4 && data[0] == 0xb0 && data[3] == 0xdd)
        ? _ERC721_RECEIVED
        : bytes4(0);
    }

    function _tokenAddr(uint8 tokenId) internal view returns(address) {
        (address addr, ) = _token(tokenId);
        return addr;
    }

    function _token(
        uint8 tokenId
    ) internal view returns(address, TokenType) {
        if (tokenId < extraTokensStartId) return _listedToken(tokenId);

        uint256 i = tokenId - extraTokensStartId;
        Token memory token = extraTokens[i];
        return (token.addr, token._type);
    }

    // Declared "virtual" to facilitate tests
    function _listedToken(
        uint8 tokenId
    ) internal view virtual returns(address, TokenType) {
        if (tokenId == 1) return (KingAddr, TokenType.Erc20);
        if (tokenId == 2) return (UsdtAddr, TokenType.Erc20);
        if (tokenId == 3) return (UsdcAddr, TokenType.Erc20);
        if (tokenId == 4) return (DaiAddr, TokenType.Erc20);
        if (tokenId == 5) return (WethAddr, TokenType.Erc20);
        if (tokenId == 6) return (WbtcAddr, TokenType.Erc20);

        if (tokenId == 16) return (KingNftAddr, TokenType.Erc721);
        if (tokenId == 17) return (QueenNftAddr, TokenType.Erc721);
        if (tokenId == 18) return (KnightNftAddr, TokenType.Erc721);
        if (tokenId == 19) return (KingWerewolfNftAddr, TokenType.Erc721);
        if (tokenId == 20) return (QueenVampzNftAddr, TokenType.Erc721);
        if (tokenId == 21) return (KnightMummyNftAddr, TokenType.Erc721);

        return (address(0), TokenType.unknown);
    }

    function _withdraw(uint256 depositId, bool isInterim) internal {
        UserDeposits storage userDeposits = deposits[msg.sender];
        Deposit memory _deposit = userDeposits.data[depositId];

        require(_deposit.amountDue != 0, "KDecks:unknown or repaid deposit");

        uint256 amountToUser;
        uint256 amountDue = 0;
        uint256 fees = 0;

        ( , uint8 outTokenId, uint8 nfTokenId, ) = decodeDepositId(depositId);
        if (isInterim) {
            TermSheet memory tS = _termSheets[_deposit.termsId - 1];
            require(
                tS.minInterimHours != 0 &&
                    now >= _deposit.lastWithdrawTime + tS.minInterimHours * 3600,
                "KDecks:withdrawal not yet allowed"
            );
            // FIXME: calculate early withdraw fees
            // fees = f(tS: earlyWithdrawFees, depositHours, _deposit: lastWithdrawTime, repaymentTime)
            // FIXME: calculate early withdraw amount
            // amountToUser = f(tS.earlyWithdrawMaxAmount, depositHours, _deposit: lastWithdrawTime, repaymentTime)
            amountDue = uint256(_deposit.amountDue).sub(amountToUser).sub(fees);
            emit InterimWithdraw(msg.sender, depositId, amountToUser, fees);
        } else {
            require(now >= _deposit.repaymentTime, "KDecks:deposit is locked");
            amountToUser = uint256(_deposit.amountDue);

            if (_deposit.nftId != 0) {
                IERC721(_tokenAddr(nfTokenId)).safeTransferFrom(
                    address(this),
                    msg.sender,
                    _deposit.nftId,
                    _NFT_PASS
                );
            }
            _deregisterDeposit(userDeposits, depositId);
            emit Withdraw(msg.sender, depositId, amountToUser);
        }

        _deposit.lastWithdrawTime = safe32(now);
        _deposit.amountDue = uint160(amountDue);
        userDeposits.data[depositId] = _deposit;

        amountsDue[outTokenId] = amountsDue[outTokenId].sub(amountToUser).sub(fees);

        IERC20(outTokenId).safeTransferFrom(treasury, msg.sender, amountToUser);
    }

    function _addTermSheet(TermSheet memory tS) internal {
        ( , TokenType _type) = _token(tS.inTokenId);
        require(_type == TokenType.Erc20, "KDecks:INVALID_DEPOSIT_TOKEN");
        ( , _type) = _token(tS.outTokenId);
        require(_type == TokenType.Erc20, "KDecks:INVALID_REPAY_TOKEN");
        if (tS.nfTokenId != 0) {
            (, _type) = _token(tS.nfTokenId);
            require(_type == TokenType.Erc721, "KDecks:INVALID_NFT_TOKEN");
        }

        if (tS.limitsId != 0) _validLimitsID(tS.limitsId);
        require(
             tS.depositHours != 0 && tS.rate != 0,
            "KDecks:INVALID_ZERO_PARAM"
        );
        require(_isMissingTerms(tS), "KDecks:TERMS_DUPLICATED");

        // Risk of termsId (16 bits) overflow ignored
        _termSheets.push(tS);

        emit NewTermSheet(_termSheets.length);
        if (tS.enabled) emit TermsEnabled(_termSheets.length);
    }

    function _addLimit(DepositLimits memory l) internal {
        require(l.minAmount != 0, "KDecks:INVALID_minAmount");
        _depositLimits.push(l);
    }

    // Returns `true` if the term sheet has NOT been yet added.
    function _isMissingTerms(
        TermSheet memory newSheet
    ) internal view returns (bool) {
        for (uint256 i = 1; i <= _termSheets.length; i++) {
            TermSheet memory sheet = _termSheets[i];
            if (
                sheet.inTokenId == newSheet.inTokenId &&
                sheet.outTokenId == newSheet.outTokenId &&
                sheet.nfTokenId == newSheet.nfTokenId &&
                sheet.allowedNftNumBitMask == newSheet.allowedNftNumBitMask &&
                sheet.limitsId == newSheet.limitsId &&
                sheet.depositHours == newSheet.depositHours &&
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

    function _registerDeposit(
        UserDeposits storage userDeposits,
        uint256 depositId,
        Deposit memory _deposit
    ) internal {
        userDeposits.data[depositId] = _deposit;
        userDeposits.ids.push(depositId);
    }

    function _deregisterDeposit(
        UserDeposits storage userDeposits,
        uint256 depositId
    ) internal {
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
