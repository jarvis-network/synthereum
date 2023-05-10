module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumChainlinkPriceFeed',
  'MockAggregator',
  'MockRandomAggregator',
  'SynthereumPriceFeed',
  'SynthereumApi3PriceFeed',
  'MockDapiServer',
  'DIAOracleV2',
  'SynthereumDiaPriceFeed',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const protocols = require('../data/price-feed/protocols.json');
  const chainlinkPriceFeeds = require('../data/price-feed/pairs/chainlinkAggregators.json');
  const api3PriceFeeds = require('../data/price-feed/pairs/api3Aggregators.json');
  const diaPriceFeeds = require('../data/price-feed/pairs/diaAggregators.json');
  const randomOracleConfig = require('../data/price-feed/pairs/randomAggregator.json');
  const pairs = require('../data/price-feed/pairs.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumFinder,
    SynthereumChainlinkPriceFeed,
    MockAggregator,
    MockRandomAggregator,
    SynthereumApi3PriceFeed,
    MockDapiServer,
    SynthereumDiaPriceFeed,
    DIAOracleV2,
    SynthereumPriceFeed,
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

  // deploy oracle router
  await deploy(
    web3,
    deployer,
    network,
    SynthereumPriceFeed,
    synthereumFinder.options.address,
    roles,
    {
      from: keys.deployer,
    },
  );

  const priceFeedInterface = await web3.utils.stringToHex('PriceFeed');
  const priceFeedInstance = await getExistingInstance(
    web3,
    SynthereumPriceFeed,
    '@jarvis-network/synthereum-contracts',
  );

  await synthereumFinder.methods
    .changeImplementationAddress(
      priceFeedInterface,
      priceFeedInstance.options.address,
    )
    .send({ from: maintainer });
  console.log('Price feed added to SynthereumFinder');

  let synthereumChainlinkPriceFeed;
  let synthereumApi3PriceFeed;
  let synthereumDiaPriceFeed;

  if (protocols[networkId]?.chainlink ?? true) {
    // deploy chainlink module
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

    synthereumChainlinkPriceFeed = await getExistingInstance(
      web3,
      SynthereumChainlinkPriceFeed,
      '@jarvis-network/synthereum-contracts',
    );

    if (isPublicNetwork(network)) {
      await priceFeedInstance.methods
        .addOracle('chainlink', synthereumChainlinkPriceFeed.options.address)
        .send({ from: maintainer });
      console.log('Chainlink added to the price feed');
    }
  }

  if (protocols[networkId]?.api3 ?? true) {
    // deploy chainlink module
    await deploy(
      web3,
      deployer,
      network,
      SynthereumApi3PriceFeed,
      synthereumFinder.options.address,
      roles,
      {
        from: keys.deployer,
      },
    );

    synthereumApi3PriceFeed = await getExistingInstance(
      web3,
      SynthereumApi3PriceFeed,
      '@jarvis-network/synthereum-contracts',
    );

    if (isPublicNetwork(network)) {
      await priceFeedInstance.methods
        .addOracle('api3', synthereumApi3PriceFeed.options.address)
        .send({ from: maintainer });
      console.log('Api3 added to the price feed');
    }
  }

  if (protocols[networkId]?.dia ?? true) {
    // deploy chainlink module
    await deploy(
      web3,
      deployer,
      network,
      SynthereumDiaPriceFeed,
      synthereumFinder.options.address,
      roles,
      {
        from: keys.deployer,
      },
    );

    synthereumDiaPriceFeed = await getExistingInstance(
      web3,
      SynthereumDiaPriceFeed,
      '@jarvis-network/synthereum-contracts',
    );

    if (isPublicNetwork(network)) {
      await priceFeedInstance.methods
        .addOracle('dia', synthereumDiaPriceFeed.options.address)
        .send({ from: maintainer });
      console.log('Dia added to the price feed');
    }
  }

  var chainlinkAggregatorsData = [];
  var api3AggregatorData = [];
  var diaAggregatorData = [];
  if (!isPublicNetwork(network)) {
    return;
  } else if (networkId in randomOracleConfig) {
    const assets = Object.keys(randomOracleConfig[networkId]);
    for (let j = 0; j < assets.length; j++) {
      if (randomOracleConfig[networkId][assets[j]].oracle == 'chainlink') {
        await deploy(
          web3,
          deployer,
          network,
          MockRandomAggregator,
          web3.utils.toWei(
            randomOracleConfig[networkId][assets[j]].initialPrice,
          ),
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
        chainlinkAggregatorsData.push({
          kind: 0,
          asset: assets[j],
          pair: web3.utils.utf8ToHex(assets[j]),
          aggregator: mockRandomAggregator.options.address,
          intermediateIds: [],
        });
      } else if (randomOracleConfig[networkId][assets[j]].oracle == 'api3') {
        await deploy(web3, deployer, network, MockDapiServer, {
          from: maintainer,
        });
        const mockApi3Server = await getExistingInstance(
          web3,
          MockDapiServer,
          '@jarvis-network/synthereum-contracts',
        );

        await mockApi3Server.methods.mockDataFeed(
          web3.utils.utf8ToHex(assets[j]),
          web3.utils.toWei(
            randomOracleConfig[networkId][assets[j]].initialPrice,
          ),
          web3.utils.timestamp,
          {
            from: maintainer,
          },
        );

        api3AggregatorData.push({
          pair: assets[j],
          priceIdentifier: web3.utils.utf8ToHex(assets[j]),
          server: mockApi3Server.address,
        });
      } else if (randomOracleConfig[networkId][assets[j]].oracle == 'dia') {
        await deploy(
          web3,
          deployer,
          network,
          DIAOracleV2,
          synthereumFinder.address,
          roles,
          {
            from: maintainer,
          },
        );
        const mockDiaOracle = await getExistingInstance(
          web3,
          DIAOracleV2,
          '@jarvis-network/synthereum-contracts',
        );

        await mockDiaOracle.methods.setValue(
          assets[j],
          web3.utils.toWei(
            randomOracleConfig[networkId][assets[j]].initialPrice,
          ),
          web3.utils.timestamp,
        );

        diaAggregatorData.push({
          pair: assets[j],
          priceIdentifier: web3.utils.utf8ToHex(assets[j]),
          aggregator: mockDiaOracle.address,
        });
      }
    }
  } else {
    const chainlinkAssets = Object.keys(chainlinkPriceFeeds[networkId]);
    chainlinkAssets.map(async asset => {
      chainlinkAggregatorsData.push({
        kind: chainlinkPriceFeeds[networkId][asset].type,
        asset: asset,
        pair: asset,
        aggregator: chainlinkPriceFeeds[networkId][asset].aggregator,
        convertionMetricUnit:
          chainlinkPriceFeeds[networkId][asset].convertionMetricUnit,
      });
    });
    const api3Assets = Object.keys(api3PriceFeeds[networkId]);
    api3Assets.map(async asset => {
      api3AggregatorData.push({
        kind: api3PriceFeeds[networkId][asset].type,
        asset: asset,
        pair: asset,
        aggregator: api3PriceFeeds[networkId][asset].aggregator,
        convertionMetricUnit:
          api3PriceFeeds[networkId][asset].convertionMetricUnit,
      });
    });
    const diaAssets = Object.keys(diaPriceFeeds[networkId]);
    diaAssets.map(async asset => {
      diaAggregatorData.push({
        kind: diaPriceFeeds[networkId][asset].type,
        asset: asset,
        pair: asset,
        aggregator: diaPriceFeeds[networkId][asset].aggregator,
        convertionMetricUnit:
          diaPriceFeeds[networkId][asset].convertionMetricUnit,
      });
    });
  }
  for (let j = 0; j < chainlinkAggregatorsData.length; j++) {
    await synthereumChainlinkPriceFeed.methods
      .setPair(
        chainlinkAggregatorsData[j].pair,
        chainlinkAggregatorsData[j].kind,
        chainlinkAggregatorsData[j].aggregator,
        chainlinkAggregatorsData[j].convertionMetricUnit,
        '0x',
      )
      .send({ from: maintainer });
    console.log(`   Add '${chainlinkAggregatorsData[j].asset}' aggregator`);
  }
  for (let j = 0; j < api3AggregatorData.length; j++) {
    await synthereumApi3PriceFeed.methods
      .setPair(
        api3AggregatorData[j].pair,
        api3AggregatorData[j].kind,
        api3AggregatorData[j].aggregator,
        api3AggregatorData[j].convertionMetricUnit,
        '0x',
      )
      .send({ from: maintainer });
    console.log(`   Add '${api3AggregatorData[j].pair}' aggregator`);
  }
  for (let j = 0; j < diaAggregatorData.length; j++) {
    await synthereumDiaPriceFeed.methods
      .setPair(
        diaAggregatorData[j].pair,
        diaAggregatorData[j].kind,
        diaAggregatorData[j].aggregator,
        diaAggregatorData[j].convertionMetricUnit,
        '0x',
      )
      .send({ from: maintainer });
    console.log(`   Add '${diaAggregatorData[j].pair}' aggregator`);
  }

  var priceFeedData = [];
  const priceFeedAssets = Object.keys(pairs[networkId]);
  priceFeedAssets.map(async asset => {
    priceFeedData.push({
      kind: pairs[networkId][asset].type,
      asset: asset,
      pair: asset,
      oracle: pairs[networkId][asset].oracle,
      intermediatePairs: pairs[networkId][asset].intermediatePairs,
    });
  });
  for (let j = 0; j < priceFeedData.length; j++) {
    await priceFeedInstance.methods
      .setPair(
        priceFeedData[j].pair,
        priceFeedData[j].kind,
        priceFeedData[j].oracle,
        priceFeedData[j].intermediatePairs,
      )
      .send({ from: maintainer });
    console.log(`   Add '${priceFeedData[j].pair}' pair`);
  }
}
