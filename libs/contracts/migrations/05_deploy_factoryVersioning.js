module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumFactoryVersioning',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('../dist/migration-utils/deployment');
  const {
    SynthereumFactoryVersioning,
    SynthereumFinder,
  } = migrate.getContracts(artifacts);
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
  await deploy(deployer, network, SynthereumFactoryVersioning, roles, {
    from: keys.deployer,
  });
  const factoryVersioningInterface = await web3.utils.stringToHex(
    'FactoryVersioning',
  );
  const synthereumFactoryVersioning = await getExistingInstance(
    web3,
    SynthereumFactoryVersioning,
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      factoryVersioningInterface,
      synthereumFactoryVersioning.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumFactoryVersioning added to SynthereumFinder');
}
