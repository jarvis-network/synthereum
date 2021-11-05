const AtomicSwap = artifacts.require('AtomicSwap');

const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const networkFile = require(`@jarvis-network/synthereum-contracts/networks/${networkId}.json`);
  const synthereumFinderAddress = networkFile.filter(
    elem => elem.contractName === 'SynthereumFinder',
  )[0].address;
  const uniswapRouterV2 = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  await deploy(
    web3,
    deployer,
    network,
    AtomicSwap,
    synthereumFinderAddress,
    uniswapRouterV2,
    {
      from: accounts[0],
    },
  );
};
