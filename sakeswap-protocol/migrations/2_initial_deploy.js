/*const KingToken = artifacts.require("./KingToken.sol");
const Archbishop = artifacts.require("./Archbishop.sol");
const StakeHolderFund = artifacts.require("./StakeholderFund.sol");
const StakeHolderFundTimeLock = artifacts.require("./StakeholderFundTimeLock.sol");*/
//const KnightMummy = artifacts.require("./KingTokenNFTQueenVampz.sol");

//const ktBatch = artifacts.require("../tools/KingTokenBatchSender.sol");
const KSFactoryv2 = artifacts.require("../contracts/kingswap/KingSwapFactory.sol");
const KSRouter = artifacts.require("../contract/kingswap/KingSwapRouter.sol");
//const KSPair = artifacts.require("./KingSwapPair.sol");

module.exports = async function (deployer) {
  await deployer.deploy(KSFactoryv2,'0x174355DD4adC692E70018eC4b7429ACFe5930fA2');
  const factory = await KSFactoryv2.deployed();
  console.log("THIS IS KSFactoryv2 ADDRESS : " + factory.address);


  // //uniswap weth rinkeby address 0xc778417E063141139Fce010982780140Aa0cD5Ab
  // await deployer.deploy(KSRouter,'0x41Ef46a33C4cc0c51f99478d558bcFB2c8bFe7Eb','0xc778417E063141139Fce010982780140Aa0cD5Ab');
  // const router = await KSRouter.deployed();
  // console.log("THIS IS router ADDRESS : " + router.address);







  /*await deployer.deploy(KingToken);
  const KT = await KingToken.deployed();
  const ktAddress = KT.address;

  // what is King token address
  console.log("THIS IS KING TOKEN ADDRESS : " + ktAddress);
  await deployer.deploy(Archbishop,ktAddress,'0x174355DD4adC692E70018eC4b7429ACFe5930fA2','10000','0');
  const Arch = await Archbishop.deployed();
  const archAddress = Arch.address;

*/
/*await deployer.deploy(KnightMummy,"QueenVampz","KINGQZ","0xD31e459Ac72E2ccAD9A35b5b3367cfB4BaB0274F");
const KM = await KnightMummy.deployed();
 // const sAddress = sToken.address;

  // what is King token address
  console.log("THIS IS KNIGHTMUMMY ADDRESS : " + KM.address);*/

/*await deployer.deploy(ktBatch);
const aa = await ktBatch.deployed();
console.log("THIS IS ktBatch ADDRESS : " + aa.address);
*/
};
