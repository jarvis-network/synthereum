module.exports = require('../utils/getContractsFactory')(migrate, [
  'JrtToJarvisConverter',
  'JarvisToken',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { JrtToJarvisConverter, JarvisToken } = migrate.getContracts(artifacts);
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
  const jarvisToken =
    data.jarvisAddress ??
    (
      await getExistingInstance(
        web3,
        JarvisToken,
        '@jarvis-network/synthereum-contracts',
      )
    ).options.address;

  await deploy(
    web3,
    deployer,
    network,
    JrtToJarvisConverter,
    data.jrtAddress,
    jarvisToken,
    data.ratio,
    roles,
    { from: keys.deployer },
  );

  // set activation block
  const migratorInstance = await getExistingInstance(
    web3,
    JrtToJarvisConverter,
    '@jarvis-network/synthereum-contracts',
  );

  console.log(
    'Coverter contract deployed at',
    migratorInstance.options.address,
  );
}
