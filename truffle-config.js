const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider");

const getEnv = env => {
  const value = process.env[env];

  if (typeof value === 'undefined') {
    console.log(`${env} environment variable has not been set.`);
  }

  return value;
};

const mnemonicEnv = 'ETH_WALLET_MNEMONIC';
const mnemonic = getEnv(mnemonicEnv);

const kovanEnv = 'ETH_KOVAN_ENDPOINT';
const kovanEndpoint = getEnv(kovanEnv);

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  contracts_build_directory: path.join(__dirname, "client/src/contracts"),
  mocha: {
    useColors: false
  },
  networks: {
    kovan: {
      provider: function() {
        // Create 2 addresses for testing purposes
        return new HDWalletProvider(mnemonic, kovanEndpoint, 0, 2);
      },
      network_id: 42,
      gasPrice: 3000000000
    },
    "kovan-fork": {
      provider: function() {
        // Create 2 addresses for testing purposes
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 2);
      },
      network_id: 42,
      gasPrice: 3000000000
    },
  },
  compilers: {
    solc: {
      version: "0.6.4",
      settings: {
        optimizer: {
          enabled: true,
          runs: 500
        }
      }
    }
  }
};
