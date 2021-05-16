const rolesConfig = require('../data/roles.json');
const { getExistingInstance } = require('../dist/migration-utils/deployment');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumPoolOnChainPriceFeedLib = artifacts.require(
  'SynthereumPoolOnChainPriceFeedLib',
);
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
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
        poolVersions[networkId]?.PoolOnChainPriceFeedFactory?.version ?? 4,
        synthereumPoolOnChainPriceFeedFactory.options.address,
      )
      .send({ from: maintainer });
    console.log(
      'PoolOnChainPriceFeedFactory added to SynthereumFactoryVersioning',
    );
  }
};
