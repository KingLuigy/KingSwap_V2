/* global artifacts, asert, before, beforeEach, context, contract */
const { expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const KingDecks = artifacts.require('MockKingDecks');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721 = artifacts.require('MockERC721');

const { toBN } = (web3 ? web3 : require('web3')).utils;

contract('KingDecks', (accounts) => {
  const e18 = '000000000000000000';
  const e15 = '000000000000000';
  const e18andOne = '000000000000000001';
  const [ deployer, treasury, alice, bob, klara, , anybody ] = accounts;

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

  const getSampleTermSheet = (params = {}) => Object.assign({
    availableQty: 255,
    inTokenId: 33,
    nfTokenId: 34,
    outTokenId: 35,
    earlyRepayableShare: 192,
    earlyWithdrawFees: 64,
    limitId: 2,
    depositHours: 1000,
    minInterimHours: 1,
    rate: 3e5, // scaled by 1e6
    allowedNftNumBitMask: parseInt('1010001',2),
  }, params);

  const getSampleDeposit = (maturityTime = 1000 * 3600 + 100, lastWithdrawTime = 100) => ({
    amountDue: '100'+e18,
    maturityTime,
    lastWithdrawTime,
    lockedShare: 192*(2**16 - 1)/255
  });

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

    it('Should remove the 1st element', async () => {
      await this.__t.__removeArrayElement(els[0])

      assert.equal((await this.__t.__mockArrLength()).toString(), '2')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[1])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[2])
    });

    it('Should remove the 2nd element', async () => {
      await this.__t.__removeArrayElement(els[1])

      assert.equal((await this.__t.__mockArrLength()).toString(), '2')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[0])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[2])
    });

    it('Should remove the last element', async () => {
      await this.__t.__removeArrayElement(els[2])

      assert.equal((await this.__t.__mockArrLength()).toString(), '2')
      assert.equal((await this.__t.__mockArr(0)).toString(), els[0])
      assert.equal((await this.__t.__mockArr(1)).toString(), els[1])
    });

    it('Should remove all elements', async () => {
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

    it('Should remove all elements (#2)', async () => {
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

    it('Should remove all elements (#3)', async () => {
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

    it('Should remove 12 elements', async () => {
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

  context('__computeEarlyWithdrawal internal function', () => {
    before(async () => {
      this.decks = await KingDecks.new(anybody);
      this.sampleDeposit = getSampleDeposit();
      this.sampleTermSheet = getSampleTermSheet();
    });

    it('Should return zeros for t == lastWithdrawTime', async () => {
      const { amountToUser, fees } = await this.decks.__computeEarlyWithdrawal(
          this.sampleDeposit, this.sampleTermSheet, this.sampleDeposit.lastWithdrawTime.toString()
      );
      assert.equal(amountToUser.toString(), '0');
      assert.equal(fees.toString(), '0');
    });

    it('Should return zeros for t == maturityTime', async () => {
      const { amountToUser, fees } = await this.decks.__computeEarlyWithdrawal(
          this.sampleDeposit, this.sampleTermSheet, this.sampleDeposit.maturityTime.toString()
      );
      assert.equal(amountToUser.toString(), '0');
      assert.equal(fees.toString(), '0');
    });

    it('Should return zeros for t > maturityTime', async () => {
      const { amountToUser, fees } = await this.decks.__computeEarlyWithdrawal(
          this.sampleDeposit, this.sampleTermSheet, (this.sampleDeposit.maturityTime + 1).toString()
      );
      assert.equal(amountToUser.toString(), '0');
      assert.equal(fees.toString(), '0');
    });

    it('Should return non-zero values for lastWithdrawTime < t < maturityTime', async () => {
      const { amountToUser, fees } = await this.decks.__computeEarlyWithdrawal(
          this.sampleDeposit, this.sampleTermSheet, (this.sampleDeposit.maturityTime - 1).toString()
      );
      assert.equal(amountToUser.gt(toBN(0)), true);
      assert.equal(fees.gt(toBN(0)), true);
    });

    context('with earlyRepayableShare of 100% and earlyWithdrawFees of 0%', () => {
      before(async () => {
        this.sampleTermSheet2 = getSampleTermSheet();
        this.sampleTermSheet2.earlyRepayableShare = 255; // 100% in 1/255 parts
        this.sampleTermSheet2.earlyWithdrawFees = 0;
        this.sampleTermSheet2.depositHours = 1000;

        this.sampleDeposit2 = getSampleDeposit(1000 * 3600 + 100, 100);
        this.sampleDeposit2.amountDue = '100'+e18;
        this.sampleDeposit2.lockedShare = 0; // (255-255)*65535/255
      });

      it('Should return 25% of amountDue as amountToUser when 1/4 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${900 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '25'+e18);
        assert.equal(fees.toString(), '0');
        assert.equal(newlockedShare.toString(), '0');
      });

      it('Should return 50% of amountDue as amountToUser when 1/2 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${1800 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '50'+e18);
        assert.equal(fees.toString(), '0');
        assert.equal(newlockedShare.toString(), '0');
      });

      it('Should return 75% of amountDue as amountToUser when 3/4 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${2700 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '75'+e18);
        assert.equal(fees.toString(), '0');
        assert.equal(newlockedShare.toString(), '0');
      });
    });

    context('with earlyRepayableShare of 40% and earlyWithdrawFees of 0%', () => {
      before(async () => {
        this.sampleTermSheet2 = getSampleTermSheet();
        this.sampleTermSheet2.earlyRepayableShare = 102; // 40% in 1/255 parts
        this.sampleTermSheet2.earlyWithdrawFees = 0;
        this.sampleTermSheet2.depositHours = 1000;

        this.sampleDeposit2 = getSampleDeposit(1000 * 3600 + 100, 100);
        this.sampleDeposit2.amountDue = '100'+e18;
        this.sampleDeposit2.lockedShare = 39321 // (255-102)*65535/255
      });

      it('Should return 10% of amountDue as amountToUser when 1/4 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${900 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '10'+e18);
        assert.equal(fees.toString(), '0');
        // non-repayable-early amount: (100%-40%)*amount_due; new amount due: (100%-10%)*amount_due
        assert.equal(newlockedShare.toString(), parseInt(`${60e18*65535/90e18}`).toString());
      });

      it('Should return 20% of amountDue as amountToUser when 1/2 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${1800 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '20'+e18);
        assert.equal(fees.toString(), '0');
        // non-repayable-early amount: (100%-40%)*amount_due; new amount due: (100%-20%)*amount_due
        assert.equal(newlockedShare.toString(), parseInt(`${60e18*65535/80e18 + 1}`).toString());
      });

      it('Should return 30% of amountDue as amountToUser when 3/4 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${2700 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '30'+e18);
        assert.equal(fees.toString(), '0');
        // non-repayable-early amount: (100%-40%)*amount_due; new amount due: (100%-30%)*amount_due
        assert.equal(newlockedShare.toString(), parseInt(`${60e18*65535/70e18 + 1}`).toString());
      });
    });

    context('with earlyRepayableShare of 100% and earlyWithdrawFees of 20%', () => {
      before(async () => {
        this.sampleTermSheet2 = getSampleTermSheet();
        this.sampleTermSheet2.earlyRepayableShare = 255; // 100% in 1/255 parts
        this.sampleTermSheet2.earlyWithdrawFees = 51; // 20% in 1/255 parts
        this.sampleTermSheet2.depositHours = 1000;

        this.sampleDeposit2 = getSampleDeposit(1000 * 3600 + 100, 100);
        this.sampleDeposit2.amountDue = '100'+e18;
        this.sampleDeposit2.lockedShare = 0; // (255-255)*65535/255
      });

      it('Should return 15% of 25% of amountDue as fees when 1/4 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${900 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '21250'+e15);
        assert.equal(fees.toString(), '3750'+e15);
        // non-repayable-early amount: 0%
        assert.equal(newlockedShare.toString(), '0');
      });

      it('Should return 10% of 50% of amountDue as fees when 1/2 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${1800 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '45'+e18);
        assert.equal(fees.toString(), '5'+e18);
        // non-repayable-early amount: 0%
        assert.equal(newlockedShare.toString(), '0');
      });

      it('Should return 5% of 75% of amountDue as fees when 3/4 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${2700 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '71250'+e15);
        assert.equal(fees.toString(), '3750'+e15);
        // non-repayable-early amount: 0%
        assert.equal(newlockedShare.toString(), '0');
      });

      it('Should return 0 as newlockedShare a second before the maturity time', async () => {
        const { newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${3600 * 1000 + 99}`
        );
        // non-repayable-early amount: 0%
        assert.equal(newlockedShare.toString(), '0');
      });
    });

    context('with earlyRepayableShare of 40% and earlyWithdrawFees of 20%', () => {
      before(async () => {
        this.sampleTermSheet2 = getSampleTermSheet();
        this.sampleTermSheet2.earlyRepayableShare = 102; // 40% in 1/255 parts
        this.sampleTermSheet2.earlyWithdrawFees = 51; // 20% in 1/255 parts
        this.sampleTermSheet2.depositHours = 1000;

        this.sampleDeposit2 = getSampleDeposit(1000 * 3600 + 100, 100);
        this.sampleDeposit2.amountDue = '100'+e18;
        this.sampleDeposit2.lockedShare = 39321 // (255-102)*65535/255
      });

      it('Should return 15% of 10% of amountDue as fees when 1/4 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${900 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '8500'+e15);
        assert.equal(fees.toString(), '1500'+e15);
        // non-repayable-early amount: (100%-40%)*amount_due; new amount due: (100%-10%)*amount_due
        assert.equal(newlockedShare.toString(), parseInt(`${60e18*65535/90e18}`).toString());
      });

      it('Should return 10% of 20% of amountDue as fees when 1/2 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${1800 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '18000'+e15);
        assert.equal(fees.toString(), '2000'+e15);
        // non-repayable-early amount: (100%-40%)*amount_due; new amount due: (100%-20%)*amount_due
        assert.equal(newlockedShare.toString(), parseInt(`${60e18*65535/80e18 + 1}`).toString());
      });

      it('Should return 5% of 30% of amountDue as fees when 3/4 deposit period passes', async () => {
        const { amountToUser, fees, newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${2700 * 1000 + 100}`
        );
        assert.equal(amountToUser.toString(), '28500'+e15);
        assert.equal(fees.toString(), '1500'+e15);
        // non-repayable-early amount: (100%-40%)*amount_due; new amount due: (100%-30%)*amount_due
        assert.equal(newlockedShare.toString(), parseInt(`${60e18*65535/70e18 + 1}`).toString());
      });

      it('Should return ~65535 as newlockedShare a second before the maturity time', async () => {
        const { newlockedShare } = await this.decks.__computeEarlyWithdrawal(
            this.sampleDeposit2,
            this.sampleTermSheet2,
            `${3600 * 1000 + 99}`
        );
        // non-repayable-early amount: 0%
        assert.equal(newlockedShare.toString(), '65535');
      });
    });
  });

  context('TODO: create tests from "bulk test" bellow (#1)', () => {
    before(async () => {
      this.decks = await KingDecks.new(treasury);

      this.token0 = await MockERC20.new("token0", "T0", `${1e6}` + e18)
      await this.token0.transfer(treasury, `${0.1e6}` + e18);
      await this.token0.transfer(alice, `${0.1e6}` + e18);
      await this.token0.transfer(bob, `${0.1e6}` + e18);

      this.token1 = await MockERC20.new("token1", "T1", `${1e6}` + e18)
      await this.token1.transfer(treasury, `${0.1e6}` + e18);
      await this.token1.transfer(alice, `${0.1e6}` + e18);
      await this.token1.transfer(bob, `${0.1e6}` + e18);

      this.token2 = await MockERC20.new("token2", "T2", `${1e6}` + e18)
      await this.token2.transfer(treasury, `${0.1e6}` + e18);
      await this.token2.transfer(bob, `${0.1e6}` + e18);

      await this.token0.approve(this.decks.address, `${0.1e6}` + e18, { from: alice });
      await this.token0.approve(this.decks.address, `${0.1e6}` + e18, { from: bob });
      await this.token0.approve(this.decks.address, `${0.2e6}` + e18, { from: treasury });

      await this.token1.approve(this.decks.address, `${0.1e6}` + e18, { from: alice });
      await this.token1.approve(this.decks.address, `${0.1e6}` + e18, { from: bob });
      await this.token1.approve(this.decks.address, `${0.2e6}` + e18, { from: treasury });

      await this.token2.approve(this.decks.address, `${0.1e6}` + e18, { from: bob });
      await this.token2.approve(this.decks.address, `${0.2e6}` + e18, { from: treasury });

      this.nft = await MockERC721.new("Mock NFT", "NFT", deployer, 16)
      await this.nft.safeTransferFrom(deployer, alice, 1, '0x0')
      await this.nft.safeTransferFrom(deployer, bob, 7, '0x0')
      await this.nft.safeTransferFrom(deployer, bob, 11, '0x0')
      await this.nft.safeTransferFrom(deployer, bob, 12, '0x0')

      this.sampleDeposit = getSampleDeposit();
      this.sampleTermSheet = getSampleTermSheet();
    });

    before(async () => {
      await this.decks.addLimits(limits);
      await this.decks.addTokens(
          // ID = 33,            ID = 34,          ID = 35,             ID = 36
          [ this.token0.address, this.nft.address, this.token1.address, this.token2.address ],
          [ 1 /* Erc20 */,       2 /* Erc721 */,   1 /* Erc20 */,       1 /* Erc20 */ ]
      );
      await this.decks.addTerms([
        /*ID=1*/ getSampleTermSheet({ inTokenId: 33, outTokenId: 35, nfTokenId: 34, depositHours: 1, limitId: 1, rate: 1e4}),
        /*ID=2*/ getSampleTermSheet({ inTokenId: 33, outTokenId: 36, nfTokenId: 0, depositHours: 1, limitId: 2, rate: 2e6 }),
      ]);
    });

    it('Should register limits with the contract', async () => {
      assert.equal((await this.decks.depositLimitsNum()).toString(), `${limits.length}`);
      assert.equal(
          (await this.decks.depositLimit(2)).maxAmountFactor.toString(),
          limits[1].maxAmountFactor
      );
    });

    it('Should know mainnet addresses of $KING and DAI tokens', async () => {
      assert.equal(
          (await this.decks.getTokenData(1))[0].toLowerCase(),
          ('0x5a731151d6510Eb475cc7a0072200cFfC9a3bFe5').toLowerCase()
      );
      assert.equal(
          (await this.decks.getTokenData(4))[0].toLowerCase(),
          ('0x6B175474E89094C44Da98b954EedeAC495271d0F').toLowerCase()
      );
    });

    it('Should register tokens with the contract', async () => {
      assert.equal((await this.decks.getTokenData(33))[0].toLowerCase(), this.token0.address.toLowerCase());
      assert.equal((await this.decks.getTokenData(34))[0].toLowerCase(), this.nft.address.toLowerCase());
      assert.equal((await this.decks.getTokenData(35))[0].toLowerCase(), this.token1.address.toLowerCase());
      assert.equal((await this.decks.getTokenData(36))[0].toLowerCase(), this.token2.address.toLowerCase());
    });

    it('Should register term sheets with the contract', async () => {
      assert.equal((await this.decks.termSheetsNum()).toString(), '2');
      assert.equal((await this.decks.termSheet(2)).outTokenId.toString(), '36');
    });

    it('Should accept a deposit under the TermSheet #2', async () => {
      const balances = {
        beforeContractInToken: await this.token0.balanceOf(this.decks.address),
        beforeAliceInToken: await this.token0.balanceOf(alice),
        beforeTreasuryInToken: await this.token0.balanceOf(treasury),
      };

      const r = await this.decks.deposit(2, '10'+e18, 0, {from: alice});
      const timeNow = (await web3.eth.getBlock('latest')).timestamp;

      balances.afterContractInToken = await this.token0.balanceOf(this.decks.address);
      balances.afterAliceInToken =  await this.token0.balanceOf(alice);
      balances.afterTreasuryInToken = await this.token0.balanceOf(treasury);
      const log = expectEvent(r, 'NewDeposit');
      const depositId = log.args.depositId.toString();

      assert.equal(log.args.user.toLowerCase(), alice.toLowerCase());
      assert.equal(log.args.inTokenId.toString(), '33');
      assert.equal(log.args.outTokenId.toString(), '36');
      assert.equal(log.args.termsId.toString(), '2');
      assert.equal(log.args.amount.toString(), '10'+e18);
      assert.equal(log.args.amountDue.toString(), '20'+e18);
      assert.equal(log.args.maturityTime.toString(), `${3600 + timeNow}`);

      const deposit = await this.decks.depositData(alice, depositId);
      assert.equal(deposit.amountDue.toString(), log.args.amountDue.toString());
      assert.equal(deposit.maturityTime.toString(), log.args.maturityTime.toString());
      assert.equal(deposit.lastWithdrawTime.toString(), `${timeNow}`);

      assert.equal((await this.decks.totalDue('36')).toString(), '20'+e18);

      assert.equal(
          balances.beforeContractInToken.sub(balances.afterContractInToken).toString(),
          '0'
      );
      assert.equal(
          balances.beforeAliceInToken.sub(balances.afterAliceInToken).toString(),
          '10'+e18
      );
      assert.equal(
          balances.afterTreasuryInToken.sub(balances.beforeTreasuryInToken).toString(),
          '10'+e18
      );
    });

    it('Should accept a deposit under the TermSheet #1', async () => {
      const balances = {
        beforeContractInToken: await this.token0.balanceOf(this.decks.address),
        beforeContractNFT: await this.nft.balanceOf(this.decks.address),
        beforeBobInToken: await this.token0.balanceOf(bob),
        beforeTreasuryInToken: await this.token0.balanceOf(treasury),
      };

      await this.nft.approve(this.decks.address, '7', { from: bob })
      const r = await this.decks.deposit(1, '100'+e18, 7, {from: bob});
      const timeNow = (await web3.eth.getBlock('latest')).timestamp;

      balances.afterContractInToken = await this.token0.balanceOf(this.decks.address);
      balances.afterContractNFT = await this.nft.balanceOf(this.decks.address);
      balances.afterBobInToken =  await this.token0.balanceOf(bob);
      balances.afterTreasuryInToken = await this.token0.balanceOf(treasury);
      const log = expectEvent(r, 'NewDeposit');
      const depositId = log.args.depositId.toString();

      assert.equal(log.args.user.toLowerCase(), bob.toLowerCase());
      assert.equal(log.args.inTokenId.toString(), '33');
      assert.equal(log.args.outTokenId.toString(), '35');
      assert.equal(log.args.termsId.toString(), '1');
      assert.equal(log.args.amount.toString(), '100'+e18);
      assert.equal(log.args.amountDue.toString(), '1'+e18);
      assert.equal(log.args.maturityTime.toString(), `${3600 + timeNow}`);

      const deposit = await this.decks.depositData(bob, depositId);
      assert.equal(deposit.amountDue.toString(), log.args.amountDue.toString());
      assert.equal(deposit.maturityTime.toString(), log.args.maturityTime.toString());
      assert.equal(deposit.lastWithdrawTime.toString(), `${timeNow}`);

      assert.equal((await this.decks.totalDue('35')).toString(), '1'+e18);

      assert.equal(
          balances.beforeContractInToken.sub(balances.afterContractInToken).toString(),
          '0'
      );
      assert.equal(
          balances.beforeBobInToken.sub(balances.afterBobInToken).toString(),
          '100'+e18
      );
      assert.equal(
          balances.afterTreasuryInToken.sub(balances.beforeTreasuryInToken).toString(),
          '100'+e18
      );
      assert.equal(balances.beforeContractNFT.toString(), '0');
      assert.equal(balances.afterContractNFT.toString(), '1');
    });
  });
});
