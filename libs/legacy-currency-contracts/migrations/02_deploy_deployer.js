module.exports = require('../../contracts/utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumDeployer',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../../contracts/data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { SynthereumFinder, SynthereumDeployer } = migrate.getContracts(
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
    '@jarvis-network/legacy-currency-contracts',
  );
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
    deployer,
    network,
    SynthereumDeployer,
    synthereumFinder.options.address,
    roles,
    { from: keys.deployer },
  );
  const deployerInterface = await web3.utils.stringToHex('Deployer');
  const synthereumDeployer = await getExistingInstance(
    web3,
    SynthereumDeployer,
    '@jarvis-network/legacy-currency-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      deployerInterface,
      synthereumDeployer.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumDeployer added to SynthereumFinder');
}
