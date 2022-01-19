module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumFixedRateRegistry',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumFinder,
    SynthereumFixedRateRegistry,
  } = migrate.getContracts(artifacts);
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = toNetworkId(network);
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
    deployer,
    network,
    SynthereumFixedRateRegistry,
    synthereumFinder.options.address,
    {
      from: keys.deployer,
    },
  );
  const fixedRateRegistryInterface = await web3.utils.stringToHex(
    'FixedRateRegistry',
  );
  const synthereumFixedRateRegistry = await getExistingInstance(
    web3,
    SynthereumFixedRateRegistry,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      fixedRateRegistryInterface,
      synthereumFixedRateRegistry.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumFixedRateRegistry added to SynthereumFinder');
}
