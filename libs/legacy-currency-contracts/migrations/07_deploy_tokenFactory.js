module.exports = require('../../contracts/utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumSyntheticTokenFactory',
  'SynthereumSyntheticTokenPermitFactory',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../../contracts/data/roles.json');
  const { getExistingInstance } = require('../src/migration-utils/deployment');
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
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const keys = getKeysForNetwork(network, accounts);
  let tokenFactory;
  if (!isPublicNetwork(network) || networkId == 80001 || networkId === 137) {
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
