const OnChainLiquidityRouter = artifacts.require('OnChainLiquidityRouter');
const UniV2AtomicSwap = artifacts.require('OCLRUniswapV2');

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
  const maintainer = accounts[1];

  // get proxy instance
  const proxyInstance = await getExistingInstance(web3, OnChainLiquidityRouter);

  // deploy UniV2 and register implementation
  await deploy(web3, deployer, network, UniV2AtomicSwap, { from: admin });
  const uniV2Instance = await getExistingInstance(web3, UniV2AtomicSwap);

  let UniV2Info = {
    routerAddress: uniswapData[networkId].router,
  };

  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address'],
    [UniV2Info.routerAddress],
  );

  let tx = await proxyInstance.methods
    .registerImplementation('uniV2', uniV2Instance.options.address, encodedInfo)
    .send({ from: maintainer });
};
