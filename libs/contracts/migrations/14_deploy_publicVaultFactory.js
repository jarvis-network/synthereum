module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumMultiLPVaultFactory',
  'Vault',
  'SynthereumFinder',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumMultiLPVaultFactory,
    Vault,
    SynthereumFinder,
  } = migrate.getContracts(artifacts);
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
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );

  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];

  const keys = getKeysForNetwork(network, accounts);

  // deploy vault implementation
  await deploy(web3, deployer, network, Vault, {
    from: keys.deployer,
  });

  const vaultImpl = await getExistingInstance(
    web3,
    Vault,
    '@jarvis-network/synthereum-contracts',
  );

  // deploy factory
  await deploy(
    web3,
    deployer,
    network,
    SynthereumMultiLPVaultFactory,
    vaultImpl.options.address,
    synthereumFinder.options.address,
    { from: keys.deployer },
  );

  const factory = await getExistingInstance(
    web3,
    SynthereumMultiLPVaultFactory,
    '@jarvis-network/synthereum-contracts',
  );

  // register factory in finder
  await synthereumFinder.methods
    .changeImplementationAddress(
      web3.utils.stringToHex('VaultFactory'),
      factory.options.address,
    )
    .send({ from: maintainer });
  console.log('Public vault factory added to SynthereumFinder');
}
