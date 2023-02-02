module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'DebtTokenFactory',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { SynthereumFinder, DebtTokenFactory } = migrate.getContracts(
    artifacts,
  );
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
  const admin = process.env.FORKCHAINID
    ? accounts[0]
    : rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
    deployer,
    network,
    DebtTokenFactory,
    {
      admin: admin,
      maintainer: maintainer,
    },
    {
      from: keys.deployer,
    },
  );
  const debtTokenFactory = await getExistingInstance(
    web3,
    DebtTokenFactory,
    '@jarvis-network/synthereum-contracts',
  );

  const debtTokenFactoryInterface = await web3.utils.stringToHex(
    'DebtTokenFactory',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      debtTokenFactoryInterface,
      debtTokenFactory.options.address,
    )
    .send({ from: maintainer });
  console.log('Debt-token Factory added to SynthereumFinder');
}
