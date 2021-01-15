const web3Utils = require('web3-utils');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const umaContracts = require('../data/uma-contract-dependencies.json');
const umaConfig = require('../data/uma-config.json');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumDeployer = artifacts.require('SynthereumDeployer');
var TestnetERC20 = artifacts.require('TestnetERC20');
var deployment = require('../data/deployment/derivatives-and-pools.json');
var assets = require('../data/synthetic-assets.json');
var derivativeVersions = require('../data/derivative-versions.json');
var poolVersions = require('../data/pool-versions.json');
var fees = require('../data/fees.json');
const { getDeploymentInstance } = require('../utils/deployment.js');

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
  const {
    contractInstance: synthereumFinderInstance,
    isDeployed: isDeployedFinder,
  } = await getDeploymentInstance(
    SynthereumFinder,
    'SynthereumFinder',
    networkId,
  );

  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const liquidityProvider =
    rolesConfig[networkId]?.liquidityProvider ?? accounts[2];
  const validator = rolesConfig[networkId]?.validator ?? accounts[3];
  let txData = [];
  collAddress =
    umaContracts[networkId]?.collateralAddress ??
    (await TestnetERC20.deployed()).address;

  if (deployment[networkId].isEnabled === true) {
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
              collateralAddress: collAddress,
              priceFeedIdentifier: web3Utils.padRight(
                web3Utils.toHex(asset.priceFeedIdentifier),
                64,
              ),
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
              admins: [
                isDeployedDeployer
                  ? synthereumDeployerInstance.address
                  : synthereumDeployerInstance.options.address,
              ],
              pools: [],
            },
          ],
        );
      }
      if (deployment[networkId].Pool === 1) {
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
            isDeployedFinder
              ? synthereumFinderInstance.address
              : synthereumFinderInstance.options.address,
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
      } else if (deployment[networkId].Pool === 2) {
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
            isDeployedFinder
              ? synthereumFinderInstance.address
              : synthereumFinderInstance.options.address,
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
      const gasEstimation = isDeployedDeployer
        ? await synthereumDeployerInstance.deployPoolAndDerivative.estimateGas(
            txData[j].derivativeVersion,
            txData[j].poolVersion,
            txData[j].derivativePayload,
            txData[j].poolPayload,
            { from: maintainer },
          )
        : await synthereumDeployerInstance.methods
            .deployPoolAndDerivative(
              txData[j].derivativeVersion,
              txData[j].poolVersion,
              txData[j].derivativePayload,
              txData[j].poolPayload,
            )
            .estimateGas({ from: maintainer });
      if (gasEstimation != undefined) {
        const tx = isDeployedDeployer
          ? await synthereumDeployerInstance.deployPoolAndDerivative(
              txData[j].derivativeVersion,
              txData[j].poolVersion,
              txData[j].derivativePayload,
              txData[j].poolPayload,
              { from: maintainer },
            )
          : await synthereumDeployerInstance.methods
              .deployPoolAndDerivative(
                txData[j].derivativeVersion,
                txData[j].poolVersion,
                txData[j].derivativePayload,
                txData[j].poolPayload,
              )
              .send({ from: maintainer });

        const gasUsed = isDeployedDeployer ? tx.receipt.gasUsed : tx.gasUsed;
        console.log(`   > gas used: ${gasUsed}`);
        console.log('\n');
      }
    }
  }
};
