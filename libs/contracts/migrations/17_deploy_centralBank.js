module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'JarvisBrrrrr',
  'MoneyMarketManager',
  'JarvisBrrAave',
  'JarvisBrrCompound',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumFinder,
    JarvisBrrrrr,
    MoneyMarketManager,
    JarvisBrrAave,
    JarvisBrrCompound,
  } = migrate.getContracts(artifacts);
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');
  const deployData = require('../data/centralBank.json');

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
  // const moneyMarketManager = process.env.FORKCHAINID
  //   ? accounts[2]
  //   : rolesConfig[networkId]?.moneyMarketManager ?? accounts[2];
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

  // deploy money market manager
  await deploy(
    web3,
    deployer,
    network,
    MoneyMarketManager,
    synthereumFinder.options.address,
    roles,
    { from: keys.deployer },
  );
  const moneyMarketManager = await getExistingInstance(
    web3,
    MoneyMarketManager,
    '@jarvis-network/synthereum-contracts',
  );

  // deploy modules according to json file
  if (deployData[networkId]?.aave?.deploy ?? false) {
    await deploy(web3, deployer, network, JarvisBrrAave, {
      from: keys.deployer,
    });

    const implementation = await getExistingInstance(
      web3,
      JarvisBrrAave,
      '@jarvis-network/synthereum-contracts',
    );

    // register implementation
    let extraArgs = deployData[networkId].aave.extraArgs;
    await moneyMarketManager.methods
      .registerMoneyMarketImplementation(
        'aave',
        implementation.options.address,
        extraArgs,
      )
      .send({ from: maintainer });

    console.log(
      `Aave Implementation ${implementation.options.address} registered to money market manager`,
    );
  }

  if (deployData[networkId]?.marketxyz?.deploy ?? false) {
    await deploy(web3, deployer, network, JarvisBrrCompound, {
      from: keys.deployer,
    });

    const implementation = await getExistingInstance(
      web3,
      JarvisBrrCompound,
      '@jarvis-network/synthereum-contracts',
    );

    // register implementation
    let extraArgs = deployData[networkId].marketxyz.extraArgs;
    await moneyMarketManager.methods
      .registerMoneyMarketImplementation(
        'marketxyz',
        implementation.options.address,
        extraArgs,
      )
      .send({ from: maintainer });

    console.log(
      `MarketXyz Implementation ${implementation.options.address} registered to money market manager`,
    );
  }

  if (deployData[networkId]?.midas?.deploy ?? false) {
    await deploy(web3, deployer, network, JarvisBrrCompound, {
      from: keys.deployer,
    });

    const implementation = await getExistingInstance(
      web3,
      JarvisBrrCompound,
      '@jarvis-network/synthereum-contracts',
    );

    // register implementation
    let extraArgs = deployData[networkId].midas.extraArgs;
    await moneyMarketManager.methods
      .registerMoneyMarketImplementation(
        'midas',
        implementation.options.address,
        extraArgs,
      )
      .send({ from: maintainer });

    console.log(
      `Midas Implementation ${implementation.options.address} registered to money market manager`,
    );
  }

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
      moneyMarketManager.options.address,
    )
    .send({ from: maintainer });
  console.log('MoneyMarketManager added to SynthereumFinder');
}
