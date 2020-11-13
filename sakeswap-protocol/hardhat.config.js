'use strict';

require("@nomiclabs/hardhat-etherscan");

const { mnemonic, apiKey } = require('./secret.json');
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
    
        
          plugins: ["solidity-coverage"],

          fix_paths: true,
        solidity: {
            version: "0.6.12",
            docker: false,
            parser: "solcjs",
            settings: {
                evmVersion: 'istanbul',
              optimizer: {
                enabled: !isCoverage,
                runs: 200
              }
            }
          }
      
  };