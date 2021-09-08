const AtomicSwapProxy = artifacts.require('AtomicSwapProxy');

const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

module.exports = async function (deployer, network, accounts) {
  const admin = accounts[0];

  // deploy proxy
  await deploy(web3, deployer, network, AtomicSwapProxy, admin, {
    from: admin,
  });
};