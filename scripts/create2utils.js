module.exports = (web3) => {
  const { BN, sha3, isAddress, toChecksumAddress } = web3.utils;

  return {
    /**
     * Return the address of a contract being deployed with CREATE2
     * @param deployingAddr {string}
     * @param salt {string|number}
     * @param bytecode {string} init bytecode of the contract
     * @return {string}
     */
    buildCreate2Address,

    /**
     * Return salt as a 32-bytes hex string
     * @param salt {number|string}
     * @returns {string}
     */
    getPaddedSalt,
  };

  function buildCreate2Address(deployingAddr, salt, bytecode) {
    // keccak256(0xff ++ deployingAddr ++ salt ++ keccak256(bytecode))
    const prefix = '0xff' + deployingAddr.replace(/^0x/, '').padStart(40, '0');
    const paddedSalt = getPaddedSalt(salt);
    const bytecodeHash = sha3(`${bytecode.startsWith('0x') ? '' : '0x'}${bytecode}`).replace(/^0x/, '');
    return toChecksumAddress(
      '0x' + sha3(`${prefix}${paddedSalt}${bytecodeHash}`.toLowerCase()).slice(-40),
    );
  }

  function  getPaddedSalt(salt) {
    return (new BN(salt)).toString(16).replace(/^0x/, '').padStart(64, '0');
  }
};

/*
For details on "bytecode", "deployedBytecode", "init bytecode", etc...:
https://ethereum.stackexchange.com/questions/76334/what-is-the-difference-between-bytecode-init-code-deployed-bytedcode-creation

TODO: create unit-tests from notes bellow
if (!web3) var web3 = require('web3'); let { buildCreate2Address } = require('./create2.js')(web3)
buildCreate2Address('0x0000000000000000000000000000000000000000', '0', '0x00') === '0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38'
buildCreate2Address('0x0000000000000000000000000000000000000000', 0, '0x00') === '0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38'
buildCreate2Address('0xdeadbeef00000000000000000000000000000000', 0, '0x00') === '0xB928f69Bb1D91Cd65274e3c79d8986362984fDA3'
buildCreate2Address('0xdeadbeef', '0xcafebabe', '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef') === '0x1d8bfDC5D46DC4f61D6b6115972536eBE6A8854C'
*/
