/* global asert, before, contract */
const { expectRevert, time } = require('@openzeppelin/test-helpers');

const RoyalDecks = artifacts.require('MockRoyalDecks');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721 = artifacts.require('MockERC721');

contract('RoyalDecks', (accounts) => {
  const e18 = '000000000000000000';
  const e18andOne = '000000000000000001';
  const [ deployer, alice, bob, klara, , anybody ] = accounts;

  before(async () => {
    this.king = await MockERC20.new("$KING", "$KING", '1000000' + e18)
    await this.king.transfer(alice, '100000' + e18)
    await this.king.transfer(bob, '100000' + e18)
    await this.king.transfer(klara, '100000' + e18)
    await this.king.transfer(klara, '1' + e18)

    this.decks = await RoyalDecks.new(this.king.address)
    await this.king.approve(this.decks.address, '100000' + e18)
    await this.decks.addKingReserves(deployer, '100000' + e18)

    this.kingNft = await MockERC721.new("Mock KING", "KING", klara, 1)

    this.queen = await MockERC721.new("Mock QUEEN", "QUEEN", deployer, 4)
    await this.queen.safeTransferFrom(deployer, alice, 1, '0x0')
    await this.queen.safeTransferFrom(deployer, bob, 2, '0x0')
    await this.queen.safeTransferFrom(deployer, bob, 3, '0x0')
    await this.queen.safeTransferFrom(deployer, bob, 4, '0x0')

    this.knight = await MockERC721.new("Mock KNIGHT", "KNIGHT", deployer, 4)
    await this.knight.safeTransferFrom(deployer, alice, 1, '0x0')
    await this.knight.safeTransferFrom(deployer, alice, 2, '0x0')
    await this.knight.safeTransferFrom(deployer, klara, 3, '0x0')
    await this.knight.safeTransferFrom(deployer, klara, 4, '0x0')

    await this.decks.addTerms([
      { // termsId: 0
        nft: this.queen.address,
        minAmount: '1000' + e18,
        lockHours: '1',
        kingFactor: '1100000',
        enabled: true
      },
      {  // termsId: 1
        enabled: true,
        nft: this.knight.address,
        minAmount: '5000' + e18,
        lockHours: '1',
        kingFactor: '1001000',
      },
      { // termsId: 2
        nft: this.queen.address,
        minAmount: '2000' + e18,
        lockHours: '2',
        kingFactor: '1110000',
        enabled: true
      },
      { // termsId: 3
        enabled: true,
        nft: this.knight.address,
        minAmount: '6000' + e18,
        lockHours: '3',
        kingFactor: '1003000',
      },
      { // termsId: 4
        enabled: true,
        nft: this.kingNft.address,
        minAmount: '1',
        lockHours: '2',
        kingFactor: '1000000',
      }
    ])

    await this.decks.addAirdropPools(
        [ this.kingNft.address, this.queen.address, this.knight.address ],
        [ 6, 3, 1 ],
    )
  });

  context('TODO: create tests from "bulk tests" bellow', () => {

    it('Should run "1st draft bulk" tests', async () => {
      let tx;
      tx = await this.decks.enableTerms('1');
      assert.equal(tx.logs[0].event, 'TermsEnabled');

      let terms0 = await this.decks.termSheet('0')
      assert.equal(terms0.nft, this.queen.address);
      assert.equal(terms0.minAmount, '1000' + e18);
      assert.equal(terms0.lockHours, '1');
      assert.equal(terms0.kingFactor, '1100000');
      assert.equal(terms0.enabled, true);

      let terms1 = await this.decks.termSheet('1')
      assert.equal(terms1.nft, this.knight.address);
      assert.equal(terms1.minAmount, '5000' + e18);
      assert.equal(terms1.lockHours, '1');
      assert.equal(terms1.kingFactor, '1001000');
      assert.equal(terms1.enabled, true);

      await this.king.approve(this.decks.address, '2000' + e18, { from: alice })
      await this.queen.approve(this.decks.address, '1', { from: alice })

      // stake0 deposited
      tx = await this.decks.deposit('0', '1', '2000' + e18, { from: alice })
      let stake0StartTime = parseInt((await web3.eth.getBlock(tx.receipt.blockHash)).timestamp.toString());

      let stake0Id = (await this.decks.encodeStakeId(this.queen.address, '1', `${stake0StartTime}`, '1')).toString();
      let stake0 = await this.decks.stakeData(alice, stake0Id)
      assert.equal(tx.logs[0].args.user, alice);
      assert.equal(tx.logs[0].args.stakeId.toString(), stake0Id);
      assert.equal(tx.logs[0].args.amountStaked, '2000' + e18);
      assert.equal(tx.logs[0].args.amountDue, '2200' + e18);
      assert.equal(tx.logs[0].args.unlockTime, `${ 3600 + stake0StartTime}`);
      assert.equal(stake0.amountStaked, '2000' + e18);
      assert.equal(stake0.amountDue, '2200' + e18);
      assert.equal(stake0.unlockTime, `${3600 + stake0StartTime}`);

      let stake0decodedId = await this.decks.decodeStakeId(stake0Id);
      assert.equal(stake0decodedId.nft.toLowerCase(), this.queen.address.toLowerCase());
      assert.equal(stake0decodedId.nftId.toString(), '1');
      assert.equal(stake0decodedId.startTime.toString(), `${stake0StartTime}`);
      assert.equal(stake0decodedId.stakeHours.toString(), '1');

      assert.equal((await this.decks.kingReserves()).toString(), `${100000 + 2000}` + e18);
      assert.equal((await this.king.balanceOf(this.decks.address)).toString(), '102000' + e18);
      assert.equal((await this.decks.kingDue()).toString(), '2200' + e18);


      await this.king.approve(this.decks.address, '20000' + e18, { from: bob })
      await this.queen.approve(this.decks.address, '3', { from: bob })
      await this.queen.approve(this.decks.address, '4', { from: bob })

      await time.increase(30)

      // stake1 deposited
      tx = await this.decks.deposit('0', '3', '12000' + e18, { from: bob })
      let stake1Id = tx.logs[0].args.stakeId.toString()
      let stake1 = await this.decks.stakeData(bob, stake1Id)
      assert.equal(stake1.amountStaked, '12000' + e18);
      assert.equal(tx.logs[0].args.amountDue, '13200' + e18);

      await time.increase(30)

      // stake2 deposited
      tx = await this.decks.deposit('2', '4', '8000' + e18, { from: bob })
      let stake2Id = tx.logs[0].args.stakeId.toString()
      let stake2 = await this.decks.stakeData(bob, stake2Id)
      assert.equal(stake2.amountStaked, '8000' + e18);
      assert.equal(stake2.amountDue, '8880' + e18);

      await expectRevert(this.decks.withdraw(stake0Id, { from: alice }), 'withdraw: stake is locked');
      await expectRevert(this.decks.withdraw(stake0Id, { from: bob }), 'withdraw: unknown or returned stake');

      await this.king.approve(this.decks.address, '100000' + e18, { from: klara })
      await this.knight.approve(this.decks.address, '3', { from: klara })
      await this.knight.approve(this.decks.address, '4', { from: klara })

      await time.increase(30)

      // stake3 deposited
      tx = await this.decks.deposit('1', '3', '40000' + e18, { from: klara })
      let stake3Id = tx.logs[0].args.stakeId.toString()
      let stake3 = await this.decks.stakeData(klara, stake3Id)
      assert.equal(tx.logs[0].args.amountStaked, '40000' + e18);
      assert.equal(tx.logs[0].args.amountDue, '40040' + e18);

      await time.increase(30)

      await this.decks.disableTerms('1');
      await expectRevert(this.decks.deposit('1', '4', '60000' + e18, { from: klara }), "deposit: terms disabled")
      await this.decks.enableTerms('1');

      // stake4 deposited
      tx = await this.decks.deposit('1', '4', '60000' + e18, { from: klara })
      let stake4Id = tx.logs[0].args.stakeId.toString()
      let stake4 = await this.decks.stakeData(klara, stake4Id)
      assert.equal(stake4.amountStaked, '60000' + e18);
      assert.equal(stake4.amountDue, '60060' + e18);

      await this.king.approve(this.decks.address, '1', { from: klara })
      await this.kingNft.approve(this.decks.address, '1', { from: klara })

      // stake5 deposited
      tx = await this.decks.deposit('4', '1', '1', { from: klara })
      let stake5Id = tx.logs[0].args.stakeId.toString()
      let stake5 = await this.decks.stakeData(klara, stake5Id)
      assert.equal(stake5.amountStaked, '1');
      assert.equal(stake5.amountDue, '1');

      assert.equal((await this.decks.kingReserves()).toString(), `${100000 + 2000 + 12000 + 8000 + 40000 + 60000}` + e18andOne);
      assert.equal((await this.king.balanceOf(this.decks.address)).toString(), '222000' + e18andOne);
      assert.equal((await this.decks.kingDue()).toString(), `${2200 + 13200 + 8880 + 40040 + 60060}` + e18andOne);

      await time.increaseTo(stake0.unlockTime);

      // stake0 withdrawn
      await this.decks.withdraw(stake0Id, { from: alice })

      assert.equal((await this.decks.kingReserves()).toString(), `${222000 - 2200}` + e18andOne);
      assert.equal((await this.king.balanceOf(this.decks.address)).toString(), `${222000 - 2200}` + e18andOne);
      assert.equal((await this.decks.kingDue()).toString(), `${13200 + 8880 + 40040 + 60060}` + e18andOne);

      await expectRevert(this.decks.withdraw(stake0Id, { from: alice }), 'withdraw: unknown or returned stake');

      await time.increaseTo(stake1.unlockTime);

      let stakeIds = await this.decks.stakeIds(bob);
      assert.equal(stakeIds.length, 2)
      assert.equal(stakeIds[0], stake1Id)

      // stake1 withdrawn
      await this.decks.withdraw(stake1Id, { from: bob })

      stakeIds = await this.decks.stakeIds(bob);
      assert.equal(stakeIds.length, 1)
      assert.equal(stakeIds[0], stake2Id)

      await time.increaseTo(stake3.unlockTime);

      // stake3 withdrawn
      await this.decks.withdraw(stake3Id, { from: klara })

      await time.increaseTo(stake4.unlockTime);

      // stake4 withdrawn
      await this.decks.withdraw(stake4Id, { from: klara })

      assert.equal((await this.decks.kingDue()).toString(), '8880' + e18andOne);
      assert.equal((await this.decks.kingReserves()).toString(), `${222000 - 2200 - 13200 - 40040 - 60060}` + e18andOne);
      assert.equal((await this.king.balanceOf(this.decks.address)).toString(), '106500' + e18andOne);

      assert.equal(await this.decks.emergencyWithdrawEnabled(), false);
      await this.decks.enableEmergencyWithdraw();
      assert.equal(await this.decks.emergencyWithdrawEnabled(), true);

      await expectRevert(this.decks.removeKingReserves('100000' + e18, { from: deployer }), "RDeck:TOO_LOW_RESERVES");
      await this.decks.removeKingReserves('90000' + e18, { from: deployer })

      // stake2 withdrawn (emergency)
      await expectRevert(this.decks.withdraw(stake2Id, { from: bob }), "withdraw: stake is locked");
      await this.decks.emergencyWithdraw(stake2Id, { from: bob })

      await time.increaseTo(stake5.unlockTime);

      // stake5 withdrawn
      await this.decks.withdraw(stake5Id, { from: klara })

      assert.equal((await this.decks.kingDue()).toString(), '0');
      assert.equal((await this.decks.kingReserves()).toString(), `${106500 - 90000 - 8880}` + e18);
      assert.equal((await this.king.balanceOf(this.decks.address)).toString(), `${7620 + 880}` + e18);
    });

    it('Should run "2nd draft bulk" tests', async () => {
      const t = await RoyalDecks.new(anybody)
      assert.equal((await t.__ids()).length, 0);
      assert.equal((await t.__stake(0)).amountStaked.toString(), '0');
      // assert.equal(await t.__stake(0), { amountStaked: '0', amountDue: '0', startTime: '0', unlockTime: '0' });

      await t.__addUserStake(112, { amountStaked : 10, amountDue: 12, startTime: 110, unlockTime: 114 })
      assert.equal((await t.__stake(112)).amountStaked.toString(), '10');
      // assert.equal(await t.__stake(112), { amountStaked : 10, amountDue: 12, startTime: 110, unlockTime: 114 });

      await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startTime: 110, unlockTime: 114 })
      assert.equal((await t.__stake(113)).amountStaked.toString(), '11');
      //assert.equal(await t.__stake(113), { amountStaked : 11, amountDue: 13, startTime: 110, unlockTime: 114 });
      assert.equal((await t.__ids()).reduce((a, e) => a + e.toString() + ';', ''), '112;113;');

      await t.__removeUserStake(113)
      assert.equal((await t.__ids()).reduce((a, e) => a + e.toString() + ';', ''), '112;');

      await t.__removeUserStake(112)
      assert.equal((await t.__ids()).length, 0);

      await t.__addUserStake(112, { amountStaked : 10, amountDue: 12, startTime: 120, unlockTime: 124 })
      await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startTime: 120, unlockTime: 124 })
      assert.equal((await t.__ids()).reduce((a, e) => a + e.toString() + ';', ''), '112;113;');

      await t.__removeUserStake(112)
      assert.equal((await t.__ids()).reduce((a, e) => a + e.toString() + ';', ''), '113;');

      await t.__addUserStake(112, { amountStaked : 10, amountDue: 12, startTime: 130, unlockTime: 134 })
      assert.equal((await t.__ids()).reduce((a, e) => a + e.toString() + ';', ''), '113;112;');

      await t.__removeUserStake(113)
      assert.equal((await t.__ids()).reduce((a, e) => a + e.toString() + ';', ''), '112;');

      await expectRevert(t.__removeUserStake(113), 'RDeck:INVALID_STAKE_ID');
      await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startTime: 110, unlockTime: 124 })

      await expectRevert(
          t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startTime: 110, unlockTime: 124 }),
          'RDeck:DUPLICATED_STAKE_ID',
      );
    });
  });
});
