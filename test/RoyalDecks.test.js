/* global asert, before, contract */
const { expectRevert, time } = require('@openzeppelin/test-helpers');

const RoyalDecks = artifacts.require('MockRoyalDecks');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721 = artifacts.require('MockERC721');

contract('RoyalDecks', (accounts) => {
  const e18 = '000000000000000000';
  const [ deployer, alice, bob, klara, , anybody ] = accounts;
  const decodeLogs = (logs) => logs.map(l => Object.keys(l.args).reduce((a, k) => k.match(/^[0-9_]/) ? a : Object.assign(a, {[k]: l.args[k].toString()}), {event: l.event}))

  before(async () => {
    this.king = await MockERC20.new("$KING", "$KING", '1000000'+e18);
    await this.king.transfer(alice, '100000'+e18, { from: deployer });
    await this.king.transfer(bob, '100000'+e18, { from: deployer });
    await this.king.transfer(klara, '100000'+e18, { from: deployer });

    this.decks = await RoyalDecks.new(this.king.address);
    await this.king.transfer(this.decks.address, '100000'+e18, { from: deployer });

    this.queen = await MockERC721.new("Mock QUEEN", "QUEEN", deployer, 4);
    await this.queen.safeTransferFrom(deployer, alice, 1, '0x0');
    await this.queen.safeTransferFrom(deployer, bob, 2, '0x0');
    await this.queen.safeTransferFrom(deployer, bob, 3, '0x0');
    await this.queen.safeTransferFrom(deployer, bob, 4, '0x0');

    this.knight = await MockERC721.new("Mock KNIGHT", "KNIGHT", deployer, 4);
    await this.knight.safeTransferFrom(deployer, alice, 1, '0x0');
    await this.knight.safeTransferFrom(deployer, alice, 2, '0x0');
    await this.knight.safeTransferFrom(deployer, klara, 3, '0x0');
    await this.knight.safeTransferFrom(deployer, klara, 4, '0x0');
  });

  context('TODO: create tests from "bulk tests" bellow', () => {

    it('Should run "1st draft bulk" tests', async () => {
      let tx;

      await this.decks.addTerms([{
        nft: this.queen.address,
        minAmount: '1000' + e18,
        lockSeconds: '300',
        kingFactor: '1100000',
        enabled: true
      }])
      /*
      events = decodeLogs(tx.logs);
      [
          event: 'NewTermSheet',
          terms: '0',
          nft: '0x15390f348e49135D06Ed6B9c968223aeD108E105',
          minAmount: '1000000000000000000000',
          lockSeconds: '300',
          kingFactor: '1100000'
        { event: 'TermsEnabled', terms: '1' }
      ]
      */
      await this.decks.addTerms([{
        nft: this.knight.address,
        minAmount: '5000' + e18,
        lockSeconds: '320',
        kingFactor: '1001000',
        enabled: false
      }])
      tx = await this.decks.enableTerms('1');
      assert.equal(tx.logs[0].event, 'TermsEnabled');

      let terms0 = await this.decks.termSheet('0')
      assert.equal(terms0.nft, this.queen.address);
      assert.equal(terms0.minAmount, '1000000000000000000000');
      assert.equal(terms0.lockSeconds, '300');
      assert.equal(terms0.kingFactor, '1100000');
      assert.equal(terms0.enabled, true);

      let terms1 = await this.decks.termSheet('1')
      assert.equal(terms1.nft, this.knight.address);
      assert.equal(terms1.minAmount, '5000000000000000000000');
      assert.equal(terms1.lockSeconds, '320');
      assert.equal(terms1.kingFactor, '1001000');
      assert.equal(terms1.enabled, true);

      await this.king.approve(this.decks.address, '2000' + e18, {from: alice})
      await this.queen.approve(this.decks.address, '1', {from: alice})
      tx = await this.decks.deposit('0', '1', '2000' + e18, {from: alice})
      let unlockTime = parseInt(tx.logs[0].args.unlockTime.toString());
      assert.equal(tx.logs[0].args.user, alice);
      assert.equal(tx.logs[0].args.terms, '0');
      assert.equal(tx.logs[0].args.nftId, '1');
      assert.equal(tx.logs[0].args.amountStaked, '2000000000000000000000');
      assert.equal(tx.logs[0].args.amountDue, '2200000000000000000000');
      assert.equal(tx.logs[0].args.unlockTime, `${ 300 + parseInt(tx.logs[0].args.startTime.toString()) }`);
      assert.equal((await this.decks.amountStaked()).toString(), '2000000000000000000000');
      assert.equal((await this.decks.amountDue()).toString(), '2200000000000000000000');

      let stake0 = await this.decks.stakeInfo(alice, '0', '1')
      assert.equal(stake0.amountStaked, '2000000000000000000000');
      assert.equal(stake0.amountDue, '2200000000000000000000');
      assert.equal(stake0.unlockTime, `${300 + parseInt(stake0.startTime.toString())}`);

      await expectRevert(this.decks.withdraw('0', '1', {from: alice}), 'withdraw: stake is locked');
      await expectRevert(this.decks.withdraw('0', '2', {from: alice}), 'withdraw: unknown or returned stake');
      await expectRevert(this.decks.withdraw('0', '1', {from: bob}), 'withdraw: unknown or returned stake');

      await time.increaseTo(unlockTime);
      await this.decks.withdraw('0', '1', {from: alice})
      assert.equal((await this.decks.amountStaked()).toString(), '0');
      assert.equal((await this.decks.amountDue()).toString(), '0');
      await expectRevert(this.decks.withdraw('0', '1', {from: alice}), 'withdraw: unknown or returned stake');
    });

    xit('Should run "2nd draft bulk" tests', async () => {
      const t = await RoyalDecks.new(anybody)
      assert.equal(await t.__ids(), []);
      assert.equal(await t.__stake(0), { amountStaked: '0', amountDue: '0', startTime: '0', unlockTime: '0' });

      await t.__addUserStake(112, { amountStaked : 10, amountDue: 12, startTime: 110, unlockTime: 114 })
      assert.equal(await t.__stake(112), { amountStaked : 10, amountDue: 12, startTime: 110, unlockTime: 114 });

      await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startTime: 110, unlockTime: 114 })
      assert.equal(await t.__stake(113), { amountStaked : 11, amountDue: 13, startTime: 110, unlockTime: 114 });
      assert.equal((await t.__ids()).map(e => e.toString()), [ '112', '113' ]);

      await t.__removeUserStake(113)
      assert.equal((await t.__ids()).map(e => e.toString()), [ '112' ]);

      await t.__removeUserStake(112)
      assert.equal((await t.__ids()).map(e => e.toString()), []);

      await t.__addUserStake(112, { amountStaked : 10, amountDue: 12, startTime: 120, unlockTime: 124 })
      await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startTime: 120, unlockTime: 124 })
      assert.equal((await t.__ids()).map(e => e.toString()), [ '112', '113' ]);

      await t.__removeUserStake(112)
      assert.equal((await t.__ids()).map(e => e.toString()), [ '113' ]);

      await t.__addUserStake(112, { amountStaked : 10, amountDue: 12, startTime: 130, unlockTime: 134 })
      assert.equal((await t.__ids()).map(e => e.toString()), [ '113', '112' ]);

      await t.__removeUserStake(113)
      assert.equal((await t.__ids()).map(e => e.toString()), [ '112' ]);

      await expectRevert(t.__removeUserStake(113), 'RDeck:UNKNOWN_NFT_ID');
      await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startTime: 110, unlockTime: 124 })

      await expectRevert(
          t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startTime: 110, unlockTime: 124 }),
          'RDeck:DUPLICATED_NFT_ID',
      );
    });
  });
});
