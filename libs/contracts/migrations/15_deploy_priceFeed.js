module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumChainlinkPriceFeed',
  'MockAggregator',
  'MockRandomAggregator',
  'OracleRouter',
  'SynthereumApi3PriceFeed',
  'MockDapiServer',
  'MockDiaOracle',
  'SyntheremDiaPriceFeed',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const chainlinkPriceFeeds = require('../data/chainlinkAggregators.json');
  const api3PriceFeeds = require('../data/api3Aggregators.json');
  const diaPriceFeeds = require('../data/diaAggregators.json');
  const randomOracleConfig = require('../data/test/randomAggregator.json');
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
    SyntheremDiaPriceFeed,
    MockDiaOracle,
    OracleRouter,
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
    OracleRouter,
    synthereumFinder.options.address,
    roles,
    {
      from: keys.deployer,
    },
  );

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

  // deploy api3 module
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

  // deploy dia module
  await deploy(
    web3,
    deployer,
    network,
    SyntheremDiaPriceFeed,
    synthereumFinder.options.address,
    roles,
    {
      from: keys.deployer,
    },
  );

  const priceFeedInterface = await web3.utils.stringToHex('PriceFeed');
  const routerInstance = await getExistingInstance(
    web3,
    OracleRouter,
    '@jarvis-network/synthereum-contracts',
  );
  const synthereumChainlinkPriceFeed = await getExistingInstance(
    web3,
    SynthereumChainlinkPriceFeed,
    '@jarvis-network/synthereum-contracts',
  );
  const synthereumApi3PriceFeed = await getExistingInstance(
    web3,
    SynthereumApi3PriceFeed,
    '@jarvis-network/synthereum-contracts',
  );
  const synthereumDiaPriceFeed = await getExistingInstance(
    web3,
    SyntheremDiaPriceFeed,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      priceFeedInterface,
      routerInstance.options.address,
    )
    .send({ from: maintainer });
  console.log('Oracle Router added to SynthereumFinder');

  var chainlinkAggregatorsData = [];
  var api3AggregatorData = [];
  var diaAggregatorData = [];
  if (!isPublicNetwork(network) && !process.env.FORKCHAINID) {
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
          MockDiaOracle,
          synthereumFinder.address,
          roles,
          {
            from: maintainer,
          },
        );
        const mockDiaOracle = await getExistingInstance(
          web3,
          MockDiaOracle,
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
        pair: web3.utils.utf8ToHex(asset),
        aggregator: chainlinkPriceFeeds[networkId][asset].aggregator,
        intermediateIds:
          chainlinkPriceFeeds[networkId][asset].intermediatePairs,
        convertionMetricUnit:
          chainlinkPriceFeeds[networkId][asset].convertionMetricUnit,
      });
    });
    const api3Assets = Object.keys(api3PriceFeeds[networkId]);
    api3Assets.map(async asset => {
      api3AggregatorData.push({
        pair: asset,
        priceIdentifier: web3.utils.utf8ToHex(asset),
        server: api3PriceFeeds[networkId][asset].server,
      });
    });
    const diaAssets = Object.keys(diaPriceFeeds[networkId]);
    diaAssets.map(async asset => {
      assert(
        asset.length >= 7,
        'DIA Price Identifier should be separated with "-"',
      );
      diaAggregatorData.push({
        pair: asset,
        priceIdentifier: web3.utils.utf8ToHex(asset),
        aggregator: diaPriceFeeds[networkId][asset].aggregator,
      });
    });
  }
  for (let j = 0; j < chainlinkAggregatorsData.length; j++) {
    await synthereumChainlinkPriceFeed.methods
      .setPair(
        chainlinkAggregatorsData[j].kind,
        chainlinkAggregatorsData[j].pair,
        chainlinkAggregatorsData[j].aggregator,
        chainlinkAggregatorsData[j].intermediateIds,
        chainlinkAggregatorsData[j].convertionMetricUnit,
      )
      .send({ from: maintainer });
    console.log(`   Add '${chainlinkAggregatorsData[j].asset}' aggregator`);

    // register in router
    await routerInstance.methods
      .addIdentifier(
        chainlinkAggregatorsData[j].pair,
        synthereumChainlinkPriceFeed.options.address,
      )
      .send({ from: maintainer });
  }
  for (let j = 0; j < api3AggregatorData.length; j++) {
    await synthereumApi3PriceFeed.methods
      .setServer(
        api3AggregatorData[j].priceIdentifier,
        api3AggregatorData[j].server,
      )
      .send({ from: maintainer });
    console.log(`   Add '${api3AggregatorData[j].pair}' aggregator`);

    // register in router
    await routerInstance.methods
      .addIdentifier(
        api3AggregatorData[j].priceIdentifier,
        synthereumApi3PriceFeed.options.address,
      )
      .send({ from: maintainer });
  }
  for (let j = 0; j < diaAggregatorData.length; j++) {
    await synthereumDiaPriceFeed.methods
      .setAggregator(
        diaAggregatorData[j].priceIdentifier,
        diaAggregatorData[j].aggregator,
      )
      .send({ from: maintainer });
    console.log(`   Add '${diaAggregatorData[j].pair}' aggregator`);

    // register in router
    await routerInstance.methods
      .addIdentifier(
        diaAggregatorData[j].priceIdentifier,
        synthereumDiaPriceFeed.options.address,
      )
      .send({ from: maintainer });
  }
}
