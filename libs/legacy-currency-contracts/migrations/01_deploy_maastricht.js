const Maastricht = artifacts.require('Maastricht');

const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');
const tokens = require('../data/tokens.json');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  const owner = accounts[0];
  const token = tokens[networkId];
  const instance = await deploy(web3, deployer, network, Maastricht, token, {
    from: owner,
  });
};
