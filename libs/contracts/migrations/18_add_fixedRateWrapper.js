const web3Utils = require('web3-utils');
const rolesConfig = require('../data/roles.json');
const { artifacts } = require('hardhat');
const {
  getExistingInstance,
} = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const FixedRateWrapper = artifacts.require('SynthereumFixedRateWrapper');
const deployment = require('../data/deployment/fixedRateWrappers.json');
const assets = require('../data/fixedRate-assets.json');
const fixedRateVersions = require('../data/fixedRate-versions.json');
const {
  parseFiniteFloat,
} = require('@jarvis-network/core-utils/dist/base/asserts');
const {
  logTransactionOutput,
} = require('@jarvis-network/core-utils/dist/eth/contracts/print-tx');
const { log } = require('@jarvis-network/core-utils/dist/logging');
const {
  encodeFixedRate,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
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

  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  let txData = [];
  if (deployment[networkId].isEnabled === true) {
    assets[networkId].map(async asset => {
      let fixedRateWrapperVersion = '';
      let fixedRatePayload = '';
      if (deployment[networkId].FixedRateWrapper === 1) {
        fixedRateWrapperVersion =
          fixedRateVersions[networkId]['FixedRateFactory'].version;
        const synthSymbol = asset.syntheticSymbol;
        fixedRatePayload = encodeFixedRate(
          asset.collateralAddress,
          asset.syntheticName,
          synthSymbol,
          deployment[networkId]?.SynthToken?.[synthSymbol] ?? ZERO_ADDRESS,
          {
            admin: admin,
            maintainer: maintainer,
          },
          fixedRateWrapperVersion,
          asset.rate,
        );
      }
      txData.push({
        asset: asset.syntheticSymbol,
        fixedRateWrapperVersion,
        fixedRatePayload,
      });
    });
    for (let j = 0; j < txData.length; j++) {
      log(`   Deploying '${txData[j].asset}'`);
      log('   -------------------------------------');
      const gasEstimation = await synthereumDeployer.methods
        .deployFixedRate(
          txData[j].fixedRateWrapperVersion,
          txData[j].fixedRatePayload,
        )
        .estimateGas({ from: maintainer });
      if (gasEstimation != undefined) {
        const tx = await synthereumDeployer.methods
          .deployFixedRate(
            txData[j].fixedRateWrapperVersion,
            txData[j].fixedRatePayload,
          )
          .send({ from: maintainer });
        const { transactionHash } = tx;
        await logTransactionOutput({
          log,
          web3,
          txhash: transactionHash,
          contractName: txData[j].asset,
          txSummaryText: 'deployFixedRate',
        });
      }
    }
  }
};
