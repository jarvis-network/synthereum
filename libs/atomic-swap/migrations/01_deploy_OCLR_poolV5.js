const OnChainLiquidityRouter = artifacts.require('OnChainLiquidityRouterV2');
const UniV2AtomicSwap = artifacts.require('OCLRV2UniswapV2');
const UniV3AtomicSwap = artifacts.require('OCLRV2UniswapV3');
const KyberAtomicSwap = artifacts.require('OCLRV2Kyber');
const SynthereumTrustedForwarder = artifacts.require(
  'SynthereumTrustedForwarder',
);
const FixedRateSwap = artifacts.require('FixedRateSwap');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const { utf8ToHex } = require('web3-utils');
const kyberData = require('../data/test/kyber.json');
const uniswapData = require('../data/test/uniswap.json');
const fixedRateData = require('../data/test/fixedRate.json');
const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');
const { getExistingInstance } = require('../src/migration-utils/deployment');

module.exports = async function (deployer, network, accounts) {
  const admin = accounts[0];
  const maintainer = accounts[1];
  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const networkFile = require(`@jarvis-network/synthereum-contracts/networks/${networkId}.json`);
  let FixedRateRoles = {
    admin,
    maintainer,
  };
  console.log(networkId, network);

  const synthereumFinderAddress = networkFile.filter(
    elem => elem.contractName === 'SynthereumFinder',
  )[0].address;

  // deploy proxy

  await deploy(
    web3,
    deployer,
    network,
    OnChainLiquidityRouter,
    FixedRateRoles,
    synthereumFinderAddress,
    {
      from: admin,
    },
  );

  // get proxy instance
  const proxyInstance = await getExistingInstance(web3, OnChainLiquidityRouter);

  // deploy UniV2
  uniswapData[networkId].deployV2
    ? await deployUniV2(
        web3,
        proxyInstance,
        deployer,
        network,
        networkId,
        admin,
        maintainer,
      )
    : null;

  // deploy UniV3
  uniswapData[networkId].deployV3
    ? await deployUniV3(
        web3,
        proxyInstance,
        deployer,
        network,
        networkId,
        admin,
        maintainer,
      )
    : null;

  // deploy KyberDMM
  kyberData[networkId].deploy
    ? await deployKyberDMM(
        web3,
        proxyInstance,
        deployer,
        network,
        networkId,
        admin,
        maintainer,
      )
    : null;

  fixedRateData[networkId].deploy
    ? await deployFixedRateSwap(
        web3,
        proxyInstance,
        deployer,
        network,
        networkId,
        admin,
        maintainer,
      )
    : null;
};

const deployFixedRateSwap = async (
  web3,
  proxyInstance,
  deployer,
  network,
  networkId,
  admin,
  maintainer,
) => {
  await deploy(web3, deployer, network, FixedRateSwap, { from: admin });
  const fixedSwapInstance = await getExistingInstance(web3, FixedRateSwap);
  await proxyInstance.methods
    .registerImplementation(
      'fixedRateSwap',
      fixedSwapInstance.options.address,
      '0x00',
    )
    .send({ from: maintainer });
  // const finderInstance = await SynthereumFinder.at(synthereumFinderAddress);
  // await finderInstance.changeImplementationAddress(utf8ToHex('FixedRateSwap'), contract.contract.address, {from:maintainer});
};

const deployUniV2 = async (
  web3,
  proxyInstance,
  deployer,
  network,
  networkId,
  admin,
  maintainer,
) => {
  await deploy(web3, deployer, network, UniV2AtomicSwap, { from: admin });
  const uniV2Instance = await getExistingInstance(web3, UniV2AtomicSwap);

  let UniV2Info = {
    routerAddress: uniswapData[networkId].router,
  };

  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address'],
    [UniV2Info.routerAddress],
  );

  await proxyInstance.methods
    .registerImplementation('uniV2', uniV2Instance.options.address, encodedInfo)
    .send({ from: maintainer });

  console.log('Uniswap v2 implementation registered in proxy');
};

const deployUniV3 = async (
  web3,
  proxyInstance,
  deployer,
  network,
  networkId,
  admin,
  maintainer,
) => {
  // deploy UniV3 and register implementation
  await deploy(web3, deployer, network, UniV3AtomicSwap, { from: admin });
  const uniV3Instance = await getExistingInstance(web3, UniV3AtomicSwap);

  let UniV3Info = {
    routerAddress: uniswapData[networkId].routerV3,
  };

  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address'],
    [UniV3Info.routerAddress],
  );

  await proxyInstance.methods
    .registerImplementation('uniV3', uniV3Instance.options.address, encodedInfo)
    .send({ from: maintainer });

  console.log('Uniswap v3 implementation registered in proxy');
};

const deployKyberDMM = async (
  web3,
  proxyInstance,
  deployer,
  network,
  networkId,
  admin,
  maintainer,
) => {
  // deploy Kyber and register implementation
  await deploy(web3, deployer, network, KyberAtomicSwap, { from: admin });
  const kyberInstance = await getExistingInstance(web3, KyberAtomicSwap);

  let KyberInfo = {
    routerAddress: kyberData[networkId].DMMRouter,
  };

  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address'],
    [KyberInfo.routerAddress],
  );

  await proxyInstance.methods
    .registerImplementation(
      'kyberDMM',
      kyberInstance.options.address,
      encodedInfo,
    )
    .send({ from: maintainer });

  console.log('KyberDMM implementation registered in proxy');
};
