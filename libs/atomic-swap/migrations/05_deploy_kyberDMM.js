const AtomicSwapProxy = artifacts.require('AtomicSwapProxy');
const KyberAtomicSwap = artifacts.require('KyberAtomicSwap');

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
  const networkFile = require(`@jarvis-network/synthereum-contracts/networks/${networkId}.json`);

  const synthereumFinderAddress = networkFile.filter(
    elem => elem.contractName === 'SynthereumFinder',
  )[0].address;

  // get proxy instance
  const proxyInstance = await getExistingInstance(web3, AtomicSwapProxy);

  // deploy Kyber and register implementation
  await deploy(web3, deployer, network, KyberAtomicSwap, { from: admin });
  const kyberInstance = await getExistingInstance(web3, KyberAtomicSwap);

  let KyberInfo = {
    routerAddress: kyberData[networkId].DMMRouter,
    synthereumFinder: synthereumFinderAddress,
    nativeCryptoAddress: tokens[networkId].WETH,
  };

  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address', 'address', 'address'],
    [
      KyberInfo.routerAddress,
      KyberInfo.synthereumFinder,
      KyberInfo.nativeCryptoAddress,
    ],
  );

  await proxyInstance.methods
    .registerImplementation(
      'kyberDMM',
      kyberInstance.options.address,
      encodedInfo,
    )
    .send({ from: maintainer });
};
