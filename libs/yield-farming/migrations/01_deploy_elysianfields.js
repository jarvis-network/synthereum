const ElysianFields = artifacts.require('ElysianFields');

const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');
const yieldFarmingData = require('../data/yield-farming.json');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  const yieldFarming = yieldFarmingData[networkId];
  const instance = await deploy(
    web3,
    deployer,
    network,
    ElysianFields,
    yieldFarming.owner,
    yieldFarming.name,
    yieldFarming.symbol,
    yieldFarming.cap,
    yieldFarming.amountForPool,
    yieldFarming.rewardReceiver,
    {
      from: accounts[0],
    },
  );
};
