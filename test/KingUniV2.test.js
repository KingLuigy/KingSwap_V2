const { time, BN } = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = require('@openzeppelin/test-helpers/src/constants');
const KingToken = artifacts.require('KingToken');
const KingUniV2 = artifacts.require('KingUniV2');
const Archbishop = artifacts.require('Archbishop');
const StakingRewards = artifacts.require('StakingRewards');
const MockERC20 = artifacts.require('MockERC20');
const Migrator = artifacts.require('Migrator');
const KingSwapFactory = artifacts.require('KingSwapFactory');
const { AddressZero } = require("ethers/constants");
const KingSwapPair = artifacts.require('KingSwapPair');
const WETH9 = artifacts.require("WETH9");
const KingSwapRouter = artifacts.require("KingSwapRouter");
const { keccak256 } = require("ethers/utils");

function toBig(num) {
    return new BN(num)
}

function expandTo18Decimals(num) {
    return new BN(num).mul(toBig(10).pow(toBig(18)))
}

const LP_TOKEN_AMOUNT = expandTo18Decimals(10000);
const KING_PER_BLOCK = expandTo18Decimals(3);

contract('KingUniV2', ([alice, bob, carol, fee]) => {
    beforeEach(async () => {
        this.tokenA = await MockERC20.new("tokenA", "tokenA", expandTo18Decimals(100000000), { from: alice });
        this.tokenB = await MockERC20.new("tokenA", "tokenA", expandTo18Decimals(100000000), { from: alice });
        // deploy factory
        this.KingSwapFactory = await KingSwapFactory.new(alice, { from: alice });
        // create pair
        await this.KingSwapFactory.createPair(this.tokenA.address, this.tokenB.address, { from: alice })
        var pairAddress = await this.KingSwapFactory.getPair(this.tokenA.address, this.tokenB.address);
        this.pair = await KingSwapPair.at(pairAddress);
        WETH = await WETH9.new({ from: alice });
        // deploy router
        this.router = await KingSwapRouter.new(this.KingSwapFactory.address, WETH.address, { from: alice });
        await this.tokenA.approve(this.router.address, expandTo18Decimals(100000000), { from: alice });
        await this.tokenB.approve(this.router.address, expandTo18Decimals(100000000), { from: alice });
        let generateHash = keccak256(KingSwapPair.bytecode).slice(2);
        config.logger.log(`find init code hash: ${generateHash}`);

        await this.router.addLiquidity(
            this.tokenA.address,
            this.tokenB.address,
            expandTo18Decimals(100000000),
            expandTo18Decimals(100000000),
            0,
            0,
            alice,
            MAX_UINT256,
            { from: alice });


        this.king = await KingToken.new({ from: alice });
        this.uniToken = await MockERC20.new("UniSwap", "UNI", "1000000000000000000000000000", { from: alice });
        this.archbishop = await Archbishop.new(this.king.address, alice, KING_PER_BLOCK, 0, { from: alice });

        //this.uniLpToken = await MockERC20.new("UniSwap LP Token", "LPT", LP_TOKEN_AMOUNT.mul(web3.utils.toBN(2)), { from: alice });
        this.uniLpToken = this.pair;
        this.uniStake = await StakingRewards.new(alice, this.uniToken.address, this.uniLpToken.address, { from: alice });
        this.kingUniV2 = await KingUniV2.new(
            this.archbishop.address,
            this.uniLpToken.address,
            this.uniStake.address,
            this.uniToken.address,
            this.king.address,
            fee,
            { from: alice }
        );
        await this.king.transferOwnership(this.archbishop.address, { from: alice });

        assert.equal((await this.kingUniV2.totalSupply()).valueOf(), 0);
        assert.equal((await this.kingUniV2.lpToken()).valueOf(), this.uniLpToken.address);
        assert.equal((await this.kingUniV2.uniStaking()).valueOf(), this.uniStake.address);
        assert.equal((await this.kingUniV2.lastRewardBlock()).valueOf(), 0);
        assert.equal((await this.kingUniV2.accKingPerShare()).valueOf(), 0);
        assert.equal((await this.kingUniV2.accUniPerShare()).valueOf(), 0);
        assert.equal((await this.kingUniV2.uniToken()).valueOf(), this.uniToken.address);
        assert.equal((await this.kingUniV2.king()).valueOf(), this.king.address);
        assert.equal((await this.kingUniV2.archbishop()).valueOf(), this.archbishop.address);
        assert.equal((await this.kingUniV2.migrator()).valueOf(), AddressZero);
        assert.equal((await this.kingUniV2.uniTokenFeeReceiver()).valueOf(), fee);
        assert.equal((await this.kingUniV2.uniFeeRatio()).valueOf(), 10);
        assert.equal((await this.kingUniV2.isMigrateComplete()).valueOf(), 0);

        //Archbishop add Pool
        await this.archbishop.add(100, this.kingUniV2.address, true, { from: alice });

        await this.uniToken.transfer(this.uniStake.address, '5000000000000000000000000');
        await this.uniStake.notifyRewardAmount('5000000000000000000000000');
    });

    it('should allow emergency withdraw', async () => {
        //mint uniswap lp token to bob
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.kingUniV2.emergencyWithdraw({ from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
    });


    it('should deposit and withdraw correct', async () => {
        //mint uniswap lp token to bob
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.uniLpToken.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());

        await this.kingUniV2.withdraw(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        await this.kingUniV2.withdraw(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).toString(), (LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).toString(), "0");
        assert.equal((await this.uniLpToken.balanceOf(this.kingUniV2.address)).toString(), "0");
        assert.equal((await this.kingUniV2.totalSupply()).toString(), "0");
    });



    it('should pending works right', async () => {
        //mint uniswap lp token to bob
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.uniLpToken.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());

        const minWithdrawInterval = web3.utils.toBN(100);
        const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
        await time.advanceBlockTo(withoutFeeBlock);
        await time.increase('10');

        const bob_reward = await this.kingUniV2.pending(bob);
        assert.equal(bob_reward[0].gt(KING_PER_BLOCK.mul(minWithdrawInterval).mul(LP_TOKEN_AMOUNT).div((await this.kingUniV2.totalSupply()))), true);
        const carol_reward = await this.kingUniV2.pending(carol);
        assert.equal(carol_reward[0].gt(KING_PER_BLOCK.mul(minWithdrawInterval).mul(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).div((await this.kingUniV2.totalSupply()))), true)

        assert.equal(bob_reward[1].div(carol_reward[1]).toString(), "2");
    });

    it('should both withdraw king and uni rewards', async () => {
        //mint uniswap lp token to bob
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        const minWithdrawInterval = web3.utils.toBN(100);
        const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
        await time.advanceBlockTo(withoutFeeBlock);
        await time.increase('10');
        await this.kingUniV2.deposit(0, { from: bob });
        const uniRewardRate = await this.uniStake.rewardRate();
        console.log(uniRewardRate.toString());
        assert.equal((await this.king.balanceOf(bob)).toString(), LP_TOKEN_AMOUNT.mul(await this.kingUniV2.accKingPerShare())
                .div(web3.utils.toBN("1000000000000")));
        assert.equal((await this.uniToken.balanceOf(bob)).gt(web3.utils.toBN(0)), true);
    });

    it('should migrate works well', async () => {
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.uniLpToken.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());


        const minWithdrawInterval = web3.utils.toBN(100);
        const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
        await time.advanceBlockTo(withoutFeeBlock);
        await time.increase('10');

        //deploy new factory
        NewKingSwapFactory = await KingSwapFactory.new(alice, { from: alice });

        assert.equal((await this.kingUniV2.migrator()).valueOf(), AddressZero);
        migrator = await Migrator.new(this.kingUniV2.address, this.KingSwapFactory.address, NewKingSwapFactory.address, 0);
        await this.kingUniV2.setMigrator(migrator.address);
        await NewKingSwapFactory.setMigrator(migrator.address, { from: alice });

        const oldBalance = (await this.pair.balanceOf(this.uniStake.address));
        console.log("oldBalance: " + oldBalance.toString());
        //create new pair in new factory
        await NewKingSwapFactory.createPair(this.tokenA.address, this.tokenB.address, { from: alice })
        var pairAddress = await NewKingSwapFactory.getPair(this.tokenA.address, this.tokenB.address);
        var newPair = await KingSwapPair.at(pairAddress);

        await this.kingUniV2.migrate();
        assert.equal((await this.pair.balanceOf(this.kingUniV2.address)).toString(), "0");
        assert.equal((await newPair.balanceOf(this.kingUniV2.address)).toString(), oldBalance);

        //can not deposit after migrate
        await this.kingUniV2.withdraw(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.king.balanceOf(bob)).gt(web3.utils.toBN(0)), true);
        assert.equal((await this.uniToken.balanceOf(bob)).gt(web3.utils.toBN(0)), true);

        await this.kingUniV2.withdraw(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.king.balanceOf(carol)).gt(web3.utils.toBN(0)), true);
        assert.equal((await this.uniToken.balanceOf(carol)).gt(web3.utils.toBN(0)), true);

        assert.equal((await newPair.balanceOf(bob)).toString(), LP_TOKEN_AMOUNT.toString());
        assert.equal((await newPair.balanceOf(carol)).toString(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
    });

    it('should two pools works well', async () => {
        // deposit pool0
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.uniLpToken.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to kingUni2
        await this.uniLpToken.approve(this.kingUniV2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await this.kingUniV2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());

        //create new pair
        tokenC = await MockERC20.new("tokenC", "tokenC", expandTo18Decimals(100000000), { from: alice });
        tokenD = await MockERC20.new("tokenD", "tokenD", expandTo18Decimals(100000000), { from: alice });

        await this.KingSwapFactory.createPair(tokenC.address, tokenD.address, { from: alice })
        var pair2Address = await this.KingSwapFactory.getPair(tokenC.address, tokenD.address);
        var pair2 = await KingSwapPair.at(pair2Address);

        await tokenC.approve(this.router.address, expandTo18Decimals(100000000), { from: alice });
        await tokenD.approve(this.router.address, expandTo18Decimals(100000000), { from: alice });
        await this.router.addLiquidity(tokenC.address,
            tokenD.address,
            expandTo18Decimals(100000000),
            expandTo18Decimals(100000000),
            0,
            0,
            alice,
            MAX_UINT256,
            { from: alice });

        var uniStake2 = await StakingRewards.new(alice, this.uniToken.address, pair2.address, { from: alice });

        var kingUniV2_2 = await KingUniV2.new(
            this.archbishop.address,
            pair2.address,
            uniStake2.address,
            this.uniToken.address,
            this.king.address,
            fee,
            { from: alice }
        );

        await this.archbishop.add(100, kingUniV2_2.address, true, { from: alice });

        //deposit pool1
        await pair2.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await pair2.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to kingUni2
        await pair2.approve(kingUniV2_2.address, LP_TOKEN_AMOUNT, { from: bob });
        await kingUniV2_2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await pair2.balanceOf(bob)).valueOf(), 0);
        assert.equal((await pair2.balanceOf(uniStake2.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await pair2.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await pair2.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to kingUni2
        await pair2.approve(kingUniV2_2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await kingUniV2_2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await pair2.balanceOf(carol)).valueOf(), 0);
        assert.equal((await pair2.balanceOf(uniStake2.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());

        const minWithdrawInterval = web3.utils.toBN(100);
        const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
        await time.advanceBlockTo(withoutFeeBlock);
        await time.increase('10');

        await this.kingUniV2.withdraw(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.king.balanceOf(bob)).gt(1), true);
        assert.equal((await this.uniToken.balanceOf(bob)).gt(web3.utils.toBN(0)), true);

        await this.kingUniV2.withdraw(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.king.balanceOf(carol)).gt(1), true);
        assert.equal((await this.uniToken.balanceOf(carol)).gt(web3.utils.toBN(0)), true);

        await kingUniV2_2.withdraw(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.king.balanceOf(bob)).gt(1), true);
        assert.equal((await this.uniToken.balanceOf(bob)).gt(web3.utils.toBN(0)), true);

        await kingUniV2_2.withdraw(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.king.balanceOf(carol)).gt(1), true);
        assert.equal((await this.uniToken.balanceOf(carol)).gt(web3.utils.toBN(0)), true);
    });
})
