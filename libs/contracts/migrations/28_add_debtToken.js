const rolesConfig = require('../data/roles.json');
const { artifacts } = require('hardhat');
const DebtTokenFactory = artifacts.require('DebtTokenFactory');
const {
  getExistingInstance,
} = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
const assets = require('../data/debt-tokens.json');
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

  const debtTokenFactory = await getExistingInstance(
    web3,
    DebtTokenFactory,
    '@jarvis-network/synthereum-contracts',
  );

  const admin = process.env.FORKCHAINID
    ? accounts[0]
    : rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  let txData = [];
  assets[networkId].map(async asset => {
    txData.push({
      asset: asset.syntheticSymbol,
      synthToken: asset.syntheticToken,
      cap: asset.capAmount,
      name: asset.name,
      symbol: asset.symbol,
    });
  });
  for (let j = 0; j < txData.length; j++) {
    log(`   Deploying '${txData[j].asset}' debt token`);
    log('   ------------------------------------- ');

    const gasEstimation = await debtTokenFactory.methods
      .createDebtToken(
        txData[j].synthToken,
        txData[j].cap,
        txData[j].name,
        txData[j].symbol,
        {
          admin: admin,
          maintainer: maintainer,
        },
      )
      .estimateGas({ from: maintainer });
    if (gasEstimation != undefined) {
      const tx = await debtTokenFactory.methods
        .createDebtToken(
          txData[j].synthToken,
          txData[j].cap,
          txData[j].name,
          txData[j].symbol,
          { admin: admin, maintainer: maintainer },
        )
        .send({ from: maintainer });
      const { transactionHash } = tx;
      await logTransactionOutput({
        log,
        web3,
        txhash: transactionHash,
        contractName: txData[j].asset,
        txSummaryText: 'createDebtToekn',
      });
    }
  }
};
