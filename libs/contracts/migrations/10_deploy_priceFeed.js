module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumChainlinkPriceFeed',
  'MockAggregator',
  'MockRandomAggregator',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const aggregators = require('../data/aggregators.json');
  const randomOracleConfig = require('../data/test/randomAggregator.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumFinder,
    SynthereumChainlinkPriceFeed,
    MockAggregator,
    MockRandomAggregator,
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
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
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
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      priceFeedInterface,
      synthereumChainlinkPriceFeed.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumChainlinkPriceFeed added to SynthereumFinder');
  var aggregatorsData = [];
  if (!isPublicNetwork(network)) {
    await deploy(web3, deployer, network, MockAggregator, 8, 120000000, {
      from: keys.deployer,
    });
    const mockAggregator = await getExistingInstance(
      web3,
      MockAggregator,
      '@jarvis-network/synthereum-contracts',
    );
    const pair = 'EUR/USD';
    const identifierBytes = web3.utils.utf8ToHex(pair);
    await synthereumChainlinkPriceFeed.methods
      .setAggregator(identifierBytes, mockAggregator.options.address)
      .send({ from: maintainer });
    console.log(`   Add '${pair}' aggregator`);
  } else if (networkId === 80001) {
    const assets = Object.keys(aggregators[networkId]);
    for (let j = 0; j < assets.length; j++) {
      await deploy(
        web3,
        deployer,
        network,
        MockRandomAggregator,
        web3.utils.toWei(randomOracleConfig[80001][assets[j]].initialPrice),
        web3.utils.toWei(randomOracleConfig[80001][assets[j]].maxSpread),
        {
          from: maintainer,
        },
      );

      const mockRandomAggregator = await getExistingInstance(
        web3,
        MockRandomAggregator,
        '@jarvis-network/synthereum-contracts',
      );

      aggregatorsData.push({
        asset: assets[j],
        pair: web3.utils.utf8ToHex(assets[j]),
        aggregator: mockRandomAggregator.options.address,
      });
    }
  } else {
    const assets = Object.keys(aggregators[networkId]);
    assets.map(async asset => {
      aggregatorsData.push({
        asset: asset,
        pair: web3.utils.utf8ToHex(asset),
        aggregator: aggregators[networkId][asset],
      });
    });
  }
  for (let j = 0; j < aggregatorsData.length; j++) {
    await synthereumChainlinkPriceFeed.methods
      .setAggregator(aggregatorsData[j].pair, aggregatorsData[j].aggregator)
      .send({ from: maintainer });
    console.log(`   Add '${aggregatorsData[j].asset}' aggregator`);
  }
}
