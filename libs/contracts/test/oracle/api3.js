const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toBN, toWei, toHex } = web3Utils;

const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const Api3PriceFeed = artifacts.require('SynthereumApi3PriceFeed');
const MockServer = artifacts.require('MockDapiServer');
const OracleRouter = artifacts.require('OracleRouter');

contract('Synthereum API3 price feed', accounts => {
  let finderInstance, router;
  let admin = accounts[0];
  let maintainer = accounts[1];

  before(async () => {
    finderInstance = await SynthereumFinder.deployed();
    router = await OracleRouter.new(finderInstance.address, {
      admin: accounts[0],
      maintainer: accounts[1],
    });
    await finderInstance.changeImplementationAddress(
      web3Utils.stringToHex('OracleRouter'),
      router.address,
      { from: maintainer },
    );
  });

  describe('API3 Provider', async () => {
    let api3instance, server, serverAddress;
    let priceIdentifier = web3Utils.toHex('MATIC/USD');
    let value = toWei('0.997');
    let time;

    before(async () => {
      api3instance = await Api3PriceFeed.new(finderInstance.address, {
        admin,
        maintainer,
      });
      server = await MockServer.new();
      serverAddress = server.address;
      time = (await web3.eth.getBlock('latest')).timestamp;
      await server.mockDataFeed(priceIdentifier, value, time);
    });

    it('Can register a price feed server', async () => {
      let tx = await api3instance.setServer(priceIdentifier, serverAddress, {
        from: maintainer,
      });
      truffleAssert.eventEmitted(tx, 'SetServer', ev => {
        return (
          ev.priceId == web3Utils.padRight(priceIdentifier, 64) &&
          ev.server == serverAddress
        );
      });
      let server = await api3instance.servers.call(priceIdentifier);
      assert.equal(server, serverAddress);
    });

    it('Reverts with zero address server', async () => {
      await truffleAssert.reverts(
        api3instance.setServer(priceIdentifier, ZERO_ADDRESS, {
          from: maintainer,
        }),
      );
    });

    it('Correctly retrieve price from server', async () => {
      let res = await api3instance.getLatestPrice.call(priceIdentifier);
      assert.equal(res.toString(), value.toString());
    });
  });
});
