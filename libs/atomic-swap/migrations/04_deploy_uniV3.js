const AtomicSwapProxy = artifacts.require('AtomicSwapProxy');
const UniV3AtomicSwap = artifacts.require('UniV3AtomicSwap');

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
  const proxyInstance = await getExistingInstance(web3, AtomicSwapProxy);

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
};
