const RoyalDecks = artifacts.require('MockRoyalDeck');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721 = artifacts.require('MockERC721');

contract('RoyalDecks', (accounts) => {
  const e18 = '000000000000000000';
  const [ deployer, alice, bob, klara, , anybody ] = accounts;

  before(async () => {
    this.king = await MockERC20.new("$KING", "$KING", '1000000'+e18);
    this.decks = await RoyalDecks.new(this.king.address);

    this.queen = await MockERC721("Mock QUEEN", "QUEEN", deployer, deployer, 9);
    this.knight = await MockERC721("Mock KNIGHT", "KNIGHT", deployer, deployer, 9);

    await this.king.transfer(alice, '100000'+e18, { from: deployer });
    await this.king.transfer(bob, '100000'+e18, { from: deployer });
    await this.king.transfer(klara, '100000'+e18, { from: deployer });
  });

  context('', () => {
    it('', async () => {
      return Promise.resolve();
    });
  });
});


/*
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
