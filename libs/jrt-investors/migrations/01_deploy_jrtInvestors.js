const AerariumMilitare = artifacts.require('AerariumMilitare');

const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');
const jrtInvestorsData = require('../data/jrt-investors.json');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  const jrtInvestors = jrtInvestorsData[networkId];
  const instance = await deploy(
    web3,
    deployer,
    network,
    AerariumMilitare,
    jrtInvestors.token,
    jrtInvestors.startTime,
    jrtInvestors.endTime,
    {
      from: accounts[0],
    },
  );
};
