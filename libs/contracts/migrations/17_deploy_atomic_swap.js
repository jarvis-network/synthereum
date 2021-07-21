module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'AtomicSwap',
]);

async function migrate(deployer, network, accounts) {
  const { getExistingInstance } = require('../dist/migration-utils/deployment');
  const { SynthereumFinder, AtomicSwap } = migrate.getContracts(artifacts);
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
    deployer,
    network,
    AtomicSwap,
    synthereumFinder.options.address,
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    {
      from: keys.deployer,
    },
  );
}
