module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumChainlinkPriceFeed',
  'MockAggregator',
  'MockRandomAggregator',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const pairs = require('../data/aggregators.json');
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

  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const admin = process.env.FORKCHAINID
    ? accounts[0]
    : rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
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
    return;
  } else if (networkId in randomOracleConfig) {
    const assets = Object.keys(randomOracleConfig[networkId]);
    for (let j = 0; j < assets.length; j++) {
      await deploy(
        web3,
        deployer,
        network,
        MockRandomAggregator,
        web3.utils.toWei(randomOracleConfig[networkId][assets[j]].initialPrice),
        web3.utils.toWei(randomOracleConfig[networkId][assets[j]].maxSpread),
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
        kind: 0,
        asset: assets[j],
        pair: web3.utils.utf8ToHex(assets[j]),
        aggregator: mockRandomAggregator.options.address,
        intermediateIds: [],
      });
    }
  } else {
    const assets = Object.keys(pairs[networkId]);
    assets.map(async asset => {
      aggregatorsData.push({
        kind: pairs[networkId][asset].type,
        asset: asset,
        pair: web3.utils.utf8ToHex(asset),
        aggregator: pairs[networkId][asset].aggregator,
        intermediateIds: pairs[networkId][asset].intermediatePairs,
      });
    });
  }
  for (let j = 0; j < aggregatorsData.length; j++) {
    await synthereumChainlinkPriceFeed.methods
      .setPair(
        aggregatorsData[j].kind,
        aggregatorsData[j].pair,
        aggregatorsData[j].aggregator,
        aggregatorsData[j].intermediateIds,
      )
      .send({ from: maintainer });
    console.log(`   Add '${aggregatorsData[j].asset}' aggregator`);
  }
}
