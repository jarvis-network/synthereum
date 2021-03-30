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
const deployment = require('../data/deployment/selfMinting-derivatives.json');
const assets = require('../data/synthetic-assets.json');
const selfMintingDerivativeVersions = require('../data/derivative-versions.json');
const selfMintingData = require('../data/selfMinting-data.json');
const {
  parseFiniteFloat,
} = require('@jarvis-network/core-utils/dist/base/asserts');
const {
  logTransactionOutput,
} = require('@jarvis-network/core-utils/dist/eth/contracts/print-tx');
const { log } = require('@jarvis-network/core-utils/dist/logging');
const { encodeSelfMintingDerivative } = require('../utils/encoding.js');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  global.web3 = web3;

  const gasPrice = parseFiniteFloat(process.env.GAS_PRICE);

  const synthereumDeployer = await getExistingInstance(
    web3,
    SynthereumDeployer,
  );

  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  let txData = [];

  if (deployment[networkId].isEnabled === true) {
    assets[networkId].map(async asset => {
      let selfMintingDerivativeVersion = '';
      let selfMintingDerivativePayload = '';
      if (deployment[networkId].SelfMintingDerivative === 1) {
        selfMintingDerivativeVersion =
          selfMintingDerivativeVersions[networkId]['DerivativeFactory'].version;
        selfMintingDerivativePayload = encodeSelfMintingDerivative(
          selfMintingData[networkId].collateralAddress,
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
          selfMintingDerivativeVersion,
          selfMintingData[networkId].daoFee,
          asset.capMintAmount,
          asset.capDepositRatio,
        );
      }
      txData.push({
        asset: asset.syntheticSymbol,
        selfMintingDerivativeVersion,
        selfMintingDerivativePayload,
      });
    });
    for (let j = 0; j < txData.length; j++) {
      log(`   Deploying '${txData[j].asset} Self Minting Derivative'`);
      log('   -------------------------------------');
      const gasEstimation = await synthereumDeployer.methods
        .deployOnlySelfMintingDerivative(
          txData[j].selfMintingDerivativeVersion,
          txData[j].selfMintingDerivativePayload,
        )
        .estimateGas({ from: maintainer });
      if (gasEstimation != undefined) {
        const derivativeToDeploy = await synthereumDeployer.methods
          .deployOnlySelfMintingDerivative(
            txData[j].selfMintingDerivativeVersion,
            txData[j].selfMintingDerivativePayload,
          )
          .call({ from: maintainer });
        const tx = await synthereumDeployer.methods
          .deployOnlySelfMintingDerivative(
            txData[j].selfMintingDerivativeVersion,
            txData[j].selfMintingDerivativePayload,
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
