const { time } = require('@openzeppelin/test-helpers');
const Archbishop = artifacts.require('Archbishop');
const KingToken = artifacts.require('KingToken');
const KingLock = artifacts.require('KingLock');

contract('KingLock', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.king = await KingToken.new({ from: alice });
        this.testStartBlock = parseInt(await web3.eth.getBlockNumber());
        this.bishop = await Archbishop.new(this.king.address, bob, '1000', `${this.testStartBlock}`, { from: alice });
        this.kingLock = await KingLock.new(this.king.address, this.bishop.address, { from: alice });
    });

    it('should deposit KingLock Token success', async () => {
        const totalSupply = await this.kingLock.totalSupply();
        assert.equal(totalSupply.valueOf(), '1');
        await this.king.transferOwnership(this.bishop.address, { from: alice });
        await this.bishop.add('100', this.kingLock.address, false);
        await time.advanceBlockTo(`${this.testStartBlock + 8}`);
        await this.kingLock.deposit('0', { from: alice });
        await time.advanceBlockTo(`${this.testStartBlock + 10}`);
        assert.equal((await this.bishop.pendingKing(0, this.kingLock.address)).valueOf(), '6400');
        await this.kingLock.withdrawFromArchbishop('0', { from: alice });
        assert.equal((await this.king.balanceOf(this.kingLock.address)).valueOf(), '12800');

        await this.kingLock.setwithdrawContractAddr(carol);
        assert.equal((await this.kingLock.withDrawAddr()).valueOf(), carol);

        await this.kingLock.withdrawToContract(50);
        assert.equal((await this.king.balanceOf(this.kingLock.address)).valueOf(), '12750');
        assert.equal((await this.king.balanceOf(carol)).valueOf(), '50');
    });
})
