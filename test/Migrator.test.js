const { expectRevert } = require('@openzeppelin/test-helpers');
const KingToken = artifacts.require('KingToken');
const Archbishop = artifacts.require('Archbishop');
const MockERC20 = artifacts.require('MockERC20');
const KingSwapPair = artifacts.require('KingSwapPair');
const KingSwapFactory = artifacts.require('KingSwapFactory');
const Migrator = artifacts.require('Migrator');

contract('Migrator', ([alice, bob, dev, minter]) => {
    beforeEach(async () => {
        this.factory1 = await KingSwapFactory.new(alice, { from: alice });
        this.factory2 = await KingSwapFactory.new(alice, { from: alice });
        this.king = await KingToken.new({ from: alice });
        this.weth = await MockERC20.new('WETH', 'WETH', '100000000', { from: minter });
        this.token = await MockERC20.new('TOKEN', 'TOKEN', '100000000', { from: minter });
        this.lp1 = await KingSwapPair.at((await this.factory1.createPair(this.weth.address, this.token.address)).logs[0].args.pair);
        this.lp2 = await KingSwapPair.at((await this.factory2.createPair(this.weth.address, this.token.address)).logs[0].args.pair);
        this.bishop = await Archbishop.new(this.king.address, dev, '1000', '0', { from: alice });
        this.migrator = await Migrator.new(this.bishop.address, this.factory1.address, this.factory2.address, '0');
        await this.king.transferOwnership(this.bishop.address, { from: alice });
        await this.bishop.add('100', this.lp1.address, true, { from: alice });
    });

    it('should do the migration successfully', async () => {
        await this.token.transfer(this.lp1.address, '10000000', { from: minter });
        await this.weth.transfer(this.lp1.address, '500000', { from: minter });
        await this.lp1.mint(minter);
        assert.equal((await this.lp1.balanceOf(minter)).valueOf(), '2235067');
        // Add some fake revenue
        await this.token.transfer(this.lp1.address, '100000', { from: minter });
        await this.weth.transfer(this.lp1.address, '5000', { from: minter });
        await this.lp1.sync();
        await this.lp1.approve(this.bishop.address, '100000000000', { from: minter });
        await this.bishop.deposit('0', '2000000', { from: minter });
        assert.equal((await this.lp1.balanceOf(this.bishop.address)).valueOf(), '2000000');
        await expectRevert(this.bishop.migrate(0), 'migrate: no migrator');
        await this.bishop.setMigrator(this.migrator.address, { from: alice });
        await expectRevert(this.bishop.migrate(0), 'migrate: bad');
        await this.factory2.setMigrator(this.migrator.address, { from: alice });
        await this.bishop.migrate(0);
        assert.equal((await this.lp1.balanceOf(this.bishop.address)).valueOf(), '0');
        assert.equal((await this.lp2.balanceOf(this.bishop.address)).valueOf(), '2000000');
        await this.bishop.withdraw('0', '2000000', { from: minter });
        await this.lp2.transfer(this.lp2.address, '2000000', { from: minter });
        await this.lp2.burn(bob);
        assert.equal((await this.token.balanceOf(bob)).valueOf(), '9033718');
        assert.equal((await this.weth.balanceOf(bob)).valueOf(), '451685');
    });

    it('should allow first minting from public only after migrator is gone', async () => {
        await this.factory2.setMigrator(this.migrator.address, { from: alice });
        this.tokenx = await MockERC20.new('TOKENX', 'TOKENX', '100000000', { from: minter });
        this.lpx = await KingSwapPair.at((await this.factory2.createPair(this.weth.address, this.tokenx.address)).logs[0].args.pair);
        await this.weth.transfer(this.lpx.address, '10000000', { from: minter });
        await this.tokenx.transfer(this.lpx.address, '500000', { from: minter });
        await expectRevert(this.lpx.mint(minter), 'Must not have migrator');
        await this.factory2.setMigrator('0x0000000000000000000000000000000000000000', { from: alice });
        await this.lpx.mint(minter);
    });
});