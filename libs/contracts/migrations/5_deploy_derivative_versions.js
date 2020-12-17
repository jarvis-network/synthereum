var tdr = require('truffle-deploy-registry');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const umaContracts = require('../data/uma-contract-dependencies.json');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var FeePayerPoolPartyLib = artifacts.require('FeePayerPoolPartyLib');
var PerpetualLiquidatablePoolPartyLib = artifacts.require(
  'PerpetualLiquidatablePoolPartyLib',
);
var PerpetualPositionManagerPoolPartyLib = artifacts.require(
  'PerpetualPositionManagerPoolPartyLib',
);
var PerpetualPoolPartyLib = artifacts.require('PerpetualPoolPartyLib');

var MintableBurnableTokenFactory = artifacts.require(
  'MintableBurnableTokenFactory',
);
var SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
var SynthereumDerivativeFactory = artifacts.require(
  'SynthereumDerivativeFactory',
);
var SynthereumSyntheticTokenFactory = artifacts.require(
  'SynthereumSyntheticTokenFactory',
);
var derivativeVersions = require('../data/derivative-versions.json');

module.exports = async function (deployer, network, accounts) {
  const networkId = config.networks[network.replace(/-fork$/, '')].network_id;
  const maintainer = rolesConfig[networkId].maintainer || accounts[1];
  if (derivativeVersions[networkId]['DerivativeFactory'].isEnabled === true) {
    const synthereumFinderInstance = await SynthereumFinder.deployed();
    await deployer.deploy(
      SynthereumSyntheticTokenFactory,
      synthereumFinderInstance.address,
      derivativeVersions[networkId]['DerivativeFactory'].version,
      { from: accounts[0] },
    );
    const synthereumSyntheticTokenFactoryInstance = await SynthereumSyntheticTokenFactory.deployed();
    if (!tdr.isDryRunNetworkName(network)) {
      tdr.appendInstance(synthereumSyntheticTokenFactoryInstance);
    }
    await deployer.deploy(FeePayerPoolPartyLib);
    const feePayerPoolPartyLibInstance = await FeePayerPoolPartyLib.deployed();
    if (!tdr.isDryRunNetworkName(network)) {
      tdr.appendInstance(feePayerPoolPartyLibInstance);
    }
    await deployer.link(FeePayerPoolPartyLib, [
      PerpetualPositionManagerPoolPartyLib,
      PerpetualLiquidatablePoolPartyLib,
      PerpetualPoolPartyLib,
    ]);
    await deployer.deploy(PerpetualPositionManagerPoolPartyLib);
    const perpetualPositionManagerPoolPartyLibInstance = await PerpetualPositionManagerPoolPartyLib.deployed();
    if (!tdr.isDryRunNetworkName(network)) {
      tdr.appendInstance(perpetualPositionManagerPoolPartyLibInstance);
    }
    await deployer.link(PerpetualPositionManagerPoolPartyLib, [
      PerpetualLiquidatablePoolPartyLib,
      PerpetualPoolPartyLib,
    ]);
    await deployer.deploy(PerpetualLiquidatablePoolPartyLib);
    const perpetualLiquidatablePoolPartyLibInstance = await PerpetualLiquidatablePoolPartyLib.deployed();
    if (!tdr.isDryRunNetworkName(network)) {
      tdr.appendInstance(perpetualLiquidatablePoolPartyLibInstance);
    }
    await deployer.link(PerpetualLiquidatablePoolPartyLib, [
      PerpetualPoolPartyLib,
    ]);
    await deployer.deploy(PerpetualPoolPartyLib);
    const perpetualPoolPartyLibInstance = await PerpetualPoolPartyLib.deployed();
    if (!tdr.isDryRunNetworkName(network)) {
      tdr.appendInstance(perpetualPoolPartyLibInstance);
    }
    await deployer.link(PerpetualPoolPartyLib, [SynthereumDerivativeFactory]);
    await deployer.deploy(
      SynthereumDerivativeFactory,
      synthereumFinderInstance.address,
      umaContracts[networkId].finderAddress,
      synthereumSyntheticTokenFactoryInstance.address,
      ZERO_ADDRESS,
      { from: accounts[0] },
    );
    const derivativeFactoryInstance = await SynthereumDerivativeFactory.deployed();
    const synthereumFactoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
    await synthereumFactoryVersioningInstance.setDerivativeFactory(
      derivativeVersions[networkId]['DerivativeFactory'].version,
      derivativeFactoryInstance.address,
      { from: maintainer },
    );
    if (!tdr.isDryRunNetworkName(network)) {
      return tdr.appendInstance(derivativeFactoryInstance);
    }
  }
};
