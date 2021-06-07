module.exports = require('../utils/getContractsFactory')(migrate, [
  'AtomicSwap',
]);

async function migrate(deployer, network, accounts) {
  const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
  const keys = getKeysForNetwork(network, accounts);
  const { AtomicSwap } = migrate.getContracts(artifacts);
  await deploy(
    deployer,
    network,
    AtomicSwap,
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    {
      from: keys.deployer,
    },
  );
}
