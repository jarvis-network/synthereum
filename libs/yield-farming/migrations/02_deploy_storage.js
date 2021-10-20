const AerariumSanctius = artifacts.require('AerariumSanctius');
const ElysianFields = artifacts.require('ElysianFields');
const {
  getExistingInstance,
} = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');

const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');
const storageData = require('../data/storage.json');

module.exports = async function (deployer, network, accounts) {
  const networkId = toNetworkId(network);
  const storage = storageData[networkId];
  const ElysianFieldsInstance = await getExistingInstance(
    web3,
    ElysianFields,
    '@jarvis-network/yield-farming',
  );
  const instance = await deploy(
    web3,
    deployer,
    network,
    AerariumSanctius,
    ElysianFieldsInstance.options.address,
    storage.owner,
    storage.withdrawBlockTimeout,
    {
      from: accounts[0],
    },
  );
};
