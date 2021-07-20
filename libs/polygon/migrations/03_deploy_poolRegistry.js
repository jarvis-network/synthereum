module.exports = require('../utils/getContractsFactory')(migrate, [
  '@jarvis-network/synthereum-contracts/contracts/core/Finder',
  '@jarvis-network/synthereum-contracts/contracts/core/registries/PoolRegistry',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const { getExistingInstance } = require('../dist/migration-utils/deployment');
  const {
    Finder: SynthereumFinder,
    PoolRegistry: SynthereumPoolRegistry,
  } = migrate.getContracts(artifacts);
  const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = toNetworkId(network);
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumPoolRegistry,
    synthereumFinder.options.address,
    {
      from: keys.deployer,
    },
  );
  const poolRegistryInterface = await web3.utils.stringToHex('PoolRegistry');
  const synthereumPoolRegistry = await getExistingInstance(
    web3,
    SynthereumPoolRegistry,
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      poolRegistryInterface,
      synthereumPoolRegistry.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumPoolRegistry added to SynthereumFinder');
}
