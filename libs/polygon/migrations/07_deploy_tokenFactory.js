module.exports = require('../utils/getContractsFactory')(migrate, [
  '@jarvis-network/synthereum-contracts/contracts/core/Finder',
  '@jarvis-network/synthereum-contracts/contracts/derivative/common/SyntheticTokenFactory',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const { getExistingInstance } = require('../dist/migration-utils/deployment');
  const {
    Finder: SynthereumFinder,
    SyntheticTokenFactory: SynthereumSyntheticTokenFactory,
  } = migrate.getContracts(artifacts);
  const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = toNetworkId(network);
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumSyntheticTokenFactory,
    synthereumFinder.options.address,
    { from: keys.deployer },
  );
  const tokenFactoryInterface = await web3.utils.stringToHex('TokenFactory');
  const tokenFactory = await getExistingInstance(
    web3,
    SynthereumSyntheticTokenFactory,
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      tokenFactoryInterface,
      tokenFactory.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumSyntheticTokenFactory added to SynthereumFinder');
}
