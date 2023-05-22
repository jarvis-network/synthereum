const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toBN, toWei, toHex } = web3Utils;

const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const ChainlinkPriceFeed = artifacts.require('SynthereumChainlinkPriceFeed');
const PoolMock = artifacts.require('PoolMock');
const AggregatorV3Interface = artifacts.require('AggregatorV3Interface');
const MockAggregator = artifacts.require('MockAggregator');

contract('Synthereum Chainlink price feed', accounts => {
  let finderInstance, router;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let general = accounts[2];

  describe('Chainlink Provider', async () => {
    let finderInstance, chainlinkInstance, server, serverAddress;
    let priceIdentifier = 'MATIC/USD';
    let priceIdentifierHex = web3Utils.padRight(
      web3Utils.toHex('MATIC/USD'),
      64,
    );
    let value = toWei('0.997');
    let time;

    before(async () => {
      finderInstance = await SynthereumFinder.deployed();
      chainlinkInstance = await ChainlinkPriceFeed.deployed();
      serverAddress = '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0'; //Matic/usd aggregator
      server = await AggregatorV3Interface.at(serverAddress);
    });

    describe('Should register a pair', async () => {
      it('Can register a price feed server', async () => {
        const tx = await chainlinkInstance.setPair(
          priceIdentifier,
          1,
          serverAddress,
          0,
          '0x',
          {
            from: maintainer,
          },
        );
        truffleAssert.eventEmitted(tx, 'SetPair', ev => {
          return (
            ev.priceIdentifier == priceIdentifierHex &&
            ev.kind == 1 &&
            ev.source == serverAddress &&
            ev.conversionUnit == 0 &&
            ev.extraData == null
          );
        });
        const pairFromString = await chainlinkInstance.methods['pair(string)'](
          priceIdentifier,
        );
        const pairFromHex = await chainlinkInstance.methods['pair(bytes32)'](
          priceIdentifierHex,
        );
        assert.equal(
          JSON.stringify(pairFromString),
          JSON.stringify(pairFromHex),
          'wrong pairs',
        );
        const isSupportedFromString = await chainlinkInstance.methods[
          'isPriceSupported(string)'
        ](priceIdentifier);
        const isSupportedFromHex = await chainlinkInstance.methods[
          'isPriceSupported(bytes32)'
        ](priceIdentifierHex);
        assert.equal(
          isSupportedFromString,
          isSupportedFromHex,
          'wrong support match',
        );
        assert.equal(pairFromHex[0], 1, 'wrong type');
        assert.equal(pairFromHex[1], serverAddress, 'wrong server');
        assert.equal(pairFromHex[2], 0, 'wrong conversion unit');
        assert.equal(pairFromHex[3], '0x', 'wrong extra-data');
        assert.equal(isSupportedFromHex, true, 'wrong supported');
      });
      it('Can revert if not type passed', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.setPair(
            priceIdentifier,
            0,
            serverAddress,
            0,
            '0x',
            {
              from: maintainer,
            },
          ),
          'No type passed',
        );
      });
      it('Can revert if not type passed', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.setPair(priceIdentifier, 1, accounts[3], 0, '0x', {
            from: maintainer,
          }),
          'Source is not a contract',
        );
      });
      it('Can revert if sender is not the maintainer', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.setPair(
            priceIdentifier,
            1,
            serverAddress,
            0,
            '0x',
            {
              from: general,
            },
          ),
          'Sender must be the maintainer',
        );
      });
    });

    describe('Should remove a pair', async () => {
      before(async () => {
        await chainlinkInstance.setPair(
          priceIdentifier,
          1,
          serverAddress,
          0,
          '0x',
          {
            from: maintainer,
          },
        );
        const isSupportedFromHex = await chainlinkInstance.methods[
          'isPriceSupported(bytes32)'
        ](priceIdentifierHex);
        assert.equal(isSupportedFromHex, true, 'wrong supported');
      });
      it('Can remove a pair', async () => {
        const tx = await chainlinkInstance.removePair(priceIdentifier, {
          from: maintainer,
        });
        truffleAssert.eventEmitted(tx, 'RemovePair', ev => {
          return ev.priceIdentifier == priceIdentifierHex;
        });
        await truffleAssert.reverts(
          chainlinkInstance.methods['pair(string)'](priceIdentifier),
          'Pair not supported',
        );
        await truffleAssert.reverts(
          chainlinkInstance.methods['pair(bytes32)'](priceIdentifierHex),
          'Pair not supported',
        );
        const isSupportedFromString = await chainlinkInstance.methods[
          'isPriceSupported(string)'
        ](priceIdentifier);
        const isSupportedFromHex = await chainlinkInstance.methods[
          'isPriceSupported(bytes32)'
        ](priceIdentifierHex);
        assert.equal(
          isSupportedFromString,
          isSupportedFromHex,
          'wrong support match',
        );
        assert.equal(isSupportedFromHex, false, 'wrong supported');
      });
      it('Can revert if pair not supported', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.removePair('CHF/USD', {
            from: maintainer,
          }),
          'Price identifier does not exist',
        );
      });
      it('Can revert if sender is not the maintainer', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.removePair(priceIdentifier, {
            from: general,
          }),
          'Sender must be the maintainer',
        );
      });
    });

    describe('Should get a price', async () => {
      let value;
      let decimals;
      let poolMock;
      before(async () => {
        value = (await server.latestRoundData.call())[1];
        decimals = await server.decimals.call();
        poolMock = await PoolMock.new(1, ZERO_ADDRESS, '', ZERO_ADDRESS);
        await finderInstance.changeImplementationAddress(
          web3Utils.stringToHex('PriceFeed'),
          poolMock.address,
          { from: maintainer },
        );
      });
      it('Can get latest standard price', async () => {
        await chainlinkInstance.setPair(
          priceIdentifier,
          1,
          serverAddress,
          0,
          '0x',
          {
            from: maintainer,
          },
        );
        const priceFromString = await chainlinkInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const priceFromHex = await poolMock.getRate(
          chainlinkInstance.address,
          priceIdentifierHex,
        );
        const priceFromHexOffchain = await chainlinkInstance.methods[
          'getLatestPrice(bytes32)'
        ](priceIdentifierHex);
        assert.equal(
          priceFromString.toString(),
          priceFromHex.toString(),
          'Different prices',
        );
        assert.equal(
          priceFromHex.toString(),
          priceFromHexOffchain.toString(),
          'Different prices',
        );
        const result = web3Utils
          .toBN(value)
          .mul(web3Utils.toBN(Math.pow(10, 18 - decimals)));
        assert.equal(
          result.toString(),
          priceFromHex.toString(),
          'Different price value',
        );
      });
      it('Can get latest standard price with conversion unit', async () => {
        const conversionUnit = web3Utils.toWei('1.5');
        await chainlinkInstance.setPair(
          priceIdentifier,
          1,
          serverAddress,
          conversionUnit,
          '0x',
          {
            from: maintainer,
          },
        );
        const priceFromString = await chainlinkInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const result = web3Utils
          .toBN(value)
          .mul(web3Utils.toBN(Math.pow(10, 18 - decimals)))
          .mul(web3Utils.toBN(web3Utils.toWei('1')))
          .div(web3Utils.toBN(conversionUnit));
        assert.equal(
          priceFromString.toString(),
          result.toString(),
          'Different prices',
        );
      });
      it('Can get latest reverse price', async () => {
        await chainlinkInstance.setPair(
          priceIdentifier,
          2,
          serverAddress,
          0,
          '0x',
          {
            from: maintainer,
          },
        );
        const priceFromString = await chainlinkInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const priceFromHex = await poolMock.getRate(
          chainlinkInstance.address,
          priceIdentifierHex,
        );
        assert.equal(
          priceFromString.toString(),
          priceFromHex.toString(),
          'Different prices',
        );
        const result = web3Utils
          .toBN(web3Utils.toWei(web3Utils.toWei('1').toString()))
          .div(
            web3Utils
              .toBN(value)
              .mul(web3Utils.toBN(Math.pow(10, 18 - decimals))),
          );
        assert.equal(
          result.toString(),
          priceFromHex.toString(),
          'Different price value',
        );
      });
      it('Can get latest reverse price with conversion unit', async () => {
        const conversionUnit = web3Utils.toWei('1.5');
        await chainlinkInstance.setPair(
          priceIdentifier,
          2,
          serverAddress,
          conversionUnit,
          '0x',
          {
            from: maintainer,
          },
        );
        const priceFromString = await chainlinkInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const priceFromHex = await poolMock.getRate(
          chainlinkInstance.address,
          priceIdentifierHex,
        );
        assert.equal(
          priceFromString.toString(),
          priceFromHex.toString(),
          'Different prices',
        );
        const convertedResult = web3Utils
          .toBN(value)
          .mul(web3Utils.toBN(Math.pow(10, 18 - decimals)))
          .mul(web3Utils.toBN(web3Utils.toWei('1')))
          .div(web3Utils.toBN(conversionUnit));
        const result = web3Utils
          .toBN(web3Utils.toWei(web3Utils.toWei('1').toString()))
          .div(web3Utils.toBN(convertedResult));
        assert.equal(
          result.toString(),
          priceFromHex.toString(),
          'Different price value',
        );
      });
      it('Can revert if price is negative', async () => {
        const mockServer = await MockAggregator.new(8, -100);
        await chainlinkInstance.setPair(
          priceIdentifier,
          1,
          mockServer.address,
          0,
          '0x',
          {
            from: maintainer,
          },
        );
        await truffleAssert.reverts(
          chainlinkInstance.methods['getLatestPrice(string)'](priceIdentifier),
          'Negative value',
        );
        await chainlinkInstance.setPair(
          priceIdentifier,
          1,
          serverAddress,
          0,
          '0x',
          {
            from: maintainer,
          },
        );
      });
      it('Can revert if identifier not supported', async () => {
        const wrongIdentifier = 'CHFUSD';
        await truffleAssert.reverts(
          chainlinkInstance.methods['getLatestPrice(string)'](wrongIdentifier),
          'Pair not supported',
        );
      });
      it('Can revert if price is get from bytes by a contract that is not the price feed', async () => {
        const tempMockPool = await PoolMock.new(
          1,
          ZERO_ADDRESS,
          '',
          ZERO_ADDRESS,
        );
        await truffleAssert.reverts(
          tempMockPool.getRate(chainlinkInstance.address, priceIdentifierHex),
          'Only price-feed',
        );
      });
      it('Can revert if price is get from string by a contract', async () => {
        await truffleAssert.reverts(
          poolMock.getRateFromString(
            chainlinkInstance.address,
            priceIdentifierHex,
          ),
          'Only off-chain call',
        );
      });
    });
  });
});
