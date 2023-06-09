module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumPublicVaultRegistry',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { SynthereumFinder, SynthereumPublicVaultRegistry } =
    migrate.getContracts(artifacts);
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
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
    deployer,
    network,
    SynthereumPublicVaultRegistry,
    synthereumFinder.options.address,
    {
      from: keys.deployer,
    },
  );
  const publicVaultRegistryInterface = await web3.utils.stringToHex(
    'VaultRegistry',
  );
  const publicVaultRegistry = await getExistingInstance(
    web3,
    SynthereumPublicVaultRegistry,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      publicVaultRegistryInterface,
      publicVaultRegistry.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumPublicVaultRegistry added to SynthereumFinder');
}
