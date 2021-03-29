const rolesConfig = require('../data/roles.json');
const aggregators = require('../data/aggregators.json');
const {
  getExistingInstance,
} = require('../dist/src/migration-utils/deployment');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumInterfaces = artifacts.require('SynthereumInterfaces');
const { getKeysForNetwork, deploy } = require('@jarvis-network/uma-common');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const MockV3Aggregator = artifacts.require('MockV3Aggregator');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = await toNetworkId(network);
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    deployer,
    network,
    SynthereumChainlinkPriceFeed,
    synthereumFinder.options.address,
    roles,
    {
      from: keys.deployer,
    },
  );
  const priceFeedInterface = await web3.utils.stringToHex('PriceFeed');
  const synthereumChainlinkPriceFeed = await getExistingInstance(
    web3,
    SynthereumChainlinkPriceFeed,
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      priceFeedInterface,
      synthereumChainlinkPriceFeed.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumChainlinkPriceFeed added to SynthereumFinder');
  const oracleDeployment =
    networkId != 1 && networkId != 3 && networkId != 4 && networkId != 42;
  if (oracleDeployment) {
    await deploy(deployer, network, MockV3Aggregator, 8, 120000000, {
      from: keys.deployer,
    });
    const mockV3Aggregator = await getExistingInstance(web3, MockV3Aggregator);
    const pair = 'EUR/USD';
    const identifierBytes = web3.utils.utf8ToHex(pair);
    await synthereumChainlinkPriceFeed.methods
      .setAggregator(identifierBytes, mockV3Aggregator.options.address)
      .send({ from: maintainer });
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
      await synthereumChainlinkPriceFeed.methods
        .setAggregator(aggregatorsData[j].pair, aggregatorsData[j].aggregator)
        .send({ from: maintainer });
      console.log(`   Add '${aggregatorsData[j].asset}' aggregator`);
    }
  }
};
