const { expectRevert, time } = require('@openzeppelin/test-helpers');
const KingToken = artifacts.require('KingToken');
const ArchbishopV2 = artifacts.require('ArchbishopV2');
const MockERC20 = artifacts.require('MockERC20');

contract('ArchbishopV2', ([alice, bob, carol, admin, kingfee, kingServant, minter]) => {
    beforeEach(async () => {
        this.king = await KingToken.new({ from: alice });
        this.testStartBlock = parseInt(await web3.eth.getBlockNumber());
        this.archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock}`, { from: alice });
    });

    it('should set correct state variables', async () => {
        const king = await this.archbishopV2.king();
        const administrator = await this.archbishopV2.admin();
        const owner = await this.archbishopV2.owner();
        const startBlock = await this.archbishopV2.startBlock();
        const kingPerBlockYieldFarming = await this.archbishopV2.kingPerBlockYieldFarming();
        const kingPerBlockTradeMining = await this.archbishopV2.kingPerBlockTradeMining();
        const tradeMiningSpeedUpEndBlock = await this.archbishopV2.tradeMiningSpeedUpEndBlock();
        const yieldFarmingIIEndBlock = await this.archbishopV2.yieldFarmingIIEndBlock();
        const tradeMiningEndBlock = await this.archbishopV2.tradeMiningEndBlock();
        assert.equal(king.toString(), this.king.address);
        assert.equal(admin.toString(), administrator);
        assert.equal(owner.toString(), alice);
        assert.equal(startBlock.toString(), `${this.testStartBlock}`);
        assert.equal(kingPerBlockYieldFarming.toString(), '5000000000000000000');
        assert.equal(kingPerBlockTradeMining.toString(), '10000000000000000000');
        assert.equal(tradeMiningSpeedUpEndBlock.toString(), `${this.testStartBlock + 192000}`);
        assert.equal(yieldFarmingIIEndBlock.toString(), `${this.testStartBlock + 1152000}`);
        assert.equal(tradeMiningEndBlock.toString(), `${this.testStartBlock + 2304000}`);
    });

    it('should allow owner and only owner to update admin', async () => {
        assert.equal((await this.archbishopV2.admin()).valueOf(), admin);
        await expectRevert(this.archbishopV2.setAdmin(bob, { from: carol }), 'Ownable: caller is not the owner');
        await this.archbishopV2.setAdmin(bob, { from: alice });
        assert.equal((await this.archbishopV2.admin()).valueOf(), bob);
    });

    it('should allow owner and only owner to update admin', async () => {
        assert.equal((await this.archbishopV2.admin()).valueOf(), admin);
        await expectRevert(this.archbishopV2.setAdmin(bob, { from: carol }), 'Ownable: caller is not the owner');
        await this.archbishopV2.setAdmin(bob, { from: alice });
        assert.equal((await this.archbishopV2.admin()).valueOf(), bob);
    });

    it('should allow owner and only owner to update king Fee Address', async () => {
        assert.equal((await this.archbishopV2.kingFeeAddress()).valueOf(), kingfee);
        await expectRevert(this.archbishopV2.setKingFeeAddress(bob, { from: carol }), 'sf:Call must come from admin.');
        await this.archbishopV2.setKingFeeAddress(bob, { from: admin });
        assert.equal((await this.archbishopV2.kingFeeAddress()).valueOf(), bob);
    });

    it('should allow owner and only owner to update kingServant', async () => {
        assert.equal((await this.archbishopV2.kingServant()).valueOf(), kingServant);
        await expectRevert(this.archbishopV2.setKingServant(bob, { from: carol }), 'sm:Call must come from admin.');
        await this.archbishopV2.setKingServant(bob, { from: admin });
        assert.equal((await this.archbishopV2.kingServant()).valueOf(), bob);
    });

    it('should allow owner and only owner to update lpFeeRatio', async () => {
        assert.equal((await this.archbishopV2.lpFeeRatio()).valueOf(), '0');
        await expectRevert(this.archbishopV2.setLpFeeRatio('10', { from: carol }), 'lp:Call must come from admin.');
        await expectRevert(this.archbishopV2.setLpFeeRatio('200', { from: admin }), 'invalid ratio');
        await this.archbishopV2.setLpFeeRatio('10', { from: admin });
        assert.equal((await this.archbishopV2.lpFeeRatio()).valueOf(), '10');
    });

    it('should allow owner and only owner to update withdrawInterval', async () => {
        assert.equal((await this.archbishopV2.withdrawInterval()).valueOf(), '192000');
        await expectRevert(this.archbishopV2.setWithdrawInterval('10', { from: carol }), 'i:Call must come from admin.');
        await this.archbishopV2.setWithdrawInterval('1000', { from: admin });
        assert.equal((await this.archbishopV2.withdrawInterval()).valueOf(), '1000');
    });

    it('should allow admin and only admin to update king fee ratio', async () => {
        assert.equal((await this.archbishopV2.kingFeeRatio()).valueOf(), '10');
        await expectRevert(this.archbishopV2.setKingFeeRatio('20', { from: carol }), 'sfr:Call must come from admin.');
        await expectRevert(this.archbishopV2.setKingFeeRatio('200', { from: admin }), 'invalid ratio');
        await this.archbishopV2.setKingFeeRatio('20', { from: admin });
        assert.equal((await this.archbishopV2.kingFeeRatio()).valueOf(), '20');
    });

    it('should allow admin and only admin to update king per block for yeild farming', async () => {
        assert.equal(await this.archbishopV2.kingPerBlockYieldFarming().valueOf(), '5000000000000000000');
        await expectRevert(this.archbishopV2.setKingPerBlockYieldFarming('10000000000000000000', false, { from: alice }), 'yield:Call must come from admin.');
        await this.archbishopV2.setKingPerBlockYieldFarming('10000000000000000000', false, { from: admin });
        assert.equal(await this.archbishopV2.kingPerBlockYieldFarming().valueOf(), '10000000000000000000');
    });

    it('should allow admin and only admin to update king per block for trade mining', async () => {
        assert.equal(await this.archbishopV2.kingPerBlockTradeMining().valueOf(), '10000000000000000000');
        await expectRevert(this.archbishopV2.setKingPerBlockTradeMining('20000000000000000000', false, { from: alice }), 'trade:Call must come from admin.');
        await this.archbishopV2.setKingPerBlockTradeMining('20000000000000000000', false, { from: admin });
        assert.equal(await this.archbishopV2.kingPerBlockTradeMining().valueOf(), '20000000000000000000');
    });

    it('set trade mining speed up end block', async () => {
        assert.equal((await this.archbishopV2.tradeMiningSpeedUpEndBlock()).valueOf(), `${this.testStartBlock + 192000}`);
        await expectRevert(this.archbishopV2.setTradeMiningSpeedUpEndBlock('200000', { from: alice }), 'tmsu:Call must come from admin.');
        await this.archbishopV2.setTradeMiningSpeedUpEndBlock('200000', { from: admin });
        assert.equal((await this.archbishopV2.tradeMiningSpeedUpEndBlock()).valueOf(), '200000');
    });

    it('set yield farming II end block', async () => {
        assert.equal((await this.archbishopV2.yieldFarmingIIEndBlock()).valueOf(), `${this.testStartBlock + 1152000}`);
        await expectRevert(this.archbishopV2.setYieldFarmingIIEndBlock(`${this.testStartBlock + 1200000}`, { from: alice }), 'yf:Call must come from admin.');
        await this.archbishopV2.setYieldFarmingIIEndBlock(`${this.testStartBlock + 1200000}`, { from: admin });
        assert.equal((await this.archbishopV2.yieldFarmingIIEndBlock()).valueOf(), `${this.testStartBlock + 1200000}`);
    });

    it('set trade mining end block', async () => {
        assert.equal(await this.archbishopV2.tradeMiningEndBlock().valueOf(), `${this.testStartBlock + 2304000}`);
        await expectRevert(this.archbishopV2.setTradeMiningEndBlock(`${this.testStartBlock + 2500000}`, { from: alice }), 'tm:Call must come from admin.');
        await this.archbishopV2.setTradeMiningEndBlock(`${this.testStartBlock + 2500000}`, { from: admin });
        assert.equal(await this.archbishopV2.tradeMiningEndBlock().valueOf(), `${this.testStartBlock + 2500000}`);
    });

    it('handover the kingtoken mintage right', async () => {
        assert.equal(await this.king.owner(), alice);
        await this.king.transferOwnership(this.archbishopV2.address, { from: alice });
        assert.equal(await this.king.owner(), this.archbishopV2.address);
        await this.archbishopV2.handoverKingMintage(bob);
        assert.equal(await this.king.owner(), bob);
    });

    it('getMultiplier', async () => {
        const result1 = await this.archbishopV2.getMultiplier(`${this.testStartBlock}`, `${this.testStartBlock + 192000}`);
        assert.equal(result1.multipY.valueOf(), '192000');
        assert.equal(result1.multipT.valueOf(), '384000');
        const result2 = await this.archbishopV2.getMultiplier(`${this.testStartBlock}`, `${this.testStartBlock + 193000}`);
        assert.equal(result2.multipY.valueOf(), '193000');
        assert.equal(result2.multipT.valueOf(), '385000');
        const result3 = await this.archbishopV2.getMultiplier(`${this.testStartBlock}`, `${this.testStartBlock + 1152000}`);
        assert.equal(result3.multipY.valueOf(), '1152000');
        assert.equal(result3.multipT.valueOf(), '1344000');
        const result4 = await this.archbishopV2.getMultiplier(`${this.testStartBlock}`, `${this.testStartBlock + 1200000}`);
        assert.equal(result4.multipY.valueOf(), '1152000');
        assert.equal(result4.multipT.valueOf(), '1392000');
        const result5 = await this.archbishopV2.getMultiplier(`${this.testStartBlock + 1200000}`, `${this.testStartBlock + 1500000}`);
        assert.equal(result5.multipY.valueOf(), '0');
        assert.equal(result5.multipT.valueOf(), '300000');
        const result6 = await this.archbishopV2.getMultiplier(`${this.testStartBlock + 1200000}`, `${this.testStartBlock + 2305000}`);
        assert.equal(result6.multipY.valueOf(), '0');
        assert.equal(result6.multipT.valueOf(), '1104000');
        const result7 = await this.archbishopV2.getMultiplier(`${this.testStartBlock + 2305000}`, `${this.testStartBlock + 2306000}`);
        assert.equal(result7.multipY.valueOf(), '0');
        assert.equal(result7.multipT.valueOf(), '0');
    });

    it('getKingPerBlock', async () => {
        assert.equal(await this.archbishopV2.getKingPerBlock(`${this.testStartBlock + 100}`).valueOf(), '25000000000000000000');
        assert.equal(await this.archbishopV2.getKingPerBlock(`${this.testStartBlock + 192000}`).valueOf(), '25000000000000000000');
        assert.equal(await this.archbishopV2.getKingPerBlock(`${this.testStartBlock + 193000}`).valueOf(), '15000000000000000000');
        assert.equal(await this.archbishopV2.getKingPerBlock(`${this.testStartBlock + 1152000}`).valueOf(), '15000000000000000000');
        assert.equal(await this.archbishopV2.getKingPerBlock(`${this.testStartBlock + 1155000}`).valueOf(), '10000000000000000000');
        assert.equal(await this.archbishopV2.getKingPerBlock(`${this.testStartBlock + 2304000}`).valueOf(), '10000000000000000000');
        assert.equal(await this.archbishopV2.getKingPerBlock(`${this.testStartBlock + 2305000}`).valueOf(), '0');
    });

    context('With ERC/LP token added to the field', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            this.sToken = await MockERC20.new("KingSwap Slippage Token", "SST", "1000000000", { from: minter });
            await this.sToken.transfer(alice, '1000', { from: minter });
            await this.sToken.transfer(bob, '1000', { from: minter });
            await this.sToken.transfer(carol, '1000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
            this.sToken2 = await MockERC20.new("KingSwap Slippage Token", "SST", "1000000000", { from: minter });
            await this.sToken2.transfer(alice, '1000', { from: minter });
            await this.sToken2.transfer(bob, '1000', { from: minter });
            await this.sToken2.transfer(carol, '1000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });
        });

        it('add pool', async () => {
            await expectRevert(this.archbishopV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: alice }), 'add:Call must come from admin.');
            await this.archbishopV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            assert.equal((await this.archbishopV2.poolLength()).valueOf(), '1');
            await expectRevert(this.archbishopV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin }), 'pool exist');
            await this.archbishopV2.add('100', '100', this.lp2.address, this.sToken2.address, false, { from: admin });
            assert.equal((await this.archbishopV2.poolLength()).valueOf(), '2');
        });

        it('set pool allocpoint', async () => {
            await this.archbishopV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            await expectRevert(this.archbishopV2.set(0, '200', false, { from: alice }), 'set:Call must come from admin.');
            await this.archbishopV2.set(0, '200', false, { from: admin });
            assert.equal((await this.archbishopV2.poolInfo('0')).allocPoint, '200');
        });

        it('set multiplierSToken', async () => {
            await this.archbishopV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            assert.equal((await this.archbishopV2.poolInfo('0')).multiplierSToken, '100');
            await expectRevert(this.archbishopV2.setMultiplierSToken(0, '200', false, { from: alice }), 'sms:Call must come from admin.');
            await this.archbishopV2.setMultiplierSToken(0, '200', false, { from: admin });
            assert.equal((await this.archbishopV2.poolInfo('0')).multiplierSToken, '200');
        });

        it('set pool withdraw king switch', async () => {
            await this.archbishopV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            assert.equal((await this.archbishopV2.poolInfo('0')).kingLockSwitch, true);
            await expectRevert(this.archbishopV2.setKingLockSwitch(0, false, false, { from: alice }), 's:Call must come from admin.');
            await this.archbishopV2.setKingLockSwitch(0, false, false, { from: admin });
            assert.equal((await this.archbishopV2.poolInfo('0')).kingLockSwitch, false);
        });

        it('should give out $KINGs only after farming time', async () => {
            const archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock + 200}`, { from: alice });
            await this.king.mint(archbishopV2.address, '1000');
            await this.king.transferOwnership(archbishopV2.address, { from: alice });
            await archbishopV2.setKingPerBlockYieldFarming('5', false,{ from: admin });
            await archbishopV2.setKingPerBlockTradeMining('10', false,{ from: admin });
            await archbishopV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            await archbishopV2.setWithdrawInterval('1', { from: admin });
            await this.lp.approve(archbishopV2.address, '1000', { from: bob });
            await archbishopV2.deposit(0, '100', '0', { from: bob });
            await time.advanceBlockTo(`${this.testStartBlock + 189}`);
            await archbishopV2.deposit(0, '0', '0', { from: bob }); // block 90
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo(`${this.testStartBlock + 194}`);
            await archbishopV2.deposit(0, '0', '0', { from: bob }); // block 95
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo(`${this.testStartBlock + 199}`);
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo(`${this.testStartBlock + 204}`);
            assert.equal((await archbishopV2.pendingKing(0, bob)).valueOf(), '100');
            await archbishopV2.deposit(0, '0', '0', { from: bob }); // block 105
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '125');
            assert.equal((await this.king.balanceOf(archbishopV2.address)).valueOf(), '975');
        });

        it('should distribute $KINGs properly for each staker', async () => {
            // 100 per block farming rate starting at block 300 with bonus until block 1000
            const archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock + 300}`, { from: alice });
            await this.king.mint(archbishopV2.address, '5000');
            await this.king.transferOwnership(archbishopV2.address, { from: alice });
            await archbishopV2.setKingPerBlockYieldFarming('5', false,{ from: admin });
            await archbishopV2.setKingPerBlockTradeMining('10', false,{ from: admin });
            await archbishopV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            await archbishopV2.setWithdrawInterval('1', { from: admin });
            await this.lp.approve(archbishopV2.address, '1000', { from: alice });
            await this.lp.approve(archbishopV2.address, '1000', { from: bob });
            await this.lp.approve(archbishopV2.address, '1000', { from: carol });
            // Alice deposits 10 LPs at block 310
            await time.advanceBlockTo(`${this.testStartBlock + 309}`);
            await archbishopV2.deposit(0, '10', '0', { from: alice });
            // Bob deposits 20 LPs at block 314
            await time.advanceBlockTo(`${this.testStartBlock + 313}`);
            await archbishopV2.deposit(0, '20', '0', { from: bob });
            // Carol deposits 30 LPs at block 218
            await time.advanceBlockTo(`${this.testStartBlock + 317}`);
            await archbishopV2.deposit(0, '30', '0', { from: carol });
            // Alice deposits 10 more LPs at block 220. At this point:
            // Alice should have: 4*25 + 4*1/3*25 + 2*1/6*25 = 141
            // Archbishop should have the remaining: 5000  - 141 = 109
            await time.advanceBlockTo(`${this.testStartBlock + 319}`)
            await archbishopV2.deposit(0, '10', '0', { from: alice });
            assert.equal((await this.king.totalSupply()).valueOf(), '5200');
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '141');
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.king.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.king.balanceOf(archbishopV2.address)).valueOf(), '5059');
            // Bob withdraws 5 LPs at block 230. At this point:
            // Bob should have: 4*2/3*25 + 2*2/6*25 + 10*2/7*25 = 154
            await time.advanceBlockTo(`${this.testStartBlock + 329}`)
            await archbishopV2.withdraw(0, '5', { from: bob });
            assert.equal((await this.king.totalSupply()).valueOf(), '5400');
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '141');
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '154');
            assert.equal((await this.king.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.king.balanceOf(archbishopV2.address)).valueOf(), '5105');
            // Alice withdraws 20 LPs at block 240.
            // Bob withdraws 15 LPs at block 250.
            // Carol withdraws 30 LPs at block 260.
            await time.advanceBlockTo(`${this.testStartBlock + 339}`)
            await archbishopV2.withdraw(0, '20', { from: alice });
            await time.advanceBlockTo(`${this.testStartBlock + 349}`)
            await archbishopV2.withdraw(0, '15', { from: bob });
            await time.advanceBlockTo(`${this.testStartBlock + 359}`)
            await archbishopV2.withdraw(0, '30', { from: carol });
            assert.equal((await this.king.totalSupply()).valueOf(), '6000');
            // Alice should have: 141 + 10*2/7*25 + 10*2/6.5*25 = 289
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '289');
            // Bob should have: 154 + 10*1.5/6.5 * 25 + 10*1.5/4.5*25 = 295
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '295');
            // Carol should have: 2*3/6*25 + 10*3/7*25 + 10*3/6.5*25 + 10*3/4.5*25 + 10*25 = 665
            assert.equal((await this.king.balanceOf(carol)).valueOf(), '665');
            // All of them should have 1000 LPs back.
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(carol)).valueOf(), '1000');
        });

        it('should give proper $KINGs allocation to each pool', async () => {
            const archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock + 400}`, { from: alice });
            await this.king.mint(archbishopV2.address, '5000');
            await this.king.transferOwnership(archbishopV2.address, { from: alice });
            await archbishopV2.setKingPerBlockYieldFarming('5', false,{ from: admin });
            await archbishopV2.setKingPerBlockTradeMining('10', false,{ from: admin });
            await this.lp.approve(archbishopV2.address, '1000', { from: alice });
            await this.lp2.approve(archbishopV2.address, '1000', { from: bob });
            // Add first LP to the pool with allocation 10
            await archbishopV2.add('10', '100', this.lp.address, this.sToken.address, true, { from: admin });
            // Alice deposits 10 LPs at block 410
            await time.advanceBlockTo(`${this.testStartBlock + 409}`);
            await archbishopV2.deposit(0, '10', '0', { from: alice });
            // Add LP2 to the pool with allocation 2 at block 320
            await time.advanceBlockTo(`${this.testStartBlock + 419}`);
            await archbishopV2.add('20', '100',this.lp2.address, this.sToken2.address, true, { from: admin });
            // Alice should have 10*25 pending reward
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '250');
            // Bob deposits 10 LP2s at block 325
            await time.advanceBlockTo(`${this.testStartBlock + 424}`);
            await archbishopV2.deposit(1, '10', '0', { from: bob });
            // Alice should have 250 + 5*1/3*25 = 291 pending reward
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '291');
            await time.advanceBlockTo(`${this.testStartBlock + 430}`);
            // At block 330. Bob should get 5*2/3*25 = 82. Alice should get ~41 more.
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '332');
            assert.equal((await archbishopV2.pendingKing(1, bob)).valueOf(), '82');
        });

        it('should stop giving bonus $KINGs after the bonus period ends', async () => {
            const archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock + 500}`, { from: alice });
            await this.king.mint(archbishopV2.address, '5000');
            await this.king.transferOwnership(archbishopV2.address, { from: alice });
            await archbishopV2.setKingPerBlockYieldFarming('5', false,{ from: admin });
            await archbishopV2.setKingPerBlockTradeMining('10', false,{ from: admin });
            await this.lp.approve(archbishopV2.address, '1000', { from: alice });
            await archbishopV2.add('1', '100', this.lp.address, this.sToken.address, true, { from: admin });
            await archbishopV2.setTradeMiningEndBlock(`${this.testStartBlock + 600}`, { from: admin });
            await archbishopV2.setYieldFarmingIIEndBlock(`${this.testStartBlock + 600}`, { from: admin });
            // Alice deposits 10 LPs at block 590
            await time.advanceBlockTo(`${this.testStartBlock + 589}`);
            await archbishopV2.deposit(0, '10', '0', { from: alice });
            // At block 605, she should have 25*10 = 250 pending.
            await time.advanceBlockTo(`${this.testStartBlock + 610}`);
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '250');
        });

        it('can not harvest king if harvest interval less than withdraw interval', async () => {
            const archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock + 650}`, { from: alice });
            await this.king.mint(archbishopV2.address, '5000');
            await this.king.transferOwnership(archbishopV2.address, { from: alice });
            await archbishopV2.setKingPerBlockYieldFarming('5', false,{ from: admin });
            await archbishopV2.setKingPerBlockTradeMining('10', false,{ from: admin });
            await this.lp.approve(archbishopV2.address, '1000', { from: alice });
            await archbishopV2.add('1', '100', this.lp.address, this.sToken.address, true, { from: admin });
            // Alice deposits 10 LPs at block 690
            await time.advanceBlockTo(`${this.testStartBlock + 689}`);
            await archbishopV2.deposit(0, '10', '0', { from: alice });//590
            await time.advanceBlockTo(`${this.testStartBlock + 700}`);
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '250');
            await archbishopV2.deposit(0, '0', '0', { from: alice });//601
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '275');
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '0');
            await archbishopV2.withdraw(0, '5', { from: alice });//602
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '0');
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '300');
            await archbishopV2.setWithdrawInterval('1', { from: admin });//603
            await archbishopV2.deposit(0, '0', '0', { from: alice });//604
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '0');
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '350');
            await time.advanceBlockTo(`${this.testStartBlock + 709}`);
            await archbishopV2.withdraw(0, '5', { from: alice });//610
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '0');
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '500');
        });

        it('lp fee ratio', async () => {
            const archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock + 750}`, { from: alice });
            const lp = await MockERC20.new('LPToken', 'LP', '400000000000000000000', { from: minter });
            await lp.transfer(alice, '200000000000000000000', { from: minter });
            await lp.transfer(bob, '200000000000000000000', { from: minter });
            await this.king.mint(archbishopV2.address, '5000');
            await lp.approve(archbishopV2.address, '200000000000000000000', { from: alice });
            await lp.approve(archbishopV2.address, '200000000000000000000', { from: bob });
            await archbishopV2.add('1', '100', lp.address, this.sToken.address, true, { from: admin });
            // Alice deposits 10 LPs at block 790
            await time.advanceBlockTo(`${this.testStartBlock + 789}`);
            await archbishopV2.deposit(0, '200000000000000000000', '0', { from: alice });//690
            await archbishopV2.deposit(0, '200000000000000000000', '0', { from: bob });//691
            await time.advanceBlockTo(`${this.testStartBlock + 799}`);
            await archbishopV2.withdraw(0, '5000000000000000000', { from: alice });
            assert.equal((await lp.balanceOf(alice)).valueOf(), '5000000000000000000');
            await archbishopV2.setLpFeeRatio(5, { from: admin });
            await archbishopV2.withdraw(0, '5000000000000000000', { from: alice });
            assert.equal((await lp.balanceOf(alice)).valueOf(), '9750000000000000000');
            assert.equal((await lp.balanceOf(archbishopV2.address)).valueOf(), '390000000000000000000');
            assert.equal((await lp.balanceOf(kingServant)).valueOf(), '250000000000000000');
            await archbishopV2.withdraw(0, '5000000000000000000', { from: bob });
            assert.equal((await lp.balanceOf(bob)).valueOf(), '4750000000000000000');
            assert.equal((await lp.balanceOf(kingServant)).valueOf(), '500000000000000000');
        });

        it('king fee ratio', async () => {
            const archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock + 850}`, { from: alice });
            await this.king.mint(archbishopV2.address, '5000');
            await this.king.transferOwnership(archbishopV2.address, { from: alice });
            await archbishopV2.setKingPerBlockYieldFarming('5', false,{ from: admin });
            await archbishopV2.setKingPerBlockTradeMining('10', false,{ from: admin });
            await this.lp.approve(archbishopV2.address, '1000', { from: alice });
            await archbishopV2.add('1', '100', this.lp.address, this.sToken.address, true, { from: admin });
            // Alice deposits 10 LPs at block 890
            await time.advanceBlockTo(`${this.testStartBlock + 889}`);
            await archbishopV2.deposit(0, '10', '0', { from: alice });//890
            await time.advanceBlockTo(`${this.testStartBlock + 900}`);
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '250');
            await archbishopV2.deposit(0, '0', '0', { from: alice });//901
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '275');
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '0');
            await archbishopV2.withdraw(0, '5', { from: alice });//902
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '0');
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '300');
            await archbishopV2.setKingLockSwitch(0, false, false, { from: admin });
            await archbishopV2.deposit(0, '0', '0', { from: alice });//904
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '0');
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '315');
            await time.advanceBlockTo(`${this.testStartBlock + 909}`);
            await archbishopV2.withdraw(0, '5', { from: alice });//910
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '0');
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '450');
            assert.equal((await this.king.balanceOf(kingfee)).valueOf(), '50');
        });

        it('withdraw', async () => {
            const archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock + 1000}`, { from: alice });
            await this.king.mint(archbishopV2.address, '5000');
            await this.king.transferOwnership(archbishopV2.address, { from: alice });
            await archbishopV2.setKingPerBlockYieldFarming('5', false, { from: admin });
            await archbishopV2.setKingPerBlockTradeMining('10', false, { from: admin });
            await this.lp.approve(archbishopV2.address, '1000', { from: alice });
            await this.sToken.approve(archbishopV2.address, '1000', { from: alice });
            await this.lp.approve(archbishopV2.address, '1000', { from: bob });
            await this.sToken.approve(archbishopV2.address, '1000', { from: bob });
            await archbishopV2.add('100', '10000000000', this.lp.address, this.sToken.address, true, { from: admin });
            await time.advanceBlockTo(`${this.testStartBlock + 1098}`);
            await expectRevert(archbishopV2.deposit(0, '0', '1', { from: alice }), 'deposit:invalid');//990
            await archbishopV2.deposit(0, '1000', '10', { from: alice }); //1000==>alice
            assert.equal((await archbishopV2.userInfo(0, alice)).amount, '2000');
            assert.equal((await archbishopV2.userInfo(0, alice)).amountLPtoken, '1000');
            assert.equal((await archbishopV2.userInfo(0, alice)).amountStoken, '10');
            await time.advanceBlockTo(`${this.testStartBlock + 1109}`);
            await archbishopV2.deposit(0, '1000', '10', { from: bob }); //1100==>bob
            assert.equal((await archbishopV2.userInfo(0, bob)).amount, '2000');
            assert.equal((await archbishopV2.userInfo(0, bob)).amountLPtoken, '1000');
            assert.equal((await archbishopV2.userInfo(0, bob)).amountStoken, '10');
            await expectRevert(archbishopV2.withdraw(0, '1100', { from: alice }), 'withdraw: LP amount not enough');
            await time.advanceBlockTo(`${this.testStartBlock + 1119}`);
            await archbishopV2.withdraw(0, '500', { from: alice });//1120
            // alice have king = 10*25+1/2*10*25 = 375
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '375');
            assert.equal((await archbishopV2.pendingKing(0, bob)).valueOf(), '125');
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '500');
            assert.equal((await this.sToken.balanceOf(alice)).valueOf(), '990');
            assert.equal((await archbishopV2.userInfo(0, alice)).amountStoken, '0');
            assert.equal((await archbishopV2.userInfo(0, alice)).amountLPtoken, '500');
            assert.equal((await archbishopV2.userInfo(0, alice)).amount, '500');
            assert.equal((await this.lp.balanceOf(archbishopV2.address)).valueOf(), '1500');
            assert.equal((await this.sToken.balanceOf(archbishopV2.address)).valueOf(), '10');
            await time.advanceBlockTo(`${this.testStartBlock + 1129}`);
            await archbishopV2.withdraw(0, '500', { from: bob });//1130
            // alice have king = 1/2*10*25 + 10*25*4/5= 325
            assert.equal((await archbishopV2.pendingKing(0, bob)).valueOf(), '325');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '500');
            assert.equal((await this.sToken.balanceOf(bob)).valueOf(), '990');
            assert.equal((await archbishopV2.userInfo(0, bob)).amountStoken, '0');
            assert.equal((await archbishopV2.userInfo(0, bob)).amountLPtoken, '500');
            assert.equal((await archbishopV2.userInfo(0, bob)).amount, '500');
            assert.equal((await this.lp.balanceOf(archbishopV2.address)).valueOf(), '1000');
            assert.equal((await this.sToken.balanceOf(archbishopV2.address)).valueOf(), '0');
        });

        it('emergency withdraw', async () => {
            const archbishopV2 = await ArchbishopV2.new(this.king.address, admin, kingServant, kingfee, `${this.testStartBlock + 1100}`, { from: alice });
            await this.king.mint(archbishopV2.address, '5000');
            await this.king.transferOwnership(archbishopV2.address, { from: alice });
            await archbishopV2.setKingPerBlockYieldFarming('5', false, { from: admin });
            await archbishopV2.setKingPerBlockTradeMining('10', false, { from: admin });
            await this.lp.approve(archbishopV2.address, '1000', { from: alice });
            await this.sToken.approve(archbishopV2.address, '1000', { from: alice });
            await this.lp.approve(archbishopV2.address, '1000', { from: bob });
            await this.sToken.approve(archbishopV2.address, '1000', { from: bob });
            await archbishopV2.add('100', '10000000000', this.lp.address, this.sToken.address, true, { from: admin });
            await expectRevert(archbishopV2.emergencyWithdraw(0, { from: alice }), 'withdraw: LP amount not enough');
            await archbishopV2.deposit(0, '1000', '10', { from: alice });
            await time.advanceBlockTo(`${this.testStartBlock + 1160}`);
            await archbishopV2.emergencyWithdraw(0, { from: alice })
            assert.equal((await archbishopV2.pendingKing(0, alice)).valueOf(), '0');
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '1000');
            assert.equal((await this.sToken.balanceOf(alice)).valueOf(), '990');
            assert.equal((await archbishopV2.userInfo(0, alice)).amount, '0');
            assert.equal((await archbishopV2.userInfo(0, alice)).amountStoken, '0');
            assert.equal((await archbishopV2.userInfo(0, alice)).amountLPtoken, '0');
        });
    });
});
