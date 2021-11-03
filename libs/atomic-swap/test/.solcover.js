require('dotenv').config();

let forkingURL = `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_PROJECT_ID}`;
module.exports = {
  skipFiles: [
    '@chainlink',
    '@openzeppelin',
    '@uma',
    'contracts/v1/test',
    'contracts/v2/test',
  ],
  providerOptions: {
    _chainIdRpc: 1,
    _chainId: 1,
    port: 8545,
    fork: forkingURL,
    mnemonic: process.env.MNEMONIC,
    default_balance_ether: 10000000,
  },
};
