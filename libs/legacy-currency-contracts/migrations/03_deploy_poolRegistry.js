module.exports = require('../../contracts/utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumPoolRegistry',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../../contracts/data/roles.json');
  const { getExistingInstance } = require('../src/migration-utils/deployment');
  const { SynthereumFinder, SynthereumPoolRegistry } = migrate.getContracts(
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
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
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
