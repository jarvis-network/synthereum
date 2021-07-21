module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SelfMintingController',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const { getExistingInstance } = require('../dist/migration-utils/deployment');
  const { SynthereumFinder, SelfMintingController } = migrate.getContracts(
    artifacts,
  );
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
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
    web3,
    deployer,
    network,
    SelfMintingController,
    synthereumFinder.options.address,
    roles,
    { from: keys.deployer },
  );
  const controllerInterface = await web3.utils.stringToHex(
    'SelfMintingController',
  );
  const selfMintingController = await getExistingInstance(
    web3,
    SelfMintingController,
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      controllerInterface,
      selfMintingController.options.address,
    )
    .send({ from: maintainer });
  console.log('SelfMintingController added to SynthereumFinder');
}
