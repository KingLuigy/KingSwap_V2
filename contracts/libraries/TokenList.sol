pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

contract TokenList {

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

    // Index of _extraTokens[0] + 1
    uint256 private constant extraTokensStartId = 33;

    enum TokenType {unknown, Erc20, Erc721, Erc1155}

    struct Token {
        address addr;
        TokenType _type;
    }

    // Extra tokens (addition to the hard-coded tokens list)
    Token[] private _extraTokens;

    // Declared "internal virtual" to let tests (mocks) re-define it
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

    function _tokenAddr(uint8 tokenId) internal view returns(address) {
        (address addr, ) = _token(tokenId);
        return addr;
    }

    function _token(
        uint8 tokenId
    ) internal view returns(address, TokenType) {
        if (tokenId < extraTokensStartId) return _listedToken(tokenId);

        uint256 i = tokenId - extraTokensStartId;
        Token memory token = _extraTokens[i];
        return (token.addr, token._type);
    }

    function _addTokens(
        address[] memory addresses,
        TokenType[] memory types
    ) internal {
        require(
            addresses.length + _extraTokens.length + extraTokensStartId <= 256,
            "TokList:TOO_MANY_TOKENS"
        );
        for (uint256 i = 0; i < addresses.length; i++) {
            require(addresses[i] != address(0), "TokList:INVALID_TOKEN_ADDRESS");
            require(types[i] != TokenType.unknown, "TokList:INVALID_TOKEN_TYPE");
            _extraTokens.push(Token(addresses[i], types[i]));
        }
    }
}
