const { expectRevert, time } = require('@openzeppelin/test-helpers');
const KingToken = artifacts.require('KingToken');
const KingUni = artifacts.require('KingUni');
const StakingRewards = artifacts.require('StakingRewards');
const MockERC20 = artifacts.require('MockERC20');

contract('KingUni', ([alice, bob, carol, , minter]) => {
    beforeEach(async () => {
        this.king = await KingToken.new({ from: alice });
        this.uniToken = await MockERC20.new("UniSwap", "UNI", "1000000000000000000000000000", { from: alice });
        this.testStartBlock = parseInt(await web3.eth.getBlockNumber());
    });

    it('should set correct state variables', async () => {
        const kingUni = await KingUni.new(this.king.address, this.uniToken.address, bob, carol, "50", `${this.testStartBlock}`, { from: alice });
        assert.equal((await kingUni.king()).valueOf(), this.king.address);
        assert.equal((await kingUni.uniToken()).valueOf(), this.uniToken.address);
        assert.equal((await kingUni.owner()).valueOf(), alice);
        assert.equal((await kingUni.uniTokenFeeReceiver()).valueOf(), bob);
        assert.equal((await kingUni.lpTokenFeeReceiver()).valueOf(), carol);
        assert.equal((await kingUni.kingPerBlock()).valueOf(), "50");
        assert.equal((await kingUni.startBlock()).valueOf(), `${this.testStartBlock}`);
        assert.equal((await kingUni.endBlock()).valueOf(), `${this.testStartBlock + 128000}`);
        assert.equal((await kingUni.bonusEndBlock()).valueOf(), `${this.testStartBlock + 64000}`);
    });

    it('pool info', async () => {
        const kingUni = await KingUni.new(this.king.address, this.uniToken.address, bob, carol, "50", `${this.testStartBlock}`, { from: alice });
        const lpToken = await MockERC20.new("UniSwap LP Token", "LPT", "1000000000", { from: alice });
        const uniStake = await StakingRewards.new(alice, this.uniToken.address, lpToken.address, { from: alice });

        await expectRevert(kingUni.add('1', lpToken.address, uniStake.address, false, { from: bob }), 'Ownable: caller is not the owner');
        await kingUni.add('1', lpToken.address, uniStake.address, false, { from: alice });
        await expectRevert(kingUni.add('1', lpToken.address, uniStake.address, false, { from: alice }), 'lpToken exist');
        assert.equal((await kingUni.poolLength()).valueOf(), '1');
        assert.equal((await kingUni.poolInfo('0')).allocPoint, '1');

        await expectRevert(kingUni.set('0', '10', false, { from: bob }), 'Ownable: caller is not the owner');
        await kingUni.set('0', '10', false);
        assert.equal((await kingUni.poolInfo('0')).allocPoint, '10');
    });

    it('getMultiplier', async () => {
        const kingUni = await KingUni.new(this.king.address, this.uniToken.address, bob, carol, "50", `${this.testStartBlock}`, { from: alice });
        assert.equal((await kingUni.getMultiplier(`${this.testStartBlock}`, `${this.testStartBlock + 64000}`)).valueOf(), '128000');
        assert.equal((await kingUni.getMultiplier(`${this.testStartBlock + 32000}`, `${this.testStartBlock + 70000}`)).valueOf(), '70000');
        assert.equal((await kingUni.getMultiplier(`${this.testStartBlock + 32000}`, `${this.testStartBlock + 130000}`)).valueOf(), '128000');
        assert.equal((await kingUni.getMultiplier(`${this.testStartBlock + 64000}`, `${this.testStartBlock + 128000}`)).valueOf(), '64000');
        assert.equal((await kingUni.getMultiplier(`${this.testStartBlock + 64000}`, `${this.testStartBlock + 130000}`)).valueOf(), '64000');
        assert.equal((await kingUni.getMultiplier(`${this.testStartBlock + 128000}`, `${this.testStartBlock + 130000}`)).valueOf(), '0');
    });

    context('With ERC/LP token added to the field', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });

            this.uniStake = await StakingRewards.new(alice, this.uniToken.address, this.lp.address);
            await this.uniToken.transfer(this.uniStake.address, '5000000000000000000000000');
            await this.uniStake.notifyRewardAmount('5000000000000000000000000');
            this.uniStake2 = await StakingRewards.new(alice, this.uniToken.address, this.lp2.address);
            await this.uniToken.transfer(this.uniStake2.address, '5000000000000000000000000');
            await this.uniStake2.notifyRewardAmount('5000000000000000000000000');
        });

        xit('should allow emergency withdraw', async () => {
            const kingUni = await KingUni.new(this.king.address, this.uniToken.address, bob, carol, "50", `${this.testStartBlock}`, { from: alice });
            const minWithdrawInterval = await kingUni.MIN_WITHDRAW_INTERVAL();
            await kingUni.add('1000', this.lp.address, this.uniStake.address, false);
            await this.lp.approve(kingUni.address, '1000', { from: bob });
            await kingUni.deposit(0, '100', { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '900');
            await kingUni.emergencyWithdraw(0, { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '999');
            const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
            await time.advanceBlockTo(withoutFeeBlock);
            await kingUni.deposit(0, '100', { from: bob });
            await kingUni.emergencyWithdraw(0, { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '999');
        });

        it('should give out $KINGs only after farming time', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            const kingUni = await KingUni.new(this.king.address, this.uniToken.address, bob, carol, "50", `${this.testStartBlock + 100}`, { from: alice });
            await kingUni.add('100', this.lp.address, this.uniStake.address, false);
            await this.lp.approve(kingUni.address, '1000', { from: bob });
            await kingUni.deposit(0, '100', { from: bob });
            await time.advanceBlockTo(`${this.testStartBlock + 89}`);
            await kingUni.deposit(0, '0', { from: bob }); // block 90
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo(`${this.testStartBlock + 94}`);
            await kingUni.deposit(0, '0', { from: bob }); // block 95
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo(`${this.testStartBlock + 99}`);
            await kingUni.deposit(0, '0', { from: bob }); // block 100
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo(`${this.testStartBlock + 100}`);
            // FIXME: clarify if the next call (line) shall indeed revert
            // await expectRevert(kingUni.deposit(0, '0', { from: bob }), 'ERC20: transfer amount exceeds balance'); // block 101
            this.king.mint(kingUni.address, '100000000000000000000');
            await time.advanceBlockTo(`${this.testStartBlock + 110}`);
            await kingUni.deposit(0, '0', { from: bob }); // block 111
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '1100');
            await time.advanceBlockTo(`${this.testStartBlock + 114}`);
            await kingUni.deposit(0, '0', { from: bob }); // block 115
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '1500');
        });

        it('should distribute $KINGs properly for each staker', async () => {
            // 100 per block farming rate starting at block 300 with bonus until block 1000
           const kingUni = await KingUni.new(this.king.address, this.uniToken.address, bob, carol, "50", `${this.testStartBlock + 300}`, { from: alice });
            this.king.mint(kingUni.address, '100000000000000000000');
            await kingUni.add('100', this.lp.address, this.uniStake.address, false);
            await this.lp.approve(kingUni.address, '1000', { from: alice });
            await this.lp.approve(kingUni.address, '1000', { from: bob });
            await this.lp.approve(kingUni.address, '1000', { from: carol });
            // Alice deposits 10 LPs at block 310
            await time.advanceBlockTo(`${this.testStartBlock + 309}`);
            await kingUni.deposit(0, '10', { from: alice });
            // Bob deposits 20 LPs at block 314
            await time.advanceBlockTo(`${this.testStartBlock + 313}`);
            await kingUni.deposit(0, '20', { from: bob });
            // Carol deposits 30 LPs at block 318
            await time.advanceBlockTo(`${this.testStartBlock + 317}`);
            await kingUni.deposit(0, '30', { from: carol });
            await time.advanceBlockTo(`${this.testStartBlock + 319}`);
            await kingUni.deposit(0, '10', { from: alice });
            assert.equal((await this.king.balanceOf(alice)).valueOf(), '566');
            assert.equal((await this.king.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.king.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.uniStake.balanceOf(kingUni.address)).valueOf(), '70');
        });

        it('should give proper $KINGs allocation to each pool', async () => {
            // 100 per block farming rate starting at block 400 with bonus until block 1000
            const kingUni = await KingUni.new(this.king.address, this.uniToken.address, bob, carol, "50", `${this.testStartBlock + 400}`, { from: alice });
            this.king.mint(kingUni.address, '100000000000000000000');
            await this.lp.approve(kingUni.address, '1000', { from: alice });
            await this.lp2.approve(kingUni.address, '1000', { from: bob });
            // Add first LP to the pool with allocation 1
            await kingUni.add('10', this.lp.address, this.uniStake.address, true);
            // Alice deposits 10 LPs at block 410
            await time.advanceBlockTo(`${this.testStartBlock + 409}`);
            await kingUni.deposit(0, '10', { from: alice });
            // Add LP2 to the pool with allocation 2 at block 420
            await time.advanceBlockTo(`${this.testStartBlock + 419}`);
            await kingUni.add('20', this.lp2.address, this.uniStake2.address, true);
            // Alice should have 10*100 pending kingReward
            assert.equal((await kingUni.pending(0, alice))[0].valueOf(), '1000');
            // Bob deposits 10 LP2s at block 425
            await time.advanceBlockTo(`${this.testStartBlock + 424}`);
            await kingUni.deposit(1, '5', { from: bob });
            // Alice should have 1000 + 5*1/3*100 = 583 pending reward
            assert.equal((await kingUni.pending(0, alice))[0].valueOf(), '1166');
            await time.advanceBlockTo(`${this.testStartBlock + 430}`);
            // At block 430. Bob should get 5*2/3*100 = 166. Alice should get ~83 more.
            assert.equal((await kingUni.pending(0, alice))[0].valueOf(), '1333');
            assert.equal((await kingUni.pending(1, bob))[0].valueOf(), '333');
        });

        // it('earn UNIs', async () => {
        //     const kingUni = await KingUni.new(this.king.address, this.uniToken.address, jim, carol, "50", `${this.testStartBlock}`, { from: alice });
        //     this.king.mint(kingUni.address, '100000000000000000000');
        //     const uniRewardRate = await this.uniStake.rewardRate();
        //     console.log(uniRewardRate.toString());
        //     await kingUni.add('10', this.lp.address, this.uniStake.address, true);
        //     await this.lp.approve(kingUni.address, '1000', { from: bob });
        //     await kingUni.deposit(0, '10', { from: bob });
        //     const timestamp = await time.latest();
        //     await time.increase('10');
        //     assert.equal((await kingUni.pending(0, bob))[1].valueOf(), '9645061728395061720');
        //     await kingUni.deposit(0, '0', { from: bob });
        //     assert.equal((await this.uniToken.balanceOf(bob)).valueOf(), '8680555555555555548');
        //     assert.equal((await this.uniToken.balanceOf(jim)).valueOf(), '964506172839506172');
        // })
    })
})
