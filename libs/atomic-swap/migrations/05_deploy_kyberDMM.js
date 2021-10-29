const OnChainLiquidityRouter = artifacts.require('OnChainLiquidityRouter');
const KyberAtomicSwap = artifacts.require('OCLRKyber');

const kyberData = require('../data/test/kyber.json');
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
};
