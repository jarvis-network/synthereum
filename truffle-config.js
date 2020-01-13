const path = require("path");
const HDWalletProvider = require("truffle-hdwallet-provider");

const getEnv = env => {
  const value = process.env[env];

  if (typeof value === 'undefined') {
    throw new Error(`${env} environment variable has not been set.`);
  }

  return value;
};

const mnemonicEnv = 'ETH_WALLET_MNEMONIC';
const mnemonic = getEnv(mnemonicEnv);

const rinkebyEnv = 'ETH_RINKEBY_ENDPOINT';
const rinkebyEndpoint = getEnv(rinkebyEnv);

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
    develop: {
      port: 8545
    },
    rinkeby: {
      provider: function() {
        return new HDWalletProvider(mnemonic, rinkebyEndpoint);
      },
      network_id: 4
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(mnemonic, kovanEndpoint);
      },
      network_id: 42
    }
  },
  compilers: {
    solc: {
      version: "0.5.14"
    }
  }
};
