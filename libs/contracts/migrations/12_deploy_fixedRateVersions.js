module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumFactoryVersioning',
  'SynthereumFixedRateFactory',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumFinder,
    SynthereumFactoryVersioning,
    SynthereumFixedRateFactory,
  } = migrate.getContracts(artifacts);

  const fixedRateVersions = require('../data/fixedRate-versions.json');
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
    '@jarvis-network/synthereum-contracts',
  );
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  if (fixedRateVersions[networkId]?.FixedRateFactory?.isEnabled ?? true) {
    await deploy(
      web3,
      deployer,
      network,
      SynthereumFixedRateFactory,
      synthereumFinder.options.address,
      { from: keys.deployer },
    );
    const synthereumFixedRateFactory = await getExistingInstance(
      web3,
      SynthereumFixedRateFactory,
      '@jarvis-network/synthereum-contracts',
    );
    const factoryInterface = await web3.utils.stringToHex('FixedRateFactory');
    await synthereumFactoryVersioning.methods
      .setFactory(
        factoryInterface,
        fixedRateVersions[networkId]?.SynthereumFixedRateFactory?.version ?? 1,
        synthereumFixedRateFactory.options.address,
      )
      .send({ from: maintainer });
    console.log('FixedRateFactory added to SynthereumFactoryVersioning');
  }
}
