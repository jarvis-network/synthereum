module.exports = require('../utils/getContractsFactory')(migrate, [
  'JrtToJarvisMigrator',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { JrtToJarvisMigrator } = migrate.getContracts(artifacts);
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');
  let data = require('../data/jrtMigration.json');

  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const admin = process.env.FORKCHAINID
    ? accounts[0]
    : rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];

  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);

  data = data[networkId];
  await deploy(
    web3,
    deployer,
    network,
    JrtToJarvisMigrator,
    data.jrtAddress,
    data.jarvisAddress,
    data.ratio,
    roles,
    { from: keys.deployer },
  );

  // set activation block
  const migratorInstance = await getExistingInstance(
    web3,
    JrtToJarvisMigrator,
    '@jarvis-network/synthereum-contracts',
  );

  await migratorInstance.methods
    .setActivationBlock(data.activationBlock)
    .send({ from: roles.maintainer });

  console.log(
    'Migrator contract deployed at',
    migratorInstance.options.address,
  );
  console.log('Migration will be activated at block', data.activationBlock);
}

module.exports = migrate;
