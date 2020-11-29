const RoyalDecks = artifacts.require('MockRoyalDeck');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721 = artifacts.require('MockERC721');

contract('RoyalDecks', (accounts) => {
  const e18 = '000000000000000000';
  const [ deployer, alice, bob, klara, , anybody ] = accounts;

  before(async () => {
    this.king = await MockERC20.new("$KING", "$KING", '1000000'+e18);
    await this.king.transfer(alice, '100000'+e18, { from: deployer });
    await this.king.transfer(bob, '100000'+e18, { from: deployer });
    await this.king.transfer(klara, '100000'+e18, { from: deployer });

    this.decks = await RoyalDecks.new(this.king.address);
    await king.transfer(this.decks.address, '100000'+e18, { from: deployer });

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

  context('', () => {
    it('', async () => {
      return Promise.resolve();
    });
  });
});


/*
await decks.addTerms([{nft: queen.address, minAmount: '1000'+e18, lockSeconds: '300', kingFactor: '1100000', enabled: true}])
await decks.addTerms([{nft: knight.address, minAmount: '5000'+e18, lockSeconds: '320', kingFactor: '1001000', enabled: false}])

["terms", "nft", "minAmount", "lockSeconds", "kingFactor"].map(k => k + ": " + tx.receipt.logs[0].args[k].toString())
[
  'terms: 1',
  'nft: 0xd15Ee89DD37E62d131e382c8df7911CE872bf74D',
  'minAmount: 5000000000000000000000',
  'lockSeconds: 320',
  'kingFactor: 1001000'
]
tx = await decks.enableTerms('1')
tx.logs[0].event // 'TermsEnabled'

await king.approve(decks.address, '2000'+e18, {from: alice})
await queen.approve(decks.address, '1', {from: alice})
tx = await decks.deposit('0', '1', '2000'+e18, {from: alice})

Object.keys(tx.logs[0].args).map(k => k + ': ' + tx.logs[0].args[k].toString())
[
  'user: 0x64662e7849A3cF25821777FF5e663755a4121C87',
  'terms: 0',
  'nftId: 1',
  'startTime: 1606645609',
  'amountStaked: 2000000000000000000000',
  'amountDue: 2200000000000000000000',
  'unlockTime: 1606645909'
]
(await decks.amountStaked()).toString() // '2000000000000000000000'
(await decks.amountDue()).toString() // '2200000000000000000000'

await decks.stakeInfo(alice, '0', '1')
[
  amountStaked: '2000000000000000000000',
  amountDue: '2200000000000000000000',
  startTime: '1606645609',
  unlockTime: '1606645909'
]

await decks.withdraw('0', '1', { from: alice }) //  reason: 'withdraw: stake is locked'
await decks.withdraw('0', '2', { from: alice }) // reason: 'withdraw: unknown or returned stake'

await king.approve(decks.address, '5000'+e18, {from: alice})



const t = await MockRoyalDecks.new()
await t.__ids()
// []
await t.__stake(0)
// amountStaked: '0', amountDue: '0', startBlock: '0', endBlock: '0'

await t.__addUserStake(112, { amountStaked : 10, amountDue: 12, startBlock: 110, endBlock: 114 })
await t.__stake(112)
// amountStaked: '10', amountDue: '12', startBlock: '110', endBlock: '114'
await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startBlock: 110, endBlock: 114 })
await t.__stake(113)
// amountStaked: '11', amountDue: '13', startBlock: '110', endBlock: '114'
(await t.__ids()).map(e => e.toString())
// [ '112', '113' ]

await t.__removeUserStake(113)
(await t.__ids()).map(e => e.toString())
// [ '112' ]
await t.__removeUserStake(112)
(await t.__ids()).map(e => e.toString())
// []
await t.__addUserStake(112, { amountStaked : 10, amountDue: 12, startBlock: 120, endBlock: 124 })
await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startBlock: 120, endBlock: 124 })
(await t.__ids()).map(e => e.toString())
// [ '112', '113' ]
await t.__removeUserStake(112)
(await t.__ids()).map(e => e.toString())
// [ '113' ]
await t.__addUserStake(112, { amountStaked : 10, amountDue: 12, startBlock: 130, endBlock: 134 })
(await t.__ids()).map(e => e.toString())
// [ '113', '112' ]
await t.__removeUserStake(113)
(await t.__ids()).map(e => e.toString())
// [ '112' ]
await t.__removeUserStake(113)
//  reason: 'RDeck:UNKNOWN_NFT_ID'
await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startBlock: 110, endBlock: 124 })
await t.__addUserStake(113, { amountStaked : 11, amountDue: 13, startBlock: 110, endBlock: 124 })
// reason: 'RDeck:DUPLICATED_NFT_ID',
 */
