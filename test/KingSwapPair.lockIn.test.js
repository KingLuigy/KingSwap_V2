const { expectRevert } = require('@openzeppelin/test-helpers');
const KingToken = artifacts.require('KingToken');
const MockERC20 = artifacts.require('MockERC20');
const KingSwapPair = artifacts.require('KingSwapPair');
const KingSwapFactory = artifacts.require('KingSwapFactory');

contract('KingSwapPair::lockIn', ([alice, bob]) => {
    beforeEach(async () => {
        this.factory = await KingSwapFactory.new(alice, { from: alice });
        this.king = await KingToken.new({ from: alice });
        await this.king.mint(alice, '100000000', { from: alice });
        this.uni = await MockERC20.new('UNI', 'UNI', '100000000', { from: alice });
        this.pair = await KingSwapPair.at((await this.factory.createPair(this.king.address, this.uni.address)).logs[0].args.pair);
        // add liquidity
        await this.king.transfer(this.pair.address, '10000000', { from: alice });
        await this.uni.transfer(this.pair.address, '10000000', { from: alice });
        await this.pair.mint(alice);
        await this.king.transfer(this.pair.address, '10000000', { from: alice });
        await this.uni.transfer(this.pair.address, '10000000', { from: alice });
    });

    context('lockedIn0 == true && lockedIn1 == false', () => {
        beforeEach(async () => {
            const token0 = await this.pair.token0.call();
            const token1 = await this.pair.token1.call();
            await this.factory.lockInPair(token0, token1, true, false);
        });

        it('Should allow swap on: (amount0Out == 0 && amount1Out != 0)', async () => {
            await this.pair.swap('0', '10', alice, []);
        });
    
        xit('Should forbid swap on: (amount0Out == 0 && amount1Out == 0)', async () => {
            await expectRevert(this.pair.swap('0', '0', alice, []), 'Reason given: KingSwap: INSUFFICIENT_OUTPUT_AMOUNT');
        });
    
        it('Should forbid swap on: (amount0Out != 0 && amount1Out != 0)', async () => {
            await expectRevert(this.pair.swap('10', '10', alice, []), 'Reason given: KingSwap: TOKEN_LOCKED_IN');
        });
    
        it('Should forbid swap on: (amount0Out != 0 && amount1Out == 0)', async () => {
            await expectRevert(this.pair.swap('10', '0', alice, []), 'Reason given: KingSwap: TOKEN_LOCKED_IN');
        });
    });

    context('lockedIn0 == true && lockedIn1 == true', () => {
        beforeEach(async () => {
            const token0 = await this.pair.token0.call();
            const token1 = await this.pair.token1.call();
            await this.factory.lockInPair(token0, token1, true, true);
        });

        it('Should forbid swap on: (amount0Out == 0 && amount1Out != 0)', async () => {
            await expectRevert(this.pair.swap('0', '10', alice, []), 'Reason given: KingSwap: TOKEN_LOCKED_IN');
        });
    
        xit('Should forbid swap on: (amount0Out == 0 && amount1Out == 0)', async () => {
            await expectRevert(this.pair.swap('0', '0', alice, []), 'KingSwap: INSUFFICIENT_OUTPUT_AMOUNT');
        });
    
        it('Should forbid swap on: (amount0Out != 0 && amount1Out != 0)', async () => {
            await expectRevert(this.pair.swap('10', '10', alice, []), 'Reason given: KingSwap: TOKEN_LOCKED_IN');
        });
    
        it('Should forbid swap on: (amount0Out != 0 && amount1Out == 0)', async () => {
            await expectRevert(this.pair.swap('10', '0', alice, []), 'Reason given: KingSwap: TOKEN_LOCKED_IN');
        });
    });

    context('lockedIn0 == false && lockedIn1 == false', () => {
        beforeEach(async () => {
            const token0 = await this.pair.token0.call();
            const token1 = await this.pair.token1.call();
            await this.factory.lockInPair(token0, token1, false, false);
        });

        it('Should allow swap on: (amount0Out == 0 && amount1Out != 0)', async () => {
            await this.pair.swap('0', '10', alice, []);
        });
    
        xit('Should forbid swap on: (amount0Out == 0 && amount1Out == 0)', async () => {
            await expectRevert(this.pair.swap('0', '0', alice, []), 'KingSwap: INSUFFICIENT_OUTPUT_AMOUNT');
        });
    
        it('Should allow swap on: (amount0Out != 0 && amount1Out != 0)', async () => {
            await this.pair.swap('10', '10', alice, []);
        });
    
        it('Should allow swap on: (amount0Out != 0 && amount1Out == 0)', async () => {
            await this.pair.swap('10', '0', alice, []);
        });
    });

    context('lockedIn0 == false && lockedIn1 == true', () => {
        beforeEach(async () => {
            const token0 = await this.pair.token0.call();
            const token1 = await this.pair.token1.call();
            await this.factory.lockInPair(token0, token1, false, true);
        });

        it('Should forbid swap on: (amount0Out == 0 && amount1Out != 0)', async () => {
            await expectRevert(this.pair.swap('0', '10', alice, []), 'KingSwap: TOKEN_LOCKED_IN');
        });
    
        xit('Should forbid swap on: (amount0Out == 0 && amount1Out == 0)', async () => {
            await expectRevert(this.pair.swap('0', '0', alice, []), 'KingSwap: INSUFFICIENT_OUTPUT_AMOUNT');
        });
    
        it('Should forbid swap on: (amount0Out != 0 && amount1Out != 0)', async () => {
            await expectRevert(this.pair.swap('10', '10', alice, []), 'KingSwap: TOKEN_LOCKED_IN');
        });
    
        it('Should allow swap on: (amount0Out != 0 && amount1Out == 0)', async () => {
            await this.pair.swap('10', '0', alice, []);
        });
    });
})
