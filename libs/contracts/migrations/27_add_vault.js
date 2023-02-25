const rolesConfig = require('../data/roles.json');
const { artifacts } = require('hardhat');
const VaultFactory = artifacts.require('VaultFactory');
const {
  getExistingInstance,
} = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
const vaults = require('../data/vaults.json');
const {
  logTransactionOutput,
} = require('@jarvis-network/core-utils/dist/eth/contracts/print-tx');
const { log } = require('@jarvis-network/core-utils/dist/logging');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  global.web3 = web3;

  const vaultFactory = await getExistingInstance(
    web3,
    VaultFactory,
    '@jarvis-network/synthereum-contracts',
  );

  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  let txData = [];
  vaults[networkId].map(async vault => {
    txData.push({
      pool: vault.pool,
      overCollateralization: vault.overCollateralization,
      name: vault.name,
      symbol: vault.symbol,
    });
  });
  for (let j = 0; j < txData.length; j++) {
    log(`   Deploying '${txData[j].pool}' vault`);
    log('   ------------------------------------- ');

    const gasEstimation = await vaultFactory.methods
      .createVault(
        txData[j].name,
        txData[j].symbol,
        txData[j].pool,
        txData[j].overCollateralization,
      )
      .estimateGas({ from: maintainer });
    if (gasEstimation != undefined) {
      const tx = await vaultFactory.methods
        .createVault(
          txData[j].name,
          txData[j].symbol,
          txData[j].pool,
          txData[j].overCollateralization,
        )
        .send({ from: maintainer });
      const { transactionHash } = tx;
      await logTransactionOutput({
        log,
        web3,
        txhash: transactionHash,
        contractName: txData[j].pool,
        txSummaryText: 'createVault',
      });
    }
  }
};
