const rolesConfig = require('../data/roles.json');
const { getExistingInstance } = require('../dist/migration-utils/deployment');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumTICHelper = artifacts.require('SynthereumTICHelper');
const SynthereumPoolLib = artifacts.require('SynthereumPoolLib');
const SynthereumPoolOnChainPriceFeedLib = artifacts.require(
  'SynthereumPoolOnChainPriceFeedLib',
);
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const SynthereumTICFactory = artifacts.require('SynthereumTICFactory');
const SynthereumPoolFactory = artifacts.require('SynthereumPoolFactory');
const SynthereumPoolOnChainPriceFeedFactory = artifacts.require(
  'SynthereumPoolOnChainPriceFeedFactory',
);

const poolVersions = require('../data/pool-versions.json');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = await toNetworkId(network);
  const synthereumFactoryVersioning = await getExistingInstance(
    web3,
    SynthereumFactoryVersioning,
  );
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  if (poolVersions[networkId]?.TICFactory?.isEnabled ?? true) {
    //hardat
    if (SynthereumTICHelper.setAsDeployed) {
      const { contract: synthereumTICHelper } = await deploy(
        deployer,
        network,
        SynthereumTICHelper,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SynthereumTICFactory.link(synthereumTICHelper);
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
      synthereumFinder.options.address,
      { from: keys.deployer },
    );
    const synthereumTICFactory = await getExistingInstance(
      web3,
      SynthereumTICFactory,
    );
    await synthereumFactoryVersioning.methods
      .setPoolFactory(
        poolVersions[networkId]?.TICFactory?.version ?? 1,
        synthereumTICFactory.options.address,
      )
      .send({ from: maintainer });
    console.log('TICFactory added to SynthereumFactoryVersioning');
  }
  if (poolVersions[networkId]?.PoolFactory?.isEnabled ?? true) {
    if (SynthereumPoolLib.setAsDeployed) {
      const { contract: synthereumPoolLib } = await deploy(
        deployer,
        network,
        SynthereumPoolLib,
        { from: keys.deployer },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SynthereumPoolFactory.link(synthereumPoolLib);
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
      synthereumFinder.options.address,
      { from: keys.deployer },
    );
    const synthereumPoolFactory = await getExistingInstance(
      web3,
      SynthereumPoolFactory,
    );
    await synthereumFactoryVersioning.methods
      .setPoolFactory(
        poolVersions[networkId]?.PoolFactory?.version ?? 2,
        synthereumPoolFactory.options.address,
      )
      .send({ from: maintainer });
    console.log('PoolFactory added to SynthereumFactoryVersioning');
  }
  if (poolVersions[networkId]?.PoolOnChainPriceFeedFactory?.isEnabled ?? true) {
    if (SynthereumPoolOnChainPriceFeedLib.setAsDeployed) {
      const { contract: synthereumPoolOnChainPriceFeedLib } = await deploy(
        deployer,
        network,
        SynthereumPoolOnChainPriceFeedLib,
        {
          from: keys.deployer,
        },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SynthereumPoolOnChainPriceFeedFactory.link(
          synthereumPoolOnChainPriceFeedLib,
        );
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(deployer, network, SynthereumPoolOnChainPriceFeedLib, {
        from: keys.deployer,
      });
      await deployer.link(
        SynthereumPoolOnChainPriceFeedLib,
        SynthereumPoolOnChainPriceFeedFactory,
      );
    }
    await deploy(
      deployer,
      network,
      SynthereumPoolOnChainPriceFeedFactory,
      synthereumFinder.options.address,
      { from: keys.deployer },
    );
    const synthereumPoolOnChainPriceFeedFactory = await getExistingInstance(
      web3,
      SynthereumPoolOnChainPriceFeedFactory,
    );
    await synthereumFactoryVersioning.methods
      .setPoolFactory(
        poolVersions[networkId]?.PoolOnChainPriceFeedFactory?.version ?? 3,
        synthereumPoolOnChainPriceFeedFactory.options.address,
      )
      .send({ from: maintainer });
    console.log(
      'PoolOnChainPriceFeedFactory added to SynthereumFactoryVersioning',
    );
  }
};
