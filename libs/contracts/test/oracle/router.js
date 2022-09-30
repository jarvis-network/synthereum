const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toBN, toWei, toHex } = web3Utils;

const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const Api3PriceFeed = artifacts.require('SynthereumApi3PriceFeed');
const ChainlinkPriceFeed = artifacts.require('SynthereumChainlinkPriceFeed');
const MockServer = artifacts.require('MockDapiServer');
const MockAggregator = artifacts.require('MockAggregator');
const OracleRouter = artifacts.require('OracleRouter');

contract('Synthereum API3 price feed', accounts => {
  let finderInstance, router;
  let admin = accounts[0];
  let maintainer = accounts[1];

  before(async () => {
    finderInstance = await SynthereumFinder.deployed();
    router = await OracleRouter.deployed();
    await finderInstance.changeImplementationAddress(
      web3Utils.stringToHex('OracleRouter'),
      router.address,
      { from: maintainer },
    );
  });

  describe('Oracle Router', async () => {
    let api3instance,
      chainlinkInstance,
      server,
      serverAddress,
      aggregator,
      aggregatorAddress;
    let api3PriceIdentifier = web3Utils.toHex('MATIC/USD');
    let chainlinkIdentifier = web3Utils.toHex('BTC/USD');
    let value = toWei('0.997');
    let chainlinkValue = toWei('2300', 'mwei');
    let chainlinkValueUnscaled = web3Utils.toWei('23');
    let time;

    before(async () => {
      // api3
      api3instance = await Api3PriceFeed.deployed();
      server = await MockServer.new();
      serverAddress = server.address;
      await api3instance.setServer(api3PriceIdentifier, serverAddress, {
        from: maintainer,
      });
      time = (await web3.eth.getBlock('latest')).timestamp;
      await server.mockDataFeed(api3PriceIdentifier, value, time);

      // chainlink
      chainlinkInstance = await ChainlinkPriceFeed.deployed();
      aggregator = await MockAggregator.new(8, 120000000);
      await chainlinkInstance.setPair(
        0,
        chainlinkIdentifier,
        aggregator.address,
        [],
        0,
        { from: maintainer },
      );
      await aggregator.updateAnswer(chainlinkValue);
    });

    it('Can register an oracle contract', async () => {
      let tx = await router.addIdentifier(
        api3PriceIdentifier,
        api3instance.address,
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'SetOracle', ev => {
        return (
          ev.priceId == web3Utils.padRight(api3PriceIdentifier, 64) &&
          ev.oracleContract == api3instance.address
        );
      });
      let res = await router.idToOracle.call(api3PriceIdentifier);
      assert.equal(res, api3instance.address);

      tx = await router.addIdentifier(
        chainlinkIdentifier,
        chainlinkInstance.address,
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'SetOracle', ev => {
        return (
          ev.priceId == web3Utils.padRight(chainlinkIdentifier, 64) &&
          ev.oracleContract == chainlinkInstance.address
        );
      });
      res = await router.idToOracle.call(chainlinkIdentifier);
      assert.equal(res, chainlinkInstance.address);
    });

    it('Correctly retrieve price from different oracle contracts', async () => {
      let res = await router.getLatestPrice.call(api3PriceIdentifier);
      assert.equal(res.toString(), value.toString());

      let chainlinkRes = await router.getLatestPrice.call(chainlinkIdentifier);
      assert.equal(chainlinkRes.toString(), chainlinkValueUnscaled.toString());
    });

    it('Reverts if price is not registered', async () => {
      await truffleAssert.reverts(
        router.getLatestPrice.call(toHex('LOL/USD')),
        'Price identifier not registered',
      );
    });
  });
});
