module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumTrustedForwarder',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { SynthereumFinder, SynthereumTrustedForwarder } =
    migrate.getContracts(artifacts);
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
  await deploy(web3, deployer, network, SynthereumTrustedForwarder, {
    from: keys.deployer,
  });
  const trustForwarderInterface = await web3.utils.stringToHex(
    'TrustedForwarder',
  );
  const synthereumTrustedForwarder = await getExistingInstance(
    web3,
    SynthereumTrustedForwarder,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      trustForwarderInterface,
      synthereumTrustedForwarder.options.address,
    )
    .send({ from: maintainer });
  console.log('TrustedForwarder added to SynthereumFinder');
}
