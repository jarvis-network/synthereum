module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'MinimalForwarder',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { SynthereumFinder, MinimalForwarder } = migrate.getContracts(
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
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  await deploy(web3, deployer, network, MinimalForwarder, {
    from: keys.deployer,
  });
  const trustForwarderInterface = await web3.utils.stringToHex(
    'TrustedForwarder',
  );
  const synthereumMinimalForwarder = await getExistingInstance(
    web3,
    MinimalForwarder,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      trustForwarderInterface,
      synthereumMinimalForwarder.options.address,
    )
    .send({ from: maintainer });
  console.log('Minimal forwarder added to SynthereumFinder');
}
