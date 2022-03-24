const web3Utils = require('web3-utils');
const rolesConfig = require('../data/roles.json');
const synthereumConfig = require('../data/synthereum-config.json');
const {
  getExistingInstance,
} = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumPool = artifacts.require('SynthereumLiquidityPool');
const deployment = require('../data/deployment/pools.json');
const assets = require('../data/synthetic-assets.json');
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
  encodeLiquidityPool,
  encodeMultiLpLiquidityPool,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  global.web3 = web3;

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

  const admin = process.env.FORKCHAINID
    ? accounts[0]
    : rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  const liquidityProvider = process.env.FORKCHAINID
    ? accounts[2]
    : rolesConfig[networkId]?.liquidityProvider ?? accounts[2];
  let txData = [];
  if (deployment[networkId].isEnabled === true) {
    assets[networkId].map(async asset => {
      let poolVersion = '';
      let poolPayload = '';
      if (deployment[networkId].Pool === 5) {
        poolVersion = poolVersions[networkId]['LiquidityPoolFactory'].version;
        const synthSymbol = asset.syntheticSymbol;
        poolPayload = encodeLiquidityPool(
          synthereumConfig[networkId].collateralAddress,
          asset.syntheticName,
          synthSymbol,
          deployment[networkId]?.SynthToken?.[synthSymbol] ?? ZERO_ADDRESS,
          {
            admin: admin,
            maintainer: maintainer,
            liquidityProvider: liquidityProvider,
          },
          asset.overCollateralization,
          {
            feePercentage: fees[networkId].feePercentage,
            feeRecipients: fees[networkId].feeRecipients,
            feeProportions: fees[networkId].feeProportions,
          },
          asset.priceFeedIdentifier,
          asset.collateralRequirement,
          asset.liquidationReward,
          poolVersion,
        );
      } else if (deployment[networkId].Pool === 6) {
        poolVersion =
          poolVersions[networkId]['MultiLpLiquidityPoolFactory'].version;
        const synthSymbol = asset.syntheticSymbol;
        poolPayload = encodeMultiLpLiquidityPool(
          poolVersion,
          synthereumConfig[networkId].collateralAddress,
          asset.syntheticName,
          synthSymbol,
          deployment[networkId]?.SynthToken?.[synthSymbol] ?? ZERO_ADDRESS,
          {
            admin: admin,
            maintainer: maintainer,
          },
          fees[networkId].feePercentage,
          asset.priceFeedIdentifier,
          asset.overCollateralRequirement,
          asset.liquidationReward,
          asset.lendingId,
          asset.interestBearingToken,
          asset.daoInterestShare,
          asset.jrtBuybackShare,
        );
      }
      txData.push({
        asset: asset.syntheticSymbol,
        poolVersion,
        poolPayload,
      });
    });
    for (let j = 0; j < txData.length; j++) {
      if (deployment[networkId]?.SynthToken?.[txData[j].asset]) {
        log(
          ` Token instance used '${
            deployment[networkId].SynthToken[txData[j].asset]
          }' `,
        );
        log(' ------------------------------------- ');
      } else {
        log(`   Deploying '${txData[j].asset}'`);
        log('   ------------------------------------- ');
      }
      const gasEstimation = await synthereumDeployer.methods
        .deployPool(txData[j].poolVersion, txData[j].poolPayload)
        .estimateGas({ from: maintainer });
      if (gasEstimation != undefined) {
        const tx = await synthereumDeployer.methods
          .deployPool(txData[j].poolVersion, txData[j].poolPayload)
          .send({ from: maintainer });
        const { transactionHash } = tx;
        await logTransactionOutput({
          log,
          web3,
          txhash: transactionHash,
          contractName: txData[j].asset,
          txSummaryText: 'deployPool',
        });
      }
    }
  }
};
