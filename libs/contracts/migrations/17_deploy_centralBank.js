module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'JarvisBrrrrr',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { SynthereumFinder, JarvisBrrrrr } = migrate.getContracts(artifacts);
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
  const admin = process.env.FORKCHAINID
    ? accounts[0]
    : rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  const moneyMarketManager = process.env.FORKCHAINID
    ? accounts[2]
    : rolesConfig[networkId]?.moneyMarketManager ?? accounts[2];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
    deployer,
    network,
    JarvisBrrrrr,
    synthereumFinder.options.address,
    roles,
    { from: keys.deployer },
  );

  const jarvisBrrrrrInterface = await web3.utils.stringToHex('JarvisBrrrrr');
  const jarvisBrrrrr = await getExistingInstance(
    web3,
    JarvisBrrrrr,
    '@jarvis-network/synthereum-contracts',
  );
  const moneyMarketMangagerInterface = await web3.utils.stringToHex(
    'MoneyMarketManager',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      jarvisBrrrrrInterface,
      jarvisBrrrrr.options.address,
    )
    .send({ from: maintainer });
  console.log('JarvisBrrrrr added to SynthereumFinder');

  await synthereumFinder.methods
    .changeImplementationAddress(
      moneyMarketMangagerInterface,
      moneyMarketManager,
    )
    .send({ from: maintainer });
  console.log('MoneyMarketManager added to SynthereumFinder');
}
