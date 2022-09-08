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
      rewardsController: lendingData[networkId].AaveV3.rewardsController,
    };
    const encodedInfo = web3.eth.abi.encodeParameters(
      ['address', 'address'],
      [AaveveInfo.moneyManager, AaveveInfo.rewardsController],
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
    await lendingManager.methods
      .addSwapProtocol(univ2SwapModule.options.address)
      .send({ from: maintainer });
    await lendingManager.methods
      .setSwapModule(
        lendingData[networkId].SwapModules.collateral,
        univ2SwapModule.options.address,
      )
      .send({ from: maintainer });
    console.log('UniswapV2 swap module added to LendingManager');
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
    await lendingManager.methods
      .addSwapProtocol(balancerModule.options.address)
      .send({ from: maintainer });
    await lendingManager.methods
      .setSwapModule(
        lendingData[networkId].SwapModules.collateral,
        balancerModule.options.address,
      )
      .send({ from: maintainer });
    console.log('Balancer swap module added to LendingManager');
  }
  const commissionReceiver = await web3.utils.stringToHex('CommissionReceiver');
  await synthereumFinder.methods
    .changeImplementationAddress(
      commissionReceiver,
      lendingData[networkId].commissionReceiver,
    )
    .send({ from: maintainer });
  console.log('CommissionReceiver added to SynthereumFinder');
  const buybackProgramReceiver = await web3.utils.stringToHex(
    'BuybackProgramReceiver',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      buybackProgramReceiver,
      lendingData[networkId].buybackProgramReceiver,
    )
    .send({ from: maintainer });
  console.log('BuybackProgramReceiver added to SynthereumFinder');
  const lendingRewardsReceiver = await web3.utils.stringToHex(
    'LendingRewardsReceiver',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      lendingRewardsReceiver,
      lendingData[networkId].lendingRewardsReceiver,
    )
    .send({ from: maintainer });
  console.log('LendingRewardsReceiver added to SynthereumFinder');
}
