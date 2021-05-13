module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumManager',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('../dist/migration-utils/deployment');
  const { SynthereumManager, SynthereumFinder } = migrate.getContracts(
    artifacts,
  );
  const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = toNetworkId(network);
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumManager,
    synthereumFinder.options.address,
    roles,
    { from: keys.deployer },
  );
  const managerInterface = await web3.utils.stringToHex('Manager');
  const synthereumManager = await getExistingInstance(web3, SynthereumManager);
  await synthereumFinder.methods
    .changeImplementationAddress(
      managerInterface,
      synthereumManager.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumManager added to SynthereumFinder');
}
