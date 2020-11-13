'use strict';

const HDWalletProvider = require("@truffle/hdwallet-provider")

const isCoverage = process.env.COVERAGE === 'true'
const fs = require('fs');
const mnemonic = fs.readFileSync(".secret").toString().trim();

const etherscanApiKey = fs.readFileSync(".etherscan").toString().trim();

module.exports = {
  networks: {

    local: {
      host: 'localhost',
      port: 8545,
      gas: 6999999,
      gasPrice: 1000000000,
      network_id: '*'
    },

    ksw: {
      host: 'localhost',
      port: 8555,
      gas: 6999999,
      gasPrice: 20 * 1000000000,
      network_id: '*'
    },

    rinkeby: {
      provider: () => new HDWalletProvider(
        mnemonic,
        `https://rinkeby.infura.io/v3/d0f07cfeb8f24501bd52d8583d6f56f4`,
      ),
      skipDryRun: true,
      network_id: 4,
      gas: 6980000,
      gasPrice: 2.001 * 1000000000
    },

    // mainnet: {
    //   provider: () => new HDWalletProvider(
    //     process.env.HDWALLET_MNEMONIC,
    //     process.env.INFURA_PROVIDER_URL_MAINNET,
    //   ),
    //   skipDryRun: true,
    //   network_id: 1,
    //   gas: 7000000,
    //   gasPrice: 3.01 * 1000000000
    // },

    // kovan: {
    //   provider: () => new HDWalletProvider(
    //     process.env.HDWALLET_MNEMONIC,
    //     process.env.INFURA_PROVIDER_URL_KOVAN,
    //   ),
    //   skipDryRun: true,
    //   network_id: 42
    // },

    // mainnet_fork: {
    //   provider: () => new HDWalletProvider(
    //     process.env.HDWALLET_MNEMONIC,
    //     process.env.LOCALHOST_URL,
    //   ),
    //   gas: 7000000,
    //   network_id: 999
    //   // gasPrice: 11.101 * 1000000000
    // }
  },

  plugins: ["solidity-coverage"],

  fix_paths: true,
  contracts_directory: 'C:\Users\Kenneth\OneDrive\Desktop\KingSwap_V2-develop\KingSwap_V2-develop\contracts',
  compilers: {
    solc: {
      version: "0.6.12",
      docker: false,
      parser: "solcjs",
      settings: {
        evmVersion: 'istanbul',
        optimizer: {
          enabled: true,
          runs: 200
        },
      },
    }
  },

  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: etherscanApiKey
  },

  mocha: isCoverage ? {
    reporter: 'mocha-junit-reporter',
  } : {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      gasPrice: 200
    }
  }
};
