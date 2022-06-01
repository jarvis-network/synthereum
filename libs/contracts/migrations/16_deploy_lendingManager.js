module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'LendingManager',
  'LendingStorageManager',
  'AaveV3Module',
  'UniV2JRTSwapModule',
  'BalancerJRTSwapModule',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumFinder,
    LendingManager,
    LendingStorageManager,
    AaveV3Module,
    UniV2JRTSwapModule,
    BalancerJRTSwapModule,
  } = migrate.getContracts(artifacts);
  const lendingData = require('../data/lending-data.json');
  const {
    getKeysForNetwork,
    deploy,
    isPublicNetwork,
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
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
    deployer,
    network,
    LendingManager,
    synthereumFinder.options.address,
    roles,
    {
      from: keys.deployer,
    },
  );
  const lendingManagerInterface = await web3.utils.stringToHex(
    'LendingManager',
  );
  const lendingManager = await getExistingInstance(
    web3,
    LendingManager,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      lendingManagerInterface,
      lendingManager.options.address,
    )
    .send({ from: maintainer });
  console.log('LendingManager added to SynthereumFinder');
  await deploy(
    web3,
    deployer,
    network,
    LendingStorageManager,
    synthereumFinder.options.address,
    {
      from: keys.deployer,
    },
  );
  const lendingStorageManagerInterface = await web3.utils.stringToHex(
    'LendingStorageManager',
  );
  const lendingStorageManager = await getExistingInstance(
    web3,
    LendingStorageManager,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      lendingStorageManagerInterface,
      lendingStorageManager.options.address,
    )
    .send({ from: maintainer });
  console.log('LendingStoargeManager added to SynthereumFinder');

  if (lendingData[networkId]?.AaveV3?.isEnabled ?? true) {
    await deploy(web3, deployer, network, AaveV3Module, {
      from: keys.deployer,
    });
    const aaveV3Module = await getExistingInstance(
      web3,
      AaveV3Module,
      '@jarvis-network/synthereum-contracts',
    );
    const AaveveInfo = {
      moneyManager: lendingData[networkId].AaveV3.moneyManager,
    };
    const encodedInfo = web3.eth.abi.encodeParameters(
      ['address'],
      [AaveveInfo.moneyManager],
    );
    await lendingManager.methods
      .setLendingModule('AaveV3', {
        lendingModule: aaveV3Module.options.address,
        args: encodedInfo,
      })
      .send({ from: maintainer });
    console.log('AaveV3Module added to LendingManager');
  }

  // JARVIS TOKEN SWAP MODULES
  if (lendingData[networkId]?.SwapModules?.uniV2 ?? false) {
    await deploy(web3, deployer, network, UniV2JRTSwapModule, {
      from: keys.deployer,
    });
    const univ2SwapModule = await getExistingInstance(
      web3,
      UniV2JRTSwapModule,
      '@jarvis-network/synthereum-contracts',
    );
    console.log(
      'UniswapV2 Module deployed at:',
      univ2SwapModule.options.address,
    );
  }
  if (lendingData[networkId]?.SwapModules?.balancer ?? false) {
    await deploy(web3, deployer, network, BalancerJRTSwapModule, {
      from: keys.deployer,
    });
    const balancerModule = await getExistingInstance(
      web3,
      BalancerJRTSwapModule,
      '@jarvis-network/synthereum-contracts',
    );
    console.log('Balancer Module deployed at:', balancerModule.options.address);
  }
}
