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
const {
  getDeploymentInstance,
  printTruffleLikeTransactionOutput,
} = require('../utils/deployment.js');
const { encodeDerivative, encodePool } = require('../utils/encoding.js');
const { parseFiniteFloat } = require('@jarvis-network/web3-utils/base/asserts');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();

  const gasPrice = parseFiniteFloat(process.env.GAS_PRICE);

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
        derivativePayload = encodeDerivative(
          collAddress,
          asset.priceFeedIdentifier,
          asset.syntheticName,
          asset.syntheticSymbol,
          ZERO_ADDRESS,
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
      if (deployment[networkId].Pool === 1) {
        poolVersion = poolVersions[networkId]['TICFactory'].version;
        poolPayload = encodeTIC(
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
            feePercentage: fees[networkId].feePercentage,
            feeRecipients: fees[networkId].feeRecipients,
            feeProportions: fees[networkId].feeProportions,
          },
        );
      } else if (deployment[networkId].Pool === 2) {
        poolVersion = poolVersions[networkId]['PoolFactory'].version;
        poolPayload = encodePool(
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
            feePercentage: fees[networkId].feePercentage,
            feeRecipients: fees[networkId].feeRecipients,
            feeProportions: fees[networkId].feeProportions,
          },
        );
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
              .send({ from: maintainer, gasPrice });

        const { transactionHash } = isDeployedDeployer ? tx.receipt : tx;
        await printTruffleLikeTransactionOutput(
          txData[j].asset,
          '<not ctor call>',
          transactionHash,
        );
      }
    }
  }
};
