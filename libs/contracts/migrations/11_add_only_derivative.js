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
const deployment = require('../data/deployment/only-derivatives.json');
const assets = require('../data/synthetic-assets.json');
const derivativeVersions = require('../data/derivative-versions.json');
const { parseFiniteFloat } = require('@jarvis-network/web3-utils/base/asserts');
const {
  logTransactionOutput,
} = require('@jarvis-network/web3-utils/eth/contracts/print-tx');
const { log } = require('@jarvis-network/web3-utils/logging');
const { encodeDerivative } = require('../utils/encoding.js');
const { toNetworkId } = require('@jarvis-network/web3-utils/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  global.web3 = web3;

  const gasPrice = parseFiniteFloat(process.env.GAS_PRICE);

  const synthereumDeployer = await getExistingInstance(
    web3,
    SynthereumDeployer,
  );

  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const liquidityProvider =
    rolesConfig[networkId]?.liquidityProvider ?? accounts[2];
  const validator = rolesConfig[networkId]?.validator ?? accounts[3];
  let txData = [];

  if (deployment[networkId].isEnabled === true) {
    assets[networkId].map(async asset => {
      let derivativeVersion = '';
      let derivativePayload = '';
      let pool = deployment[networkId].Pools[asset.syntheticSymbol];
      let derivativeForAdding =
        deployment[networkId].DerivativeForAdding[asset.syntheticSymbol];
      if (deployment[networkId].Derivative === 1) {
        derivativeVersion =
          derivativeVersions[networkId]['DerivativeFactory'].version;
        derivativePayload = encodeDerivative(
          umaContracts[networkId].collateralAddress,
          asset.priceFeedIdentifier,
          asset.syntheticName,
          asset.syntheticSymbol,
          deployment[networkId].SyntheticTokenAddress[asset.syntheticSymbol],
          asset.collateralRequirement,
          umaConfig[networkId].disputeBondPct,
          umaConfig[networkId].sponsorDisputeRewardPct,
          umaConfig[networkId].disputerDisputeRewardPct,
          asset.minSponsorTokens,
          umaConfig[networkId].withdrawalLiveness,
          umaConfig[networkId].liquidationLiveness,
          umaConfig[networkId].excessTokenBeneficiary,
          [synthereumDeployer.options.address],
          [],
        );
      }
      txData.push({
        asset: asset.syntheticSymbol,
        pool,
        derivativeForAdding,
        derivativeVersion,
        derivativePayload,
      });
    });
    for (let j = 0; j < txData.length; j++) {
      log(`   Deploying '${txData[j].asset} Derivative'`);
      log('   -------------------------------------');
      const gasEstimation = await synthereumDeployer.methods
        .deployOnlyDerivative(
          txData[j].derivativeVersion,
          txData[j].derivativePayload,
          txData[j].pool,
        )
        .estimateGas({ from: maintainer });
      if (gasEstimation != undefined) {
        const derivativeToDeploy = await synthereumDeployer.methods
          .deployOnlyDerivative(
            txData[j].derivativeVersion,
            txData[j].derivativePayload,
            txData[j].pool,
          )
          .call({ from: maintainer });
        const tx = await synthereumDeployer.methods
          .deployOnlyDerivative(
            txData[j].derivativeVersion,
            txData[j].derivativePayload,
            txData[j].pool,
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
        const pool = await SynthereumPool.at(txData[j].pool);
        await pool.addDerivative(derivativeToDeploy, {
          from: maintainer,
        });
        log(`Derivative added to '${txData[j].asset}' pool`);
        await pool.addRoleInSynthToken(
          txData[j].derivativeForAdding,
          3,
          derivativeToDeploy,
          { from: maintainer },
        );
        log(`Derivative added to '${txData[j].asset}' synthetic token`);
      }
    }
  }
};
