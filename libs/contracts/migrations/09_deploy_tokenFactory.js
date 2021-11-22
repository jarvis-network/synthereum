module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumSyntheticTokenFactory',
  'SynthereumSyntheticTokenPermitFactory',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumFinder,
    SynthereumSyntheticTokenFactory,
    SynthereumSyntheticTokenPermitFactory,
  } = migrate.getContracts(artifacts);
  const {
    isPublicNetwork,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = toNetworkId(network);
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const keys = getKeysForNetwork(network, accounts);
  let tokenFactory;
  if (
    !isPublicNetwork(network) ||
    networkId === 3 ||
    networkId === 56 ||
    networkId === 97 ||
    networkId === 137 ||
    networkId == 80001
  ) {
    await deploy(
      web3,
      deployer,
      network,
      SynthereumSyntheticTokenPermitFactory,
      synthereumFinder.options.address,
      { from: keys.deployer },
    );
    tokenFactory = await getExistingInstance(
      web3,
      SynthereumSyntheticTokenPermitFactory,
      '@jarvis-network/synthereum-contracts',
    );
  } else {
    await deploy(
      web3,
      deployer,
      network,
      SynthereumSyntheticTokenFactory,
      synthereumFinder.options.address,
      { from: keys.deployer },
    );
    tokenFactory = await getExistingInstance(
      web3,
      SynthereumSyntheticTokenFactory,
      '@jarvis-network/synthereum-contracts',
    );
  }
  const tokenFactoryInterface = await web3.utils.stringToHex('TokenFactory');
  await synthereumFinder.methods
    .changeImplementationAddress(
      tokenFactoryInterface,
      tokenFactory.options.address,
    )
    .send({ from: maintainer });
  console.log('Token Factory added to SynthereumFinder');
}
