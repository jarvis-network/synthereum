const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const { getDeploymentInstance } = require('../utils/deployment.js');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumTICHelper = artifacts.require('SynthereumTICHelper');
var SynthereumPoolLib = artifacts.require('SynthereumPoolLib');
var SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
var SynthereumTICFactory = artifacts.require('SynthereumTICFactory');
var SynthereumPoolFactory = artifacts.require('SynthereumPoolFactory');
var poolVersions = require('../data/pool-versions.json');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();
  const {
    contractInstance: synthereumFactoryVersioningInstance,
    isDeployed: isDeployedFactoryVersioning,
  } = await getDeploymentInstance(
    SynthereumFactoryVersioning,
    'SynthereumFactoryVersioning',
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
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  if (poolVersions[networkId]?.TICFactory?.isEnabled ?? true) {
    //hardat
    if (SynthereumTICHelper.setAsDeployed) {
      const { contract: synthereumTICHelperInstance } = await deploy(
        deployer,
        network,
        SynthereumTICHelper,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SynthereumTICFactory.link(synthereumTICHelperInstance);
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, SynthereumTICHelper, {
        from: keys.deployer,
      });
      await deployer.link(SynthereumTICHelper, SynthereumTICFactory);
    }
    await deploy(
      deployer,
      network,
      SynthereumTICFactory,
      isDeployedFinder
        ? synthereumFinderInstance.address
        : synthereumFinderInstance.options.address,
      { from: keys.deployer },
    );
    const synthereumTICFactoryInstance = await SynthereumTICFactory.deployed();

    isDeployedFactoryVersioning
      ? await synthereumFactoryVersioningInstance.setPoolFactory(
          poolVersions[networkId]?.TICFactory?.version ?? 1,
          synthereumTICFactoryInstance.address,
          { from: maintainer },
        )
      : await synthereumFactoryVersioningInstance.methods
          .setPoolFactory(
            poolVersions[networkId]?.TICFactory?.version ?? 1,
            synthereumTICFactoryInstance.address,
          )
          .send({ from: maintainer });
    console.log('TICFactory added to SynthereumFactoryVersioning');
  }
  if (poolVersions[networkId]?.PoolFactory?.isEnabled ?? true) {
    if (SynthereumPoolLib.setAsDeployed) {
      const { contract: synthereumPoolLibInstance } = await deploy(
        deployer,
        network,
        SynthereumPoolLib,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SynthereumPoolFactory.link(synthereumPoolLibInstance);
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, SynthereumPoolLib, {
        from: keys.deployer,
      });
      await deployer.link(SynthereumPoolLib, SynthereumPoolFactory);
    }
    await deploy(
      deployer,
      network,
      SynthereumPoolFactory,
      isDeployedFinder
        ? synthereumFinderInstance.address
        : synthereumFinderInstance.options.address,
      { from: keys.deployer },
    );
    const synthereumPoolFactoryInstance = await SynthereumPoolFactory.deployed();

    isDeployedFactoryVersioning
      ? await synthereumFactoryVersioningInstance.setPoolFactory(
          poolVersions[networkId]?.PoolFactory?.version ?? 2,
          synthereumPoolFactoryInstance.address,
          { from: maintainer },
        )
      : await synthereumFactoryVersioningInstance.methods
          .setPoolFactory(
            poolVersions[networkId]?.PoolFactory?.version ?? 2,
            synthereumPoolFactoryInstance.address,
          )
          .send({ from: maintainer });
    console.log('PoolFactory added to SynthereumFactoryVersioning');
  }
};
