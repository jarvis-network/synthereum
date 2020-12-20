const web3Utils = require('web3-utils');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const umaContracts = require('../data/uma-contract-dependencies.json');
const umaConfig = require('../data/uma-config.json');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumDeployer = artifacts.require('SynthereumDeployer');
var deployment = require('../data/deployment/derivatives-and-pools.json');
var assets = require('../data/synthetic-assets.json');
var derivativeVersions = require('../data/derivative-versions.json');
var poolVersions = require('../data/pool-versions.json');
var fees = require('../data/fees.json');

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
      let poolVersion = '';
      let derivativePayload = '';
      let poolPayload = '';

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
              syntheticToken: ZERO_ADDRESS,
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
      if (deployment[networkId].Pool === 0) {
        poolVersion = poolVersions[networkId]['TICFactory'].version;
        poolPayload = web3.eth.abi.encodeParameters(
          [
            'address',
            'address',
            'uint8',
            {
              roles: {
                admin: 'address',
                maintainer: 'address',
                liquidityProvider: 'address',
                validator: 'address',
              },
            },
            'uint256',
            {
              fee: {
                feePercentage: {
                  rawValue: 'uint256',
                },
                feeRecipients: 'address[]',
                feeProportions: 'uint32[]',
              },
            },
          ],
          [
            ZERO_ADDRESS,
            synthereumFinderInstance.address,
            poolVersion,
            {
              admin: admin,
              maintainer: maintainer,
              liquidityProvider: liquidityProvider,
              validator: validator,
            },
            asset.startingCollateralization,
            {
              feePercentage: {
                rawValue: web3Utils.toWei(
                  fees[networkId].feePercentage.toString(),
                ),
              },
              feeRecipients: fees[networkId].feeRecipients,
              feeProportions: fees[networkId].feeProportions,
            },
          ],
        );
        poolPayload = '0x' + poolPayload.substring(66);
      } else if (deployment[networkId].Pool === 1) {
        poolVersion = poolVersions[networkId]['PoolFactory'].version;
        poolPayload = web3.eth.abi.encodeParameters(
          [
            'address',
            'address',
            'uint8',
            {
              roles: {
                admin: 'address',
                maintainer: 'address',
                liquidityProvider: 'address',
                validator: 'address',
              },
            },
            'bool',
            'uint256',
            {
              fee: {
                feePercentage: {
                  rawValue: 'uint256',
                },
                feeRecipients: 'address[]',
                feeProportions: 'uint32[]',
              },
            },
          ],
          [
            ZERO_ADDRESS,
            synthereumFinderInstance.address,
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
              feePercentage: {
                rawValue: web3Utils.toWei(
                  fees[networkId].feePercentage.toString(),
                ),
              },
              feeRecipients: fees[networkId].feeRecipients,
              feeProportions: fees[networkId].feeProportions,
            },
          ],
        );
        poolPayload = '0x' + poolPayload.substring(66);
      }
      txData.push({
        asset: asset.syntheticSymbol,
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
      });
    });
    for (let j = 0; j < txData.length; j++) {
      console.log(`   Deploying '${txData[j].asset}'`);
      console.log('   -------------------------------------');
      const gasEstimation = await synthereumDeployerInstance.deployPoolAndDerivative.estimateGas(
        txData[j].derivativeVersion,
        txData[j].poolVersion,
        txData[j].derivativePayload,
        txData[j].poolPayload,
        { from: maintainer },
      );
      if (gasEstimation != undefined) {
        const tx = await synthereumDeployerInstance.deployPoolAndDerivative(
          txData[j].derivativeVersion,
          txData[j].poolVersion,
          txData[j].derivativePayload,
          txData[j].poolPayload,
          { from: maintainer },
        );
        console.log(`   > gas used: ${tx.receipt.gasUsed}`);
        console.log('\n');
      }
    }
  }
};
