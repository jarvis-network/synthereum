module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
]);
async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const { SynthereumFinder } = migrate.getContracts(artifacts);
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = toNetworkId(network);
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(web3, deployer, network, SynthereumFinder, roles, {
    from: keys.deployer,
  });
}
