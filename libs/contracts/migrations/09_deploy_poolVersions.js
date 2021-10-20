module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumFactoryVersioning',
  'SynthereumPoolOnChainPriceFeedLib',
  'SynthereumPoolOnChainPriceFeedFactory',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumFinder,
    SynthereumFactoryVersioning,
    SynthereumPoolOnChainPriceFeedLib,
    SynthereumPoolOnChainPriceFeedFactory,
  } = migrate.getContracts(artifacts);

  const poolVersions = require('../data/pool-versions.json');
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = await toNetworkId(network);
  const synthereumFactoryVersioning = await getExistingInstance(
    web3,
    SynthereumFactoryVersioning,
  );
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  if (poolVersions[networkId]?.PoolOnChainPriceFeedFactory?.isEnabled ?? true) {
    if (SynthereumPoolOnChainPriceFeedLib.setAsDeployed) {
      const { contract: synthereumPoolOnChainPriceFeedLib } = await deploy(
        web3,
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
      await deploy(web3, deployer, network, SynthereumPoolOnChainPriceFeedLib, {
        from: keys.deployer,
      });
      await deployer.link(
        SynthereumPoolOnChainPriceFeedLib,
        SynthereumPoolOnChainPriceFeedFactory,
      );
    }
    await deploy(
      web3,
      deployer,
      network,
      SynthereumPoolOnChainPriceFeedFactory,
      synthereumFinder.options.address,
      { from: keys.deployer },
    );
    const synthereumPoolOnChainPriceFeedFactory = await getExistingInstance(
      web3,
      SynthereumPoolOnChainPriceFeedFactory,
      '@jarvis-network/synthereum-contracts',
    );
    const factoryInterface = await web3.utils.stringToHex('PoolFactory');
    await synthereumFactoryVersioning.methods
      .setFactory(
        factoryInterface,
        poolVersions[networkId]?.PoolOnChainPriceFeedFactory?.version ?? 4,
        synthereumPoolOnChainPriceFeedFactory.options.address,
      )
      .send({ from: maintainer });
    console.log(
      'PoolOnChainPriceFeedFactory added to SynthereumFactoryVersioning',
    );
  }
}
