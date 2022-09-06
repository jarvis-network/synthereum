module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumFactoryVersioning',
  'SynthereumLiquidityPoolLib',
  'SynthereumLiquidityPoolFactory',
  'SynthereumMultiLpLiquidityPool',
  'SynthereumMultiLpLiquidityPoolWithRewards',
  'SynthereumMultiLpLiquidityPoolMainLib',
  'SynthereumMultiLpLiquidityPoolMigrationLib',
  'SynthereumMultiLpLiquidityPoolFactory',
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
    SynthereumMultiLpLiquidityPool,
    SynthereumMultiLpLiquidityPoolWithRewards,
    SynthereumMultiLpLiquidityPoolMainLib,
    SynthereumMultiLpLiquidityPoolMigrationLib,
    SynthereumMultiLpLiquidityPoolFactory,
  } = migrate.getContracts(artifacts);

  const poolVersions = require('../data/pool-versions.json');
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const synthereumFactoryVersioning = await getExistingInstance(
    web3,
    SynthereumFactoryVersioning,
    '@jarvis-network/synthereum-contracts',
  );
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  if (poolVersions[networkId]?.LiquidityPoolFactory?.isEnabled ?? true) {
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
  if (poolVersions[networkId]?.MultiLpLiquidityPoolFactory?.isEnabled ?? true) {
    const { contract: synthereumMultiLiquidityPoolMainLib } = await deploy(
      web3,
      deployer,
      network,
      SynthereumMultiLpLiquidityPoolMainLib,
      {
        from: keys.deployer,
      },
    );
    const { contract: synthereumMultiLiquidityPoolMigrationLib } = await deploy(
      web3,
      deployer,
      network,
      SynthereumMultiLpLiquidityPoolMigrationLib,
      {
        from: keys.deployer,
      },
    );
    let multiLpLiquidityPoolInstance;
    if (
      !poolVersions[networkId]?.MultiLpLiquidityPoolFactory?.isRewarded ??
      true
    ) {
      await SynthereumMultiLpLiquidityPool.link(
        synthereumMultiLiquidityPoolMainLib,
      );
      await SynthereumMultiLpLiquidityPool.link(
        synthereumMultiLiquidityPoolMigrationLib,
      );
      await deploy(web3, deployer, network, SynthereumMultiLpLiquidityPool, {
        from: keys.deployer,
      });
      multiLpLiquidityPoolInstance = await getExistingInstance(
        web3,
        SynthereumMultiLpLiquidityPool,
        '@jarvis-network/synthereum-contracts',
      );
    } else {
      await SynthereumMultiLpLiquidityPoolWithRewards.link(
        synthereumMultiLiquidityPoolMainLib,
      );
      await SynthereumMultiLpLiquidityPoolWithRewards.link(
        synthereumMultiLiquidityPoolMigrationLib,
      );
      await deploy(
        web3,
        deployer,
        network,
        SynthereumMultiLpLiquidityPoolWithRewards,
        {
          from: keys.deployer,
        },
      );
      multiLpLiquidityPoolInstance = await getExistingInstance(
        web3,
        SynthereumMultiLpLiquidityPoolWithRewards,
        '@jarvis-network/synthereum-contracts',
      );
    }
    await deploy(
      web3,
      deployer,
      network,
      SynthereumMultiLpLiquidityPoolFactory,
      synthereumFinder.options.address,
      multiLpLiquidityPoolInstance.options.address,
      { from: keys.deployer },
    );
  }
  const synthereumMultiLpLiquidityPoolFactory = await getExistingInstance(
    web3,
    SynthereumMultiLpLiquidityPoolFactory,
    '@jarvis-network/synthereum-contracts',
  );
  const factoryInterface = await web3.utils.stringToHex('PoolFactory');
  await synthereumFactoryVersioning.methods
    .setFactory(
      factoryInterface,
      poolVersions[networkId]?.MultiLpLiquidityPoolFactory?.version ?? 6,
      synthereumMultiLpLiquidityPoolFactory.options.address,
    )
    .send({ from: maintainer });
  console.log(
    'MultiLpLiquidityPoolFactory added to SynthereumFactoryVersioning',
  );
}
