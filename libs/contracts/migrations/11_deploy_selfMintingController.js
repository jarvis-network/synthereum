module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'CreditLineController',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { SynthereumFinder, CreditLineController } = migrate.getContracts(
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
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainers: [maintainer] };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
    deployer,
    network,
    CreditLineController,
    synthereumFinder.options.address,
    roles,
    { from: keys.deployer },
  );
  const controllerInterface = await web3.utils.stringToHex(
    'CreditLineController',
  );
  const creditLineController = await getExistingInstance(
    web3,
    CreditLineController,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      controllerInterface,
      creditLineController.options.address,
    )
    .send({ from: maintainer });
  console.log('CreditLineController added to SynthereumFinder');
}