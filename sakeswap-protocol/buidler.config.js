'use strict';
// buidler.config.js
const { mnemonic, apiKey } = require('./secret.json');
usePlugin("@nomiclabs/buidler-etherscan");
usePlugin('@nomiclabs/buidler-ethers');
const isCoverage = process.env.COVERAGE === 'true'
module.exports = {
    defaultNetwork: 'rinkeby',
      networks: {
        development: {
          url: "http://localhost:8545"
        },
        rinkeby: {
          url: `https://rinkeby.infura.io/v3/d0f07cfeb8f24501bd52d8583d6f56f4`,
          accounts: {mnemonic: mnemonic}
        },mainnet: { 
          url: `https://mainnet.infura.io/v3/36991703b07245dca41f43e320e61c62`,
          accounts: {mnemonic: mnemonic}
        }
      },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: 'V124DU6KDW54JECVY6HCXCJ22AAV9V58Q3'
      },

  
    contracts_directory: 'C:\Users\Kenneth\OneDrive\Desktop\KingSwap_V2-develop\KingSwap_V2-develop\contracts',
    solc: {
      version: "0.6.12",
      settings: {
        evmVersion: 'istanbul',
        optimizer: {
          enabled: true,
          runs: 200
        },
      },
    }
  
};