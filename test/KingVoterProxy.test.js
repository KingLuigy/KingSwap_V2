const KingToken = artifacts.require('KingToken');
const Archbishop = artifacts.require('Archbishop');
const RoundTable = artifacts.require('RoundTable');
const KingVoterCalc = artifacts.require('KingVoterCalc');
const MockERC20 = artifacts.require('MockERC20');
const KingSwapPair = artifacts.require('KingSwapPair');
const KingSwapFactory = artifacts.require('KingSwapFactory');
const STokenMaster = artifacts.require('STokenMaster');
const ArchbishopV2 = artifacts.require('ArchbishopV2');
const KingVoterProxy = artifacts.require('KingVoterProxy');
const TOTAL_SUPPLY = 10000000;
const LP_SUPPLY    = 1000000;

contract('KingVoterProxy', ([alice, bob, carol, dev, admin, kingfee, kingServant, minter]) => {
    beforeEach(async () => {
        this.kingToken = await KingToken.new({ from: alice });
        await this.kingToken.mint(minter, TOTAL_SUPPLY, { from: alice });
        this.RoundTable = await RoundTable.new(this.kingToken.address,{ from: alice });
        this.sTokenMaster = await STokenMaster.new(this.kingToken.address, bob, carol, '200', '10', '0', '300000', { from: alice });
        this.archbishop = await Archbishop.new(this.kingToken.address, dev, '1000', '0', { from: alice });
        this.archbishopV2 = await ArchbishopV2.new(this.kingToken.address, admin, kingServant, kingfee, '0', { from: alice });
        this.KingVoterCalc = await KingVoterCalc.new(this.kingToken.address, this.RoundTable.address, this.sTokenMaster.address, this.archbishop.address, this.archbishopV2.address,{ from: alice });
        this.KingVoterCalc2 = await KingVoterCalc.new(this.kingToken.address, this.RoundTable.address, this.sTokenMaster.address, this.archbishop.address, this.archbishopV2.address,{ from: alice });
        this.KingVoterProxy = await KingVoterProxy.new(this.KingVoterCalc.address, { from: alice });
    });

    it('check totalSupply', async () => {
        await this.kingToken.mint(alice, '10000', { from: alice });
        await this.kingToken.mint(bob, '10000', { from: alice });
        await this.kingToken.mint(carol, '10000', { from: alice });
        //sqrt(10030000)
        assert.equal((await this.KingVoterCalc.totalSupply()).valueOf(), '3167');
        await this.kingToken.mint(carol, '50000', { from: alice });
        //sqrt(10080000)
        assert.equal((await this.KingVoterCalc.totalSupply()).valueOf(), '3174');
        await this.kingToken.mint(bob, '50000', { from: alice });
        //sqrt(10130000)
        assert.equal((await this.KingVoterCalc.totalSupply()).valueOf(), '3182');
        this.KingVoterCalc.setSqrtEnable(false, { from: alice });
        assert.equal((await this.KingVoterCalc.totalSupply()).valueOf(), '10130000');
        this.KingVoterCalc.setSqrtEnable(true, { from: alice });
        assert.equal((await this.KingVoterCalc.totalSupply()).valueOf(), '3182');
        //roundtable enter
        await this.kingToken.approve(this.RoundTable.address, '10000', { from: carol });
        await this.RoundTable.enter('10000',{ from: carol });
        //sqrt(10140000)
        assert.equal((await this.KingVoterCalc.totalSupply()).valueOf(), '3182');
        await this.KingVoterCalc.setPow(2,1,0, { from: alice });
        // totalSupply = //sqrt(10130000)
        assert.equal((await this.KingVoterCalc.totalSupply()).valueOf(), '3181');
        await this.KingVoterCalc.setPow(2,1,2, { from: alice });
        // totalSupply = //sqrt(10150000)
        assert.equal((await this.KingVoterCalc.totalSupply()).valueOf(), '3184');
        assert.equal((await this.KingVoterProxy.totalSupply()).valueOf(), '3184');
    });

    it('check balanceOf', async () => {
        // test xking voter
        //bob 20000 king
        await this.kingToken.transfer(bob, 20000, { from: minter });
        //roundtable enter -> 10000 xking , 10000 king
        await this.kingToken.approve(this.RoundTable.address, '20000', { from: bob });
        await this.RoundTable.enter('20000',{ from: bob });
        //sqrt(20000)
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '141');
        await this.RoundTable.leave('10000',{ from: bob });
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '141');

        //archbishop
        this.factory0 = await KingSwapFactory.new(alice, { from: alice });
        this.factory1 = await KingSwapFactory.new(alice, { from: alice });
        this.factory3 = await KingSwapFactory.new(alice, { from: alice });
        this.factory4 = await KingSwapFactory.new(alice, { from: alice });
        await this.kingToken.transferOwnership(this.archbishop.address, { from: alice });
        this.token0 = await MockERC20.new('TToken', 'TOKEN0', TOTAL_SUPPLY, { from: minter });
        this.lp0 = await KingSwapPair.at((await this.factory0.createPair(this.token0.address, this.kingToken.address)).logs[0].args.pair);
        await this.token0.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.kingToken.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.lp0.mint(minter);
        await this.archbishop.add('100', this.lp0.address, true);
        await this.lp0.transfer(bob, '10000', { from: minter });
        await this.lp0.approve(this.archbishop.address, '10000', { from: bob });
        await this.archbishop.deposit(0, '10000', { from: bob });
        //console.log("get bob balanceOf",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        this.KingVoterCalc.addVotePool(this.lp0.address, { from: alice });
        //sqrt(lp 10000*2 + roundtable 10000 + king 10000)
        //console.log("get bob balanceOf1",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '200');
        this.token1 = await MockERC20.new('TToken1', 'TOKEN1', TOTAL_SUPPLY, { from: minter });
        this.lp1 = await KingSwapPair.at((await this.factory1.createPair(this.token1.address, this.kingToken.address)).logs[0].args.pair);
        await this.token1.transfer(this.lp1.address, LP_SUPPLY, { from: minter });
        await this.kingToken.transfer(this.lp1.address, LP_SUPPLY, { from: minter });
        await this.lp1.mint(minter);
        await this.archbishop.add('100', this.lp1.address, true);
        await this.lp1.transfer(bob, '20000', { from: minter });
        await this.lp1.approve(this.archbishop.address, '10000', { from: bob });
        await this.archbishop.deposit(1, '10000', { from: bob });
        //sqrt(lp 30000*2 + roundtable 10000 + king 10000)
        await this.KingVoterCalc.addVotePool(this.lp1.address, { from: alice });
        //console.log("get bob balanceOf2",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        await this.KingVoterCalc.delVotePool(this.lp0.address, { from: alice });
        //sqrt(lp 20000*2 + roundtable 10000 + king 10000)
        //console.log("get bob balanceOf3",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '244');
        assert.equal((await this.KingVoterProxy.balanceOf(bob)).valueOf(), '244');
        // await this.archbishop.withdraw(1, '10000', { from: bob });
        // //no change
        // console.log("get bob balanceOf4",(await this.KingVoterCalc.balanceOf(bob)).valueOf());

         //test archbishopV2
        this.tokenst1 = await MockERC20.new('ST1Token', 'TOKENST', TOTAL_SUPPLY, { from: minter });
        this.lpst1 = await KingSwapPair.at((await this.factory3.createPair(this.tokenst1.address, this.kingToken.address)).logs[0].args.pair);
        await this.tokenst1.transfer(this.lpst1.address, LP_SUPPLY, { from: minter });
        await this.kingToken.transfer(this.lpst1.address, LP_SUPPLY, { from: minter });
        await this.lpst1.mint(minter);
        await this.archbishopV2.setKingPerBlockYieldFarming('5', false,{ from: admin });
        await this.archbishopV2.setKingPerBlockTradeMining('10', false,{ from: admin });
        await this.archbishopV2.setWithdrawInterval('1', { from: admin });
        await this.archbishopV2.add('100', '100', this.lpst1.address, this.tokenst1.address, false, { from: admin });
        await this.lpst1.transfer(bob, '10000', { from: minter });
        await this.tokenst1.transfer(bob, '10000', { from: minter });
        await this.lpst1.approve(this.archbishopV2.address, '10000', { from: bob });
        await this.tokenst1.approve(this.archbishopV2.address, '10000', { from: bob });
        await this.archbishopV2.deposit(0, '10000', '10000',{ from: bob });
        //sqrt(lp 20000*2 + roundtable 10000 + king 10000)
        //console.log("get bob balanceOf5",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        await this.KingVoterCalc.addVotePool(this.lpst1.address, { from: alice });
        //voter = sqrt(lp 30000*2 + roundtable 10000 + king 10000)
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '282');
        assert.equal((await this.KingVoterProxy.balanceOf(bob)).valueOf(), '282');
        // console.log("get bob balanceOf6",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        // console.log("get lp0",this.lp0.address);
        // console.log("get lp0 index",(await this.KingVoterCalc.getVotePool(this.lp0.address)).valueOf());
        // console.log("get lp1",this.lp1.address);
        // console.log("get lp1 index",(await this.KingVoterCalc.getVotePool(this.lp1.address)).valueOf());
        // console.log("get lpst1",this.lpst1.address);
        // console.log("get lpst1 index",(await this.KingVoterCalc.getVotePool(this.lpst1.address)).valueOf());
        await this.archbishopV2.withdraw(0, '10000', { from: bob });
        //voter = sqrt(lp 30000*2 + roundtable 10000 + king 10000)
        //console.log("get bob balanceOf7",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '282');
        this.tokenst2 = await MockERC20.new('ST2Token', 'TOKENST', TOTAL_SUPPLY, { from: minter });
        this.lpst2 = await KingSwapPair.at((await this.factory4.createPair(this.tokenst2.address, this.kingToken.address)).logs[0].args.pair);
        await this.tokenst2.transfer(this.lpst2.address, LP_SUPPLY, { from: minter });
        await this.kingToken.transfer(this.lpst2.address, LP_SUPPLY, { from: minter });
        await this.lpst2.mint(minter);
        await this.archbishopV2.add('100', '100', this.lpst2.address, this.tokenst2.address, false, { from: admin });
        await this.lpst2.transfer(bob, '20000', { from: minter });
        await this.tokenst2.transfer(bob, '20000', { from: minter });
        await this.lpst2.approve(this.archbishopV2.address, '20000', { from: bob });
        await this.tokenst2.approve(this.archbishopV2.address, '20000', { from: bob });
        await this.archbishopV2.deposit(1, '10000', '10000',{ from: bob });
        await this.KingVoterCalc.addVotePool(this.lpst2.address, { from: alice });
        //voter = sqrt(lp 50000*2 + roundtable 10000 + king 10000)
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '346');
        await this.KingVoterCalc.delVotePool(this.lpst1.address, { from: alice });
        //voter = sqrt(lp 40000*2 + roundtable 10000 + king 10000)
        //console.log("get bob balanceOf8",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '316');

        //test setPow
        await this.KingVoterCalc.setPow(2,1,0, { from: alice });
        // voter = sqrt(2*40000+1*10000)
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '300');
        await this.KingVoterCalc.setPow(1,1,0, { from: alice });
        //voter = sqrt(1*40000+1*10000)
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '223');
        await this.KingVoterCalc.setPow(1,1,2, { from: alice });
        //voter = sqrt(1*40000+1*10000+2*10000)
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '264');
        await this.KingVoterCalc.setPow(2,1,1, { from: alice });

        //test setSqrtEnable
        await this.KingVoterCalc.setSqrtEnable(false, { from: alice });
        //voter = (2*40000+1*10000+1*10000)
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '100000');
        await this.KingVoterCalc.setSqrtEnable(true, { from: alice });
        //voter = sqrt(2*40000+1*10000+1*10000)
        assert.equal((await this.KingVoterCalc.balanceOf(bob)).valueOf(), '316');
        assert.equal((await this.KingVoterProxy.balanceOf(bob)).valueOf(), '316');
    });

    it('check setCalcAddr', async () => {
        await this.kingToken.transfer(bob, 20000, { from: minter });
        //roundtable enter -> 10000 xking , 10000 king
        await this.kingToken.approve(this.RoundTable.address, '20000', { from: bob });
        await this.RoundTable.enter('20000',{ from: bob });
        await this.RoundTable.leave('10000',{ from: bob });
        this.factory0 = await KingSwapFactory.new(alice, { from: alice });
        await this.kingToken.transferOwnership(this.archbishop.address, { from: alice });
        this.token0 = await MockERC20.new('TToken', 'TOKEN0', TOTAL_SUPPLY, { from: minter });
        this.lp0 = await KingSwapPair.at((await this.factory0.createPair(this.token0.address, this.kingToken.address)).logs[0].args.pair);
        await this.token0.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.kingToken.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.lp0.mint(minter);
        await this.archbishop.add('100', this.lp0.address, true);
        await this.lp0.transfer(bob, '10000', { from: minter });
        await this.lp0.approve(this.archbishop.address, '10000', { from: bob });
        await this.archbishop.deposit(0, '10000', { from: bob });
        //console.log("get bob balanceOf",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        this.KingVoterCalc.addVotePool(this.lp0.address, { from: alice });
        //sqrt(lp 10000*2 + roundtable 10000 + king 10000)
        //console.log("get bob balanceOf1",(await this.KingVoterCalc.balanceOf(bob)).valueOf());
        assert.equal((await this.KingVoterProxy.balanceOf(bob)).valueOf(), '200');
        await this.KingVoterProxy.setCalcAddr(this.KingVoterCalc2.address, { from: alice });
        //sqrt(roundtable 10000 + king 10000)
        assert.equal((await this.KingVoterProxy.balanceOf(bob)).valueOf(), '141');
        await this.KingVoterProxy.setCalcAddr(this.KingVoterCalc.address, { from: alice });
        assert.equal((await this.KingVoterProxy.balanceOf(bob)).valueOf(), '200');
    });
});
