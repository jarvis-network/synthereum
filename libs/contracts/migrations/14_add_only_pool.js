const web3Utils = require('web3-utils');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const umaContracts = require('../data/uma-contract-dependencies.json');
const umaConfig = require('../data/uma-config.json');
const {
  getExistingInstance,
} = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumPool = artifacts.require('SynthereumPool');
const deployment = require('../data/deployment/only-pools.json');
const assets = require('../data/synthetic-assets.json');
const derivativeVersions = require('../data/derivative-versions.json');
const poolVersions = require('../data/pool-versions.json');
const fees = require('../data/fees.json');
const {
  parseFiniteFloat,
} = require('@jarvis-network/core-utils/dist/base/asserts');
const {
  logTransactionOutput,
} = require('@jarvis-network/core-utils/dist/eth/contracts/print-tx');
const { log } = require('@jarvis-network/core-utils/dist/logging');
const {
  encodeTIC,
  encodePool,
  encodePoolOnChainPriceFeed,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  global.web3 = web3;

  const gasPrice = parseFiniteFloat(process.env.GAS_PRICE);

  const synthereumDeployer = await getExistingInstance(
    web3,
    SynthereumDeployer,
    '@jarvis-network/synthereum-contracts',
  );
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );

  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const liquidityProvider =
    rolesConfig[networkId]?.liquidityProvider ?? accounts[2];
  const validator = rolesConfig[networkId]?.validator ?? accounts[3];
  let txData = [];
  if (deployment[networkId].isEnabled === true) {
    assets[networkId].map(async asset => {
      let poolVersion = '';
      let poolPayload = '';
      let derivative = deployment[networkId].Derivatives[asset.syntheticSymbol];
      if (deployment[networkId].Pool === 4) {
        poolVersion =
          poolVersions[networkId]['PoolOnChainPriceFeedFactory'].version;
        poolPayload = encodePoolOnChainPriceFeed(
          ZERO_ADDRESS,
          synthereumFinder.options.address,
          poolVersion,
          {
            admin: admin,
            maintainer: maintainer,
            liquidityProvider: liquidityProvider,
          },
          asset.startingCollateralization,
          {
            feePercentage: fees[networkId].feePercentage,
            feeRecipients: fees[networkId].feeRecipients,
            feeProportions: fees[networkId].feeProportions,
          },
        );
      }
      txData.push({
        asset: asset.syntheticSymbol,
        derivative,
        poolVersion,
        poolPayload,
      });
    });
    for (let j = 0; j < txData.length; j++) {
      log(`   Deploying '${txData[j].asset}'`);
      log('   -------------------------------------');
      const gasEstimation = await synthereumDeployer.methods
        .deployOnlyPool(
          txData[j].poolVersion,
          txData[j].poolPayload,
          txData[j].derivative,
        )
        .estimateGas({ from: maintainer });
      if (gasEstimation != undefined) {
        const tx = await synthereumDeployer.methods
          .deployOnlyPool(
            txData[j].poolVersion,
            txData[j].poolPayload,
            txData[j].derivative,
          )
          .send({ from: maintainer, gasPrice });
        const { transactionHash } = tx;
        await logTransactionOutput({
          log,
          web3,
          txhash: transactionHash,
          contractName: txData[j].asset,
          txSummaryText: 'deployOnlyPool',
        });
      }
    }
  }
};
