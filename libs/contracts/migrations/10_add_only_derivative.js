const web3Utils = require('web3-utils');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const umaContracts = require('../data/uma-contract-dependencies.json');
const umaConfig = require('../data/uma-config.json');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumDeployer = artifacts.require('SynthereumDeployer');
var SynthereumPool = artifacts.require('SynthereumPool');
var deployment = require('../data/deployment/only-derivatives.json');
var assets = require('../data/synthetic-assets.json');
var derivativeVersions = require('../data/derivative-versions.json');
const { getDeploymentInstance } = require('../utils/deployment.js');
const { encodeDerivative } = require('../utils/encoding.js');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();

  const {
    contractInstance: synthereumDeployerInstance,
    isDeployed: isDeployedDeployer,
  } = await getDeploymentInstance(
    SynthereumDeployer,
    'SynthereumDeployer',
    networkId,
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
          [
            isDeployedDeployer
              ? synthereumDeployerInstance.address
              : synthereumDeployerInstance.options.address,
          ],
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
      console.log(`   Deploying '${txData[j].asset} Derivative'`);
      console.log('   -------------------------------------');
      const gasEstimation = isDeployedDeployer
        ? await synthereumDeployerInstance.deployOnlyDerivative.estimateGas(
            txData[j].derivativeVersion,
            txData[j].derivativePayload,
            txData[j].pool,
            { from: maintainer },
          )
        : await synthereumDeployerInstance.methods
            .deployOnlyDerivative(
              txData[j].derivativeVersion,
              txData[j].derivativePayload,
              txData[j].pool,
            )
            .estimateGas({ from: maintainer });
      if (gasEstimation != undefined) {
        const derivativeToDeploy = isDeployedDeployer
          ? await synthereumDeployerInstance.deployOnlyDerivative.call(
              txData[j].derivativeVersion,
              txData[j].derivativePayload,
              txData[j].pool,
              { from: maintainer },
            )
          : await synthereumDeployerInstance.methods
              .deployOnlyDerivative(
                txData[j].derivativeVersion,
                txData[j].derivativePayload,
                txData[j].pool,
              )
              .call({ from: maintainer });
        const tx = isDeployedDeployer
          ? await synthereumDeployerInstance.deployOnlyDerivative(
              txData[j].derivativeVersion,
              txData[j].derivativePayload,
              txData[j].pool,
              { from: maintainer },
            )
          : await synthereumDeployerInstance.methods
              .deployOnlyDerivative(
                txData[j].derivativeVersion,
                txData[j].derivativePayload,
                txData[j].pool,
              )
              .send({ from: maintainer });
        const gasUsed = isDeployedDeployer ? tx.receipt.gasUsed : tx.gasUsed;
        console.log(`   > gas used: ${gasUsed}`);
        console.log('\n');
        const poolInstance = await SynthereumPool.at(txData[j].pool);
        await poolInstance.addDerivative(derivativeToDeploy, {
          from: maintainer,
        });
        await poolInstance.addRoleInSynthToken(
          txData[j].derivativeForAdding,
          3,
          derivativeToDeploy,
          { from: maintainer },
        );
      }
    }
  }
};
