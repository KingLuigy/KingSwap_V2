/* global artifacts, asert, before, beforeEach, context, contract */
const { expectRevert, time } = require('@openzeppelin/test-helpers');

const KingDecks = artifacts.require('MockKingDecks');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721 = artifacts.require('MockERC721');

const { toBN } = (web3 ? web3 : require('web3')).utils;

contract('KingDecks', (accounts) => {
  const e18 = '000000000000000000';
  const e18andOne = '000000000000000001';
  const [ deployer, treasurer, alice, bob, klara, , anybody ] = accounts;

  context('_removeArrayElement internal function', () => {
    const els = [
      '108005765669190322414635507609697898386068044203237514870047565119433966354433',
      '108005765669190322414635507609697898386068044203237514870047565400908945031169',
      '113772348642185704331748229598741847809740133625785081752446362757204723236866'
    ]
    beforeEach(async () => {
      this.__t = await KingDecks.new(anybody);
      await this.__t.__addArrElements(els);
      assert.equal((await this.__t.__mockArrLength()).toString(), '3')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[0])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[1])
      assert.equal((await this.__t.__mockArr(2)).toString(), els[2])
    });

    xit('Should remove the 1st element', async () => {
      await this.__t.__removeArrayElement(els[0])

      assert.equal((await this.__t.__mockArrLength()).toString(), '2')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[1])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[2])
    });

    xit('Should remove the 2nd element', async () => {
      await this.__t.__removeArrayElement(els[1])

      assert.equal((await this.__t.__mockArrLength()).toString(), '2')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[0])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[2])
    });

    xit('Should remove the last element', async () => {
      await this.__t.__removeArrayElement(els[2])

      assert.equal((await this.__t.__mockArrLength()).toString(), '2')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[0])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[1])
    });

    xit('Should remove all elements', async () => {
      await this.__t.__removeArrayElement(els[1])
      assert.equal((await this.__t.__mockArrLength()).toString(), '2')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[0])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[2])

      await this.__t.__removeArrayElement(els[0])
      assert.equal((await this.__t.__mockArrLength()).toString(), '1')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[2])

      await this.__t.__removeArrayElement(els[0])
      assert.equal((await this.__t.__mockArrLength()).toString(), '0')
    });

    xit('Should remove all elements (#2)', async () => {
      await this.__t.__removeArrayElement(els[0])
      assert.equal((await this.__t.__mockArrLength()).toString(), '2')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[1])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[2])

      await this.__t.__removeArrayElement(els[1])
      assert.equal((await this.__t.__mockArrLength()).toString(), '1')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[2])

      await this.__t.__removeArrayElement(els[2])
      assert.equal((await this.__t.__mockArrLength()).toString(), '0')
    });

    xit('Should remove all elements (#3)', async () => {
      await this.__t.__removeArrayElement(els[2])
      assert.equal((await this.__t.__mockArrLength()).toString(), '2')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[0])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[1])

      await this.__t.__removeArrayElement(els[1])
      assert.equal((await this.__t.__mockArrLength()).toString(), '1')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[0])

      await this.__t.__removeArrayElement(els[0])
      assert.equal((await this.__t.__mockArrLength()).toString(), '0')
    });

    xit('Should remove 12 elements', async () => {
      await this.__t.__addArrElements([ '3', '4', '5', '6', '7', '8', '9', '10', '11' ]);
      assert.equal((await this.__t.__mockArrLength()).toString(), '12')

      await this.__t.__removeArrayElement(els[0])
      await this.__t.__removeArrayElement('7')
      await this.__t.__removeArrayElement('3')
      await this.__t.__removeArrayElement('11')
      await this.__t.__removeArrayElement(els[1])
      assert.equal((await this.__t.__mockArrLength()).toString(), '7')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[2])
      assert.equal((await this.__t.__mockArr(5)).toString(), '9')

      await this.__t.__removeArrayElement(els[2])
      await this.__t.__removeArrayElement('4')
      await this.__t.__removeArrayElement('5')
      await this.__t.__removeArrayElement('10')
      await this.__t.__removeArrayElement('9')
      await this.__t.__removeArrayElement('8')
      assert.equal((await this.__t.__mockArrLength()).toString(), '1')
      assert.equal((await this.__t.__mockArr(0)).toString(), '6')

      await this.__t.__removeArrayElement('6')
      assert.equal((await this.__t.__mockArrLength()).toString(), '0')
    });
  });

  const limits = [
    { // 0: id = 1
      minAmount: '10'+e18,
      maxAmountFactor: '0' // max amount unlimited
    },
    { // 1: id = 2
      minAmount: '10'+e18,
      maxAmountFactor: '50'+'0000' // scaled by 1e4
    },
    { // 2: id = 3
      minAmount: '1',
      maxAmountFactor: '2'+'0000' // scaled by 1e4
    },
    { // 3: id = 4
      minAmount: `${1e6}`+e18,
      maxAmountFactor: '1000'+'0000'
    },
  ];

  const getSampleTermSheet = () => ({
    enabled: true,
    inTokenId: 33,
    nfTokenId: 34,
    outTokenId: 35,
    earlyWithdrawShare: 192,
    earlyWithdrawFees: 64,
    limitId: 2,
    depositHours: 1000,
    minInterimHours: 1,
    rate: 3e5, // scaled by 1e6
    allowedNftNumBitMask: parseInt('1010001',2),
  });

  const getSampleDeposit = (repaymentTime = 1000 * 3600 + 100, lastWithdrawTime = 100) => ({
    amountDue: '100'+e18,
    repaymentTime,
    lastWithdrawTime,
    termsId: 1,
    nftId: 9,
  });


  context('__computeEarlyWithdrawal internal function', () => {
    before(async () => {
      this.decks = await KingDecks.new(anybody);
      this.sampleDeposit = getSampleDeposit();
      this.sampleTermSheet = getSampleTermSheet();
    });

    it('Should return zeros for t == lastWithdrawTime', async () => {
      const { amountToUser,fees } = await this.decks.__computeEarlyWithdrawal(
          this.sampleDeposit, this.sampleTermSheet, this.sampleDeposit.lastWithdrawTime.toString()
      );
      assert.equal(amountToUser.toString(), '0');
      assert.equal(fees.toString(), '0');
    });

    it('Should return zeros for t == repaymentTime', async () => {
      const { amountToUser,fees } = await this.decks.__computeEarlyWithdrawal(
          this.sampleDeposit, this.sampleTermSheet, this.sampleDeposit.repaymentTime.toString()
      );
      assert.equal(amountToUser.toString(), '0');
      assert.equal(fees.toString(), '0');
    });

    it('Should return zeros for t > repaymentTime', async () => {
      const { amountToUser,fees } = await this.decks.__computeEarlyWithdrawal(
          this.sampleDeposit, this.sampleTermSheet, (this.sampleDeposit.repaymentTime + 1).toString()
      );
      assert.equal(amountToUser.toString(), '0');
      assert.equal(fees.toString(), '0');
    });

    it('Should return non-zero values for lastWithdrawTime < t < repaymentTime', async () => {
      const { amountToUser,fees } = await this.decks.__computeEarlyWithdrawal(
          this.sampleDeposit, this.sampleTermSheet, (this.sampleDeposit.repaymentTime - 1).toString()
      );
      assert.equal(amountToUser.gt(toBN(0)), true);
      assert.equal(fees.gt(toBN(0)), true);
    });

    context('with earlyWithdrawShare of 100% and earlyWithdrawFees of 0%', () => {
      before(async () => {
        this.sampleTermSheet2 = getSampleTermSheet();
        this.sampleTermSheet2.earlyWithdrawShare = 255; // in 1/255 parts
        this.sampleTermSheet2.earlyWithdrawFees = 0;
      });

      it('Should return 75% of amountDue when 1/4 deposit period passes', async () => {
        const { amountToUser, fees } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit,
            this.sampleTermSheet2,
            parseInt(`${(this.sampleDeposit.repaymentTime - this.sampleDeposit.lastWithdrawTime) / 4 + this.sampleDeposit.lastWithdrawTime}`).toString()
        );
        assert.equal(
            amountToUser.toString(),
            toBN(this.sampleDeposit.amountDue).mul(toBN('3')).div(toBN('4')).toString()
        );
        assert.equal(fees.toString(), '0');
      });

      it('Should return 50% of amountDue when 1/2 deposit period passes', async () => {
        const { amountToUser, fees } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit,
            this.sampleTermSheet2,
            parseInt(`${(this.sampleDeposit.repaymentTime - this.sampleDeposit.lastWithdrawTime) / 2 + this.sampleDeposit.lastWithdrawTime}`).toString()
        );
        assert.equal(
            amountToUser.toString(),
            toBN(this.sampleDeposit.amountDue).div(toBN('2')).toString()
        );
        assert.equal(fees.toString(), '0');
      });

      it('Should return 25% of amountDue when 3/4 deposit period passes', async () => {
        const { amountToUser,fees } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit,
            this.sampleTermSheet2,
            parseInt(`${(this.sampleDeposit.repaymentTime - this.sampleDeposit.lastWithdrawTime) * 3/4 + this.sampleDeposit.lastWithdrawTime}`).toString()
        );
        assert.equal(
            amountToUser.toString(),
            toBN(this.sampleDeposit.amountDue).div(toBN('4')).toString()
        );
        assert.equal(fees.toString(), '0');
      });
    });

  });
});
