module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumFactoryVersioning',
  'SynthereumLiquidityPoolLib',
  'SynthereumLiquidityPoolFactory',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumFinder,
    SynthereumFactoryVersioning,
    SynthereumLiquidityPoolLib,
    SynthereumLiquidityPoolFactory,
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
  if (poolVersions[networkId]?.LiquidityPoolFactory?.isEnabled ?? true) {
    if (SynthereumLiquidityPoolLib.setAsDeployed) {
      const { contract: synthereumLiquidityPoolLib } = await deploy(
        web3,
        deployer,
        network,
        SynthereumLiquidityPoolLib,
        {
          from: keys.deployer,
        },
      );

      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await SynthereumLiquidityPoolFactory.link(synthereumLiquidityPoolLib);
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await deploy(web3, deployer, network, SynthereumLiquidityPoolLib, {
        from: keys.deployer,
      });
      await deployer.link(
        SynthereumLiquidityPoolLib,
        SynthereumLiquidityPoolFactory,
      );
    }
    await deploy(
      web3,
      deployer,
      network,
      SynthereumLiquidityPoolFactory,
      synthereumFinder.options.address,
      { from: keys.deployer },
    );
    const synthereumLiquidityPoolFactory = await getExistingInstance(
      web3,
      SynthereumLiquidityPoolFactory,
      '@jarvis-network/synthereum-contracts',
    );
    const factoryInterface = await web3.utils.stringToHex('PoolFactory');
    await synthereumFactoryVersioning.methods
      .setFactory(
        factoryInterface,
        poolVersions[networkId]?.LiquidityPoolFactory?.version ?? 5,
        synthereumLiquidityPoolFactory.options.address,
      )
      .send({ from: maintainer });
    console.log('LiquidityPoolFactory added to SynthereumFactoryVersioning');
  }
}
