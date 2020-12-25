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

module.exports = async function (deployer, network, accounts) {
  const networkId = config.networks[network.replace(/-fork$/, '')].network_id;
  let admin = rolesConfig[networkId].admin || accounts[0];
  let maintainer = rolesConfig[networkId].maintainer || accounts[1];
  let liquidityProvider =
    rolesConfig[networkId].liquidityProvider || accounts[2];
  let validator = rolesConfig[networkId].validator || accounts[3];
  let txData = [];

  if (deployment[networkId].isEnabled === true) {
    const synthereumFinderInstance = await SynthereumFinder.deployed();
    const synthereumDeployerInstance = await SynthereumDeployer.deployed();
    assets[networkId].map(async asset => {
      let derivativeVersion = '';
      let derivativePayload = '';
      let pool = deployment[networkId].Pools[asset.syntheticSymbol];
      let derivativeForAdding =
        deployment[networkId].DerivativeForAdding[asset.syntheticSymbol];
      if (deployment[networkId].Derivative === 1) {
        derivativeVersion =
          derivativeVersions[networkId]['DerivativeFactory'].version;
        derivativePayload = web3.eth.abi.encodeParameters(
          [
            {
              params: {
                collateralAddress: 'address',
                priceFeedIdentifier: 'bytes32',
                syntheticName: 'string',
                syntheticSymbol: 'string',
                syntheticToken: 'address',
                collateralRequirement: {
                  rawValue: 'uint256',
                },
                disputeBondPct: {
                  rawValue: 'uint256',
                },
                sponsorDisputeRewardPct: {
                  ravValue: 'uint256',
                },
                disputerDisputeRewardPct: {
                  rawValue: 'uint256',
                },
                minSponsorTokens: {
                  rawValue: 'uint256',
                },
                withdrawalLiveness: 'uint256',
                liquidationLiveness: 'uint256',
                excessTokenBeneficiary: 'address',
                admins: 'address[]',
                pools: 'address[]',
              },
            },
          ],
          [
            {
              collateralAddress: umaContracts[networkId].collateralAddress,
              priceFeedIdentifier: web3Utils.toHex(asset.priceFeedIdentifier),
              syntheticName: asset.syntheticName,
              syntheticSymbol: asset.syntheticSymbol,
              syntheticToken:
                deployment[networkId].SyntheticTokenAddress[
                  asset.syntheticSymbol
                ],
              collateralRequirement: {
                rawValue: asset.collateralRequirement,
              },
              disputeBondPct: {
                rawValue: umaConfig[networkId].disputeBondPct,
              },
              sponsorDisputeRewardPct: {
                ravValue: umaConfig[networkId].sponsorDisputeRewardPct,
              },
              disputerDisputeRewardPct: {
                rawValue: umaConfig[networkId].disputerDisputeRewardPct,
              },
              minSponsorTokens: {
                rawValue: asset.minSponsorTokens,
              },
              withdrawalLiveness: umaConfig[networkId].withdrawalLiveness,
              liquidationLiveness: umaConfig[networkId].liquidationLiveness,
              excessTokenBeneficiary:
                umaConfig[networkId].excessTokenBeneficiary,
              admins: [synthereumDeployerInstance.address],
              pools: [],
            },
          ],
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
      const gasEstimation = await synthereumDeployerInstance.deployOnlyDerivative.estimateGas(
        txData[j].derivativeVersion,
        txData[j].derivativePayload,
        txData[j].pool,
        { from: maintainer },
      );
      if (gasEstimation != undefined) {
        const derivativeToDeploy = await synthereumDeployerInstance.deployOnlyDerivative.call(
          txData[j].derivativeVersion,
          txData[j].derivativePayload,
          txData[j].pool,
          { from: maintainer },
        );
        const tx = await synthereumDeployerInstance.deployOnlyDerivative(
          txData[j].derivativeVersion,
          txData[j].derivativePayload,
          txData[j].pool,
          { from: maintainer },
        );
        console.log(`   > gas used: ${tx.receipt.gasUsed}`);
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
