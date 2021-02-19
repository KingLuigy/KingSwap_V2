const KingToken = artifacts.require('KingToken');
const SafeERC20Namer = artifacts.require('SafeERC20NamerWrapper');

contract('SafeERC20Namer', () => {
    beforeEach(async () => {
        this.king = await KingToken.new();
        this.util = await SafeERC20Namer.new();
    });

    it('should produce the expected token name and symbol from the token address', async () => {
        assert.equal((await this.util.getTokenName(this.king.address)).valueOf(), 'KingToken');
        assert.equal((await this.util.getTokenSymbol(this.king.address)).valueOf(), '$KING');
    });
})