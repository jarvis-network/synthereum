const AtomicSwapProxy = artifacts.require('AtomicSwapProxy');
const UniV2AtomicSwap = artifacts.require('UniV2AtomicSwap');

const uniswapData = require('../data/test/uniswap.json');
const tokens = require('../data/test/tokens.json');

const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

const { getExistingInstance } = require('../src/migration-utils/deployment');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  const admin = accounts[0];
  const networkFile = require(`@jarvis-network/synthereum-contracts/networks/${networkId}.json`);

  const synthereumFinderAddress = networkFile.filter(
    elem => elem.contractName === 'SynthereumFinder',
  )[0].address;

  // get proxy instance
  const proxyInstance = await getExistingInstance(web3, AtomicSwapProxy);

  // deploy UniV2 and register implementation
  await deploy(web3, deployer, network, UniV2AtomicSwap, { from: admin });
  const uniV2Instance = await getExistingInstance(web3, UniV2AtomicSwap);

  let UniV2Info = {
    routerAddress: uniswapData[networkId].router,
    synthereumFinder: synthereumFinderAddress,
    nativeCryptoAddress: tokens[networkId].WETH,
  };

  let tx = await proxyInstance.methods
    .registerImplementation('uniV2', uniV2Instance.options.address, UniV2Info)
    .send({ from: admin });
};
