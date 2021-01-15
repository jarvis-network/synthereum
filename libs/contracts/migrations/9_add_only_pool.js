const web3Utils = require('web3-utils');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const umaContracts = require('../data/uma-contract-dependencies.json');
const umaConfig = require('../data/uma-config.json');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumDeployer = artifacts.require('SynthereumDeployer');
var SynthereumPool = artifacts.require('SynthereumPool');
var deployment = require('../data/deployment/only-pools.json');
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
  if (deployment[networkId].isEnabled === true) {
    assets[networkId].map(async asset => {
      let poolVersion = '';
      let poolPayload = '';
      let derivative = deployment[networkId].Derivatives[asset.syntheticSymbol];
      let poolForAdding =
        deployment[networkId].PoolForAdding[asset.syntheticSymbol];
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
        derivative,
        poolForAdding,
        poolVersion,
        poolPayload,
      });
    });
    for (let j = 0; j < txData.length; j++) {
      console.log(`   Deploying '${txData[j].asset}'`);
      console.log('   -------------------------------------');
      const gasEstimation = isDeployedDeployer
        ? await synthereumDeployerInstance.deployOnlyPool.estimateGas(
            txData[j].poolVersion,
            txData[j].poolPayload,
            txData[j].derivative,
            { from: maintainer },
          )
        : await synthereumDeployerInstance.methods
            .deployOnlyPool(
              txData[j].poolVersion,
              txData[j].poolPayload,
              txData[j].derivative,
            )
            .estimateGas({ from: maintainer });
      if (gasEstimation != undefined) {
        const poolToDeploy = isDeployedDeployer
          ? await synthereumDeployerInstance.deployOnlyPool.call(
              txData[j].poolVersion,
              txData[j].poolPayload,
              txData[j].derivative,
              { from: maintainer },
            )
          : await synthereumDeployerInstance.methods
              .deployOnlyPool(
                txData[j].poolVersion,
                txData[j].poolPayload,
                txData[j].derivative,
              )
              .call({ from: maintainer });
        console.log(`Preparing to call deployOnlyPool`, { isDeployedDeployer });
        const tx = isDeployedDeployer
          ? await synthereumDeployerInstance.deployOnlyPool(
              txData[j].poolVersion,
              txData[j].poolPayload,
              txData[j].derivative,
              { from: maintainer },
            )
          : await synthereumDeployerInstance.methods
              .deployOnlyPool(
                txData[j].poolVersion,
                txData[j].poolPayload,
                txData[j].derivative,
              )
              .send({ from: maintainer });
        const gasUsed = isDeployedDeployer ? tx.receipt.gasUsed : tx.gasUsed;
        console.log(`   > gas used: ${gasUsed}`);
        console.log('\n');
        const poolforAddInstance = await SynthereumPool.at(
          txData[j].poolForAdding,
        );
        await poolforAddInstance.addRoleInDerivative(
          txData[j].derivative,
          2,
          poolToDeploy,
          { from: maintainer },
        );
      }
    }
  }
};
