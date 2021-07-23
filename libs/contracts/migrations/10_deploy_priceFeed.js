module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumChainlinkPriceFeed',
  '@chainlink/contracts/src/v0.8/mocks/MockAggregator',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const aggregators = require('../data/aggregators.json');
  const { getExistingInstance } = require('../dist/migration-utils/deployment');
  const {
    SynthereumFinder,
    SynthereumChainlinkPriceFeed,
    MockAggregator,
  } = migrate.getContracts(artifacts);
  const {
    getKeysForNetwork,
    deploy,
    isPublicNetwork,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = await toNetworkId(network);
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
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
  const oracleDeployment = !isPublicNetwork(network);
  if (oracleDeployment) {
    await deploy(web3, deployer, network, MockAggregator, 8, 120000000, {
      from: keys.deployer,
    });
    const mockAggregator = await getExistingInstance(web3, MockAggregator);
    const pair = 'EUR/USD';
    const identifierBytes = web3.utils.utf8ToHex(pair);
    await synthereumChainlinkPriceFeed.methods
      .setAggregator(identifierBytes, mockAggregator.options.address)
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
}
