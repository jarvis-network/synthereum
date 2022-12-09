module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumOnChainLiquidityRouter',
  'OCLRV2UniswapV2',
  'OCLRV2UniswapV3',
  'OCLRV2Kyber',
  'PoolSwap',
  'FixedRateSwap',
]);

const { utf8ToHex } = require('web3-utils');
const atomicSwapData = require('../data/atomic-swap.json');
const {
  getKeysForNetwork,
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');
const {
  getExistingInstance,
} = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');

async function migrate(deployer, network, accounts) {
  const admin = accounts[0];
  const maintainer = accounts[1];
  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const {
    SynthereumOnChainLiquidityRouter,
    SynthereumFinder,
  } = migrate.getContracts(artifacts);
  const networkFile = require(`@jarvis-network/synthereum-contracts/networks/${networkId}.json`);
  let roles = {
    admin,
    maintainer,
  };
  console.log(networkId, network);

  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );

  // deploy proxy
  console.log(atomicSwapData[networkId].deployAtomicSwap);
  atomicSwapData[networkId].deployAtomicSwap
    ? await deploy(
        web3,
        deployer,
        network,
        SynthereumOnChainLiquidityRouter,
        synthereumFinder.options.address,
        roles,
        {
          from: admin,
        },
      )
    : null;

  // get proxy instance
  const atomicSwapInstance = await getExistingInstance(
    web3,
    SynthereumOnChainLiquidityRouter,
  );
  const atomicSwapInterface = await web3.utils.stringToHex('AtomicSwap');
  await synthereumFinder.methods
    .changeImplementationAddress(
      atomicSwapInterface,
      atomicSwapInstance.options.address,
    )
    .send({ from: maintainer });
  console.log('AtomicSwap added to SynthereumFinder');

  // deploy UniV2
  atomicSwapData[networkId].deployUniV2
    ? await deployUniV2(
        web3,
        atomicSwapInstance,
        deployer,
        network,
        networkId,
        admin,
        maintainer,
      )
    : null;

  // deploy UniV3
  atomicSwapData[networkId].deployUniV3
    ? await deployUniV3(
        web3,
        atomicSwapInstance,
        deployer,
        network,
        networkId,
        admin,
        maintainer,
      )
    : null;

  // deploy KyberDMM
  atomicSwapData[networkId].deployKyberDMM
    ? await deployKyberDMM(
        web3,
        atomicSwapInstance,
        deployer,
        network,
        networkId,
        admin,
        maintainer,
      )
    : null;

  atomicSwapData[networkId].deployPoolSwap
    ? await deployPoolSwap(web3, deployer, network, admin, maintainer)
    : null;

  atomicSwapData[networkId].deployFixedRateSwap
    ? await deployFixedRateSwap(web3, deployer, network, admin, maintainer)
    : null;
}

const deployPoolSwap = async (web3, deployer, network, admin, maintainer) => {
  const { PoolSwap, SynthereumFinder } = migrate.getContracts(artifacts);
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  await deploy(
    web3,
    deployer,
    network,
    PoolSwap,
    synthereumFinder.options.address,
    {
      from: admin,
    },
  );
  const poolSwapInstance = await getExistingInstance(web3, PoolSwap);
  const poolSwapInterface = await web3.utils.stringToHex('PoolSwapModule');
  await synthereumFinder.methods
    .changeImplementationAddress(
      poolSwapInterface,
      poolSwapInstance.options.address,
    )
    .send({ from: maintainer });
  console.log('PoolSwap module added to SynthereumFinder');
};

const deployFixedRateSwap = async (
  web3,
  deployer,
  network,
  admin,
  maintainer,
) => {
  const { FixedRateSwap, SynthereumFinder } = migrate.getContracts(artifacts);
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  await deploy(
    web3,
    deployer,
    network,
    FixedRateSwap,
    synthereumFinder.options.address,
    { from: admin },
  );
  const fixedSwapInstance = await getExistingInstance(web3, FixedRateSwap);
  const fixedSwapInterface = await web3.utils.stringToHex(
    'FixedRateSwapModule',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      fixedSwapInterface,
      fixedSwapInstance.options.address,
    )
    .send({ from: maintainer });
  console.log('FixedRateSwap module added to SynthereumFinder');
};

const deployUniV2 = async (
  web3,
  atomicSwapInstance,
  deployer,
  network,
  networkId,
  admin,
  maintainer,
) => {
  const { OCLRV2UniswapV2 } = migrate.getContracts(artifacts);
  await deploy(web3, deployer, network, OCLRV2UniswapV2, { from: admin });
  const uniV2Instance = await getExistingInstance(web3, OCLRV2UniswapV2);

  let UniV2Info = {
    routerAddress: atomicSwapData[networkId].routers.uniV2,
  };

  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address'],
    [UniV2Info.routerAddress],
  );

  await atomicSwapInstance.methods
    .setDexImplementation('uniV2', uniV2Instance.options.address, encodedInfo)
    .send({ from: maintainer });

  console.log('Uniswap v2 implementation registered in the atomic-swap');
};

const deployUniV3 = async (
  web3,
  atomicSwapInstance,
  deployer,
  network,
  networkId,
  admin,
  maintainer,
) => {
  const { OCLRV2UniswapV3 } = migrate.getContracts(artifacts);
  // deploy UniV3 and register implementation
  await deploy(web3, deployer, network, OCLRV2UniswapV3, { from: admin });
  const uniV3Instance = await getExistingInstance(web3, OCLRV2UniswapV3);

  let UniV3Info = {
    routerAddress: atomicSwapData[networkId].routers.uniV3,
  };

  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address'],
    [UniV3Info.routerAddress],
  );

  await atomicSwapInstance.methods
    .setDexImplementation('uniV3', uniV3Instance.options.address, encodedInfo)
    .send({ from: maintainer });

  console.log('Uniswap v3 implementation registered in the atomic-swap');
};

const deployKyberDMM = async (
  web3,
  atomicSwapInstance,
  deployer,
  network,
  networkId,
  admin,
  maintainer,
) => {
  const { OCLRV2Kyber } = migrate.getContracts(artifacts);
  // deploy Kyber and register implementation
  await deploy(web3, deployer, network, OCLRV2Kyber, { from: admin });
  const kyberInstance = await getExistingInstance(web3, OCLRV2Kyber);

  let KyberInfo = {
    routerAddress: atomicSwapData[networkId].routers.kyberDMM,
  };

  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address'],
    [KyberInfo.routerAddress],
  );

  await atomicSwapInstance.methods
    .setDexImplementation(
      'kyberDMM',
      kyberInstance.options.address,
      encodedInfo,
    )
    .send({ from: maintainer });

  console.log('KyberDMM implementation registered in the atomic-swap');
};
