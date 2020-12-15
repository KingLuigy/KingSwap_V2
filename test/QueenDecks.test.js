/* global artifacts, asert, before, beforeEach, context, contract */
const { expectRevert, time } = require('@openzeppelin/test-helpers');

const QueenDecks = artifacts.require('MockQueenDecks');
const MockERC20 = artifacts.require('MockERC20');

const e18 = '000000000000000000';
const e18andOne = '000000000000000001';

contract('QueenDecks', (accounts) => {
  const [ deployer, alice, bob, klara, , anybody ] = accounts;

  before(async () => {
    this.token0 = await MockERC20.new("token0", "T0", '1000000' + e18)
    this.token1 = await MockERC20.new("token1", "T0", '1000000' + e18)
    this.token2 = await MockERC20.new("token2", "T0", '1000000' + e18)

    this.decks = await QueenDecks.new(alice);
    this.termsheets = getTermSheetsArr(this.token0.address, this.token1.address, this.token2.address);
    await this.decks.addTerms(this.termsheets);
  });

  context('_removeArrayElement internal function', () => {
    const els = [
      '108005765669190322414635507609697898386068044203237514870047565119433966354433',
      '108005765669190322414635507609697898386068044203237514870047565400908945031169',
      '113772348642185704331748229598741847809740133625785081752446362757204723236866'
    ]
    beforeEach(async () => {
      this.__t = await QueenDecks.new(anybody);
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

  context('_rewardDue internal function', () => {
    const getSampleStake = () => ({
      amount: `${1e18}`,
      unlockTime:     '160001000',
      lastRewardTime: '160000000',
      rewardFactor: `${1.1e6}`,
      rewardLockHours: '1',
      lockHours: '1000',
    });

    it('shall return zero reward for zero amount', async() => {
      const stake = getSampleStake();
      stake.amount = '0';
      const reward = await this.decks.__rewardDue(stake, 160002000);
      assert.equal(await reward.toString(), '0');
    });

    it('shall return zero reward for for `timestamp <= lastRewardTime`', async() => {
      const stake = getSampleStake();
      const reward1 = await this.decks.__rewardDue(stake, 160000000);
      const reward2 = await this.decks.__rewardDue(stake, 159999999);
      assert.equal(await reward1.toString(), '0');
      assert.equal(await reward2.toString(), '0');
    });

    it('shall return zero reward for for `lastRewardTime >= unlockTime`', async() => {
      const stake1 = getSampleStake();
      stake1.lastRewardTime = '160001000'
      const stake2 = getSampleStake();
      stake2.lastRewardTime = '160001001'

      const reward1 = await this.decks.__rewardDue(stake1, 160005000);
      const reward2 = await this.decks.__rewardDue(stake2, 160005000);
      assert.equal(await reward1.toString(), '0');
      assert.equal(await reward2.toString(), '0');
    });

    it('shall return expected reward #1', async() => {
      const stake = getSampleStake();
      const reward = await this.decks.__rewardDue(stake, 160002000);
      assert.equal(
          await reward.toString(),
          parseInt(`${1e18 / (1000 * 3600) * (160001000 - 160000000)  * 1.1}`).toString(),
      );
    });

    it('shall return expected reward #2', async() => {
      const stake = getSampleStake();
      const reward = await this.decks.__rewardDue(stake, 160001000);
      assert.equal(
          await reward.toString(),
          parseInt(`${1e18 / (1000 * 3600) * (160001000 - 160000000)  * 1.1}`).toString(),
      );
    });

    it('shall return expected reward #3', async() => {
      const stake = getSampleStake();
      const reward = await this.decks.__rewardDue(stake, 160005000);
      assert.equal(
          await reward.toString(),
          parseInt(`${1e18 / (1000 * 3600) * (160001000 - 160000000)  * 1.1}`).toString(),
      );
    });

    it('shall return expected reward #4', async() => {
      const stake = getSampleStake();
      const reward = await this.decks.__rewardDue(stake, 160000500);
      assert.equal(
          await reward.toString(),
          parseInt(`${1e18 / (1000 * 3600) * (160000500 - 160000000)  * 1.1}`).toString(),
      );
    });
  });

    context('termsheet functions', () => {

    context('termsLength()', () => {
      xit('shall return number of termsheets', async() => {
        assert.equal((await this.decks.termsLength()).toString(), '5');
      });
    });

    context('allTermSheets(..)', () => {
      xit('shall return all termsheets', async() => {
        const sheets = await this.decks.allTermSheets();
        assert.equal(sheets.length, 5);
        assert.equal(sheets[3].maxAmountFactor.toString(), `${5e4}`);
      });
    });

    context('termSheet(..)', () => {
      xit('shall return all requested termsheet', async() => {
        const sheet = await this.decks.termSheet(3);
        assert.equal(sheet.maxAmountFactor.toString(), `${5e4}`);
        assert.equal(sheet.token.toLowerCase(), `${this.token1.address.toLowerCase()}`);
      });
    });

    context('addTerms(..)', () => {
      xit('shall revert adding duplications', async() => {
        await expectRevert(this.decks.addTerms([ this.termsheets[3] ]), "QDeck:add:TERMS_DUPLICATED");
      });

      xit('shall add new termsheet', async() => {
        const newSheet = JSON.parse(JSON.stringify(this.termsheets[3]));
        newSheet.minAmount = '33' + e18;
        assert.equal((await this.decks.termsLength()).toString(), '5');
        await this.decks.addTerms([ newSheet ]);
        assert.equal((await this.decks.termsLength()).toString(), '6');
      });
    });
  });
});

function getTermSheetsArr(token0, token1, token2) {
  return [
    { // termsId: 0
      minAmount: '10' + e18,
      maxAmountFactor: `${5e4}`,
      rewardFactor: '1100000',
      lockHours: 24,
      rewardLockHours: 1,
      token: token0,
      enabled: true,
    },
    {  // termsId: 1
      minAmount: '11' + e18,
      maxAmountFactor: 0,
      rewardFactor: '1200000',
      lockHours: 1,
      rewardLockHours: 0,
      token: token1,
      enabled: true,
    },
    { // termsId: 2
      minAmount: '12' + e18,
      maxAmountFactor: `${5e4}`,
      rewardFactor: '1100000',
      lockHours: 24,
      rewardLockHours: 1,
      token: token2,
      enabled: false,
    },
    { // termsId: 3
      minAmount: '13' + e18,
      maxAmountFactor: `${5e4}`,
      rewardFactor: '1100000',
      lockHours: 24,
      rewardLockHours: 1,
      token: token1,
      enabled: true,
    },
    { // termsId: 4
      minAmount: '14' + e18,
      maxAmountFactor: `${5e4}`,
      rewardFactor: '1100000',
      lockHours: 24,
      rewardLockHours: 1,
      token: token2,
      enabled: true,
    }
  ];
}
