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
const deployment = require('../data/deployment/selfMinting-derivatives.json');
const assets = require('../data/synthetic-assets.json');
const selfMintingData = require('../data/selfMinting-data.json');
const {
  parseFiniteFloat,
} = require('@jarvis-network/core-utils/dist/base/asserts');
const {
  logTransactionOutput,
} = require('@jarvis-network/core-utils/dist/eth/contracts/print-tx');
const { log } = require('@jarvis-network/core-utils/dist/logging');
const {
  encodeCreditLineDerivative,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
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
  const roles = {
    admin: rolesConfig[networkId]?.admin ?? accounts[0],
    maintainers: [maintainer],
  };

  let txData = [];

  if (deployment[networkId].isEnabled === true) {
    assets[networkId].map(async asset => {
      let creditLineDerivativeVersion = '';
      let creditLineDerivativePayload = '';
      if (deployment[networkId].SelfMintingDerivative === 1) {
        creditLineDerivativeVersion = selfMintingData[networkId][1].version;
        creditLineDerivativePayload = encodeCreditLineDerivative(
          selfMintingData[networkId][1].collateralAddress,
          asset.priceFeedIdentifier,
          asset.syntheticName,
          asset.syntheticSymbol,
          deployment[networkId].SyntheticTokenAddress[asset.syntheticSymbol],
          selfMintingData[networkId][1].fee,
          roles,
          selfMintingData[networkId][1].liquidationPct,
          asset.capMintAmount,
          asset.collateralRequirement,
          asset.minSponsorTokens,
          synthereumConfig.excessTokenBeneficiary,
          creditLineDerivativeVersion,
        );
      }
      txData.push({
        asset: asset.syntheticSymbol,
        creditLineDerivativeVersion,
        creditLineDerivativePayload,
      });
    });
    for (let j = 0; j < txData.length; j++) {
      log(`   Deploying '${txData[j].asset} Credit Line Derivative'`);
      log('   -------------------------------------');
      const gasEstimation = await synthereumDeployer.methods
        .deploySelfMintingDerivative(
          txData[j].creditLineDerivativeVersion,
          txData[j].creditLineDerivativePayload,
        )
        .estimateGas({ from: maintainer });
      if (gasEstimation != undefined) {
        const tx = await synthereumDeployer.methods
          .deploySelfMintingDerivative(
            txData[j].creditLineDerivativeVersion,
            txData[j].creditLineDerivativePayload,
          )
          .send({ from: maintainer, gasPrice });
        const { transactionHash } = tx;
        await logTransactionOutput({
          log,
          web3,
          txhash: transactionHash,
          contractName: txData[j].asset,
          txSummaryText: 'deployCreditLineDerivative',
        });
      }
    }
  }
};
