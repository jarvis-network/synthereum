const AtomicSwapProxy = artifacts.require('AtomicSwapProxy');

const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const admin = accounts[0];
  const maintainer = accounts[1];
  const networkId = toNetworkId(network);
  const networkFile = require(`@jarvis-network/synthereum-contracts/networks/${networkId}.json`);

  let FixedRateRoles = {
    admin,
    maintainers: [maintainer],
  };

  const synthereumFinderAddress = networkFile.filter(
    elem => elem.contractName === 'SynthereumFinder',
  )[0].address;

  // deploy proxy
  await deploy(
    web3,
    deployer,
    network,
    AtomicSwapProxy,
    FixedRateRoles,
    synthereumFinderAddress,
    {
      from: admin,
    },
  );
};
