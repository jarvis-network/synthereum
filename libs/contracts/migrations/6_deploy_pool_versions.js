var tdr = require('truffle-deploy-registry');
const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumTICHelper = artifacts.require('SynthereumTICHelper');
var SynthereumPoolLib = artifacts.require('SynthereumPoolLib');
var SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
var SynthereumTICFactory = artifacts.require('SynthereumTICFactory');
var SynthereumPoolFactory = artifacts.require('SynthereumPoolFactory');
var poolVersions = require('../data/pool-versions.json');

module.exports = async function (deployer, network, accounts) {
  const networkId = config.networks[network.replace(/-fork$/, '')].network_id;
  const maintainer = rolesConfig[networkId].maintainer || accounts[1];
  const synthereumFinderInstance = await SynthereumFinder.deployed();
  const synthereumFactoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
  if (poolVersions[networkId]['TICFactory'].isEnabled === true) {
    await deployer.deploy(SynthereumTICHelper);
    const synthereumTICHelperInstance = await SynthereumTICHelper.deployed();
    if (!tdr.isDryRunNetworkName(network)) {
      tdr.appendInstance(synthereumTICHelperInstance);
    }
    await deployer.link(SynthereumTICHelper, [SynthereumTICFactory]);
    await deployer.deploy(
      SynthereumTICFactory,
      synthereumFinderInstance.address,
      { from: accounts[0] },
    );
    const synthereumTICFactoryInstance = await SynthereumTICFactory.deployed();
    await synthereumFactoryVersioningInstance.setPoolFactory(
      poolVersions[networkId]['TICFactory'].version,
      synthereumTICFactoryInstance.address,
      { from: maintainer },
    );
    if (!tdr.isDryRunNetworkName(network)) {
      tdr.appendInstance(synthereumTICFactoryInstance);
    }
  }
  if (poolVersions[networkId]['PoolFactory'].isEnabled === true) {
    await deployer.deploy(SynthereumPoolLib);
    const synthereumPoolLibInstance = await SynthereumPoolLib.deployed();
    if (!tdr.isDryRunNetworkName(network)) {
      tdr.appendInstance(synthereumPoolLibInstance);
    }
    await deployer.link(SynthereumPoolLib, [SynthereumPoolFactory]);
    await deployer.deploy(
      SynthereumPoolFactory,
      synthereumFinderInstance.address,
      { from: accounts[0] },
    );
    const synthereumPoolFactoryInstance = await SynthereumPoolFactory.deployed();
    await synthereumFactoryVersioningInstance.setPoolFactory(
      poolVersions[networkId]['PoolFactory'].version,
      synthereumPoolFactoryInstance.address,
      { from: maintainer },
    );
    if (!tdr.isDryRunNetworkName(network)) {
      return tdr.appendInstance(synthereumPoolFactoryInstance);
    }
  }
};
