const config = require('../truffle-config.js');
const rolesConfig = require('../data/roles.json');
const aggregators = require('../data/aggregators.json');
const { getDeploymentInstance } = require('../utils/deployment.js');
var SynthereumFinder = artifacts.require('SynthereumFinder');
var SynthereumInterfaces = artifacts.require('SynthereumInterfaces');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const MockV3Aggregator = artifacts.require('MockV3Aggregator');

module.exports = async function (deployer, network, accounts) {
  const networkId = await web3.eth.net.getId();
  const {
    contractInstance: synthereumFinderInstance,
    isDeployed,
  } = await getDeploymentInstance(
    SynthereumFinder,
    'SynthereumFinder',
    networkId,
  );
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumChainlinkPriceFeed,
    isDeployed
      ? synthereumFinderInstance.address
      : synthereumFinderInstance.options.address,
    roles,
    {
      from: keys.deployer,
    },
  );
  const priceFeedInterface = await web3.utils.stringToHex('PriceFeed');
  const synthereumChainlinkPriceFeedInstance = await SynthereumChainlinkPriceFeed.deployed();
  isDeployed
    ? await synthereumFinderInstance.changeImplementationAddress(
        priceFeedInterface,
        synthereumChainlinkPriceFeedInstance.address,
        { from: maintainer },
      )
    : await synthereumFinderInstance.methods
        .changeImplementationAddress(
          priceFeedInterface,
          synthereumChainlinkPriceFeedInstance.address,
        )
        .send({ from: maintainer });
  console.log('SynthereumChainlinkPriceFeed added to SynthereumFinder');
  const oracleDeployment =
    networkId != 1 && networkId != 3 && networkId != 4 && networkId != 42;
  if (oracleDeployment) {
    await deploy(deployer, network, MockV3Aggregator, 8, 120000000, {
      from: keys.deployer,
    });
    const mockV3AggregatorInstance = await MockV3Aggregator.deployed();
    const pair = 'EUR/USD';
    const identifierBytes = web3.utils.utf8ToHex(pair);
    await synthereumChainlinkPriceFeedInstance.setAggregator(
      identifierBytes,
      mockV3AggregatorInstance.address,
      { from: maintainer },
    );
    console.log(`   Add '${pair}' aggregator`);
  } else {
    let aggregatorsData = [];
    Object.keys(aggregators[networkId]).map(async asset => {
      aggregatorsData.push({
        asset: asset,
        pair: web3.utils.utf8ToHex(asset),
        aggregator: aggregators[networkId][asset],
      });
    });
    for (let j = 0; j < aggregatorsData.length; j++) {
      await synthereumChainlinkPriceFeedInstance.setAggregator(
        aggregatorsData[j].pair,
        aggregatorsData[j].aggregator,
        { from: maintainer },
      );
      console.log(`   Add '${aggregatorsData[j].asset}' aggregator`);
    }
  }
};
