const web3Utils = require('web3-utils');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const umaContracts = require('../data/uma-contract-dependencies.json');
const umaConfig = require('../data/uma-config.json');
const {
  getExistingInstance,
} = require('../dist/src/migration-utils/deployment');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumPool = artifacts.require('SynthereumPool');
const deployment = require('../data/deployment/only-pools.json');
const assets = require('../data/synthetic-assets.json');
const derivativeVersions = require('../data/derivative-versions.json');
const poolVersions = require('../data/pool-versions.json');
const fees = require('../data/fees.json');
const { parseFiniteFloat } = require('@jarvis-network/web3-utils/base/asserts');
const {
  logTransactionOutput,
} = require('@jarvis-network/web3-utils/eth/contracts/print-tx');
const { log } = require('@jarvis-network/web3-utils/logging');
const {
  encodeTIC,
  encodePool,
  encodePoolOnChainPriceFeed,
} = require('../utils/encoding.js');
const { toNetworkId } = require('@jarvis-network/web3-utils/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  global.web3 = web3;

  const gasPrice = parseFiniteFloat(process.env.GAS_PRICE);

  const synthereumDeployer = await getExistingInstance(
    web3,
    SynthereumDeployer,
  );
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);

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
      let poolForAdding =
        deployment[networkId].PoolForAdding[asset.syntheticSymbol];
      if (deployment[networkId].Pool === 1) {
        poolVersion = poolVersions[networkId]['TICFactory'].version;
        poolPayload = encodeTIC(
          ZERO_ADDRESS,
          synthereumFinder.options.address,
          poolVersion,
          {
            admin: admin,
            maintainer: maintainer,
            liquidityProvider: liquidityProvider,
            validator: validator,
          },
          asset.startingCollateralization,
          {
            feePercentage: fees[networkId].feePercentage,
            feeRecipients: fees[networkId].feeRecipients,
            feeProportions: fees[networkId].feeProportions,
          },
        );
      } else if (deployment[networkId].Pool === 2) {
        poolVersion = poolVersions[networkId]['PoolFactory'].version;
        poolPayload = encodePool(
          ZERO_ADDRESS,
          synthereumFinder.options.address,
          poolVersion,
          {
            admin: admin,
            maintainer: maintainer,
            liquidityProvider: liquidityProvider,
            validator: validator,
          },
          asset.isContractAllowed,
          asset.startingCollateralization,
          {
            feePercentage: fees[networkId].feePercentage,
            feeRecipients: fees[networkId].feeRecipients,
            feeProportions: fees[networkId].feeProportions,
          },
        );
      } else if (deployment[networkId].Pool === 3) {
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
          asset.isContractAllowed,
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
        poolForAdding,
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
        const poolToDeploy = await synthereumDeployer.methods
          .deployOnlyPool(
            txData[j].poolVersion,
            txData[j].poolPayload,
            txData[j].derivative,
          )
          .call({ from: maintainer });
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
        const poolforAdd = await SynthereumPool.at(txData[j].poolForAdding);
        await poolforAdd.addRoleInDerivative(
          txData[j].derivative,
          2,
          poolToDeploy,
          { from: maintainer },
        );
        log(`    '${txData[j].asset}' added to the derivative`);
      }
    }
  }
};
