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
const oracle = require('../../data/test/oracle.json');

contract('Synthereum Chainlink price feed', accounts => {
  let maintainer = accounts[1];
  let general = accounts[2];
  let maxSpread;

  describe('Chainlink Provider', async () => {
    let finderInstance, chainlinkInstance, server, serverAddress;
    let priceIdentifier = 'MATIC/USD';
    let priceIdentifierHex = web3Utils.padRight(
      web3Utils.toHex('MATIC/USD'),
      64,
    );
    let networkId;

    before(async () => {
      networkId = await web3.eth.net.getId();
      finderInstance = await SynthereumFinder.deployed();
      chainlinkInstance = await ChainlinkPriceFeed.deployed();
      serverAddress = oracle[networkId].chainlinkServer; //Matic/usd aggregator
      server = await AggregatorV3Interface.at(serverAddress);
      maxSpread = web3.utils.toWei('0.001');
    });

    describe('Should register a pair', async () => {
      it('Can register a price feed server', async () => {
        const tx = await chainlinkInstance.setPair(
          priceIdentifier,
          1,
          serverAddress,
          0,
          '0x',
          maxSpread,
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
        assert.equal(pairFromHex[2], maxSpread, 'wrong max spread');
        assert.equal(pairFromHex[3], 0, 'wrong conversion unit');
        assert.equal(pairFromHex[4], '0x', 'wrong extra-data');
        assert.equal(isSupportedFromHex, true, 'wrong supported');
      });
      it('Can revert if no idenitfier passed ', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.setPair('', 0, serverAddress, 0, '0x', maxSpread, {
            from: maintainer,
          }),
          'Null identifier',
        );
      });
      it('Can revert if no type passed', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.setPair(
            priceIdentifier,
            0,
            serverAddress,
            0,
            '0x',
            maxSpread,
            {
              from: maintainer,
            },
          ),
          'No type passed',
        );
      });
      it('Can revert if source is not a contract', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.setPair(
            priceIdentifier,
            1,
            accounts[3],
            0,
            '0x',
            maxSpread,
            {
              from: maintainer,
            },
          ),
          'Source is not a contract',
        );
      });
      it('Can revert if max spread is more or equal to 100%', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.setPair(
            priceIdentifier,
            1,
            serverAddress,
            0,
            '0x',
            web3Utils.toWei('1'),
            {
              from: maintainer,
            },
          ),
          'Spread must be less than 100%',
        );
      });
      it('Can revert if max spread is 0', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.setPair(
            priceIdentifier,
            1,
            serverAddress,
            0,
            '0x',
            0,
            {
              from: maintainer,
            },
          ),
          'Max spread can not be dynamic',
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
            maxSpread,
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
          maxSpread,
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
          'Price identifier not supported',
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
          maxSpread,
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
          maxSpread,
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
          maxSpread,
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
          maxSpread,
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
          maxSpread,
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
          maxSpread,
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

    describe('Should get a max spread', async () => {
      it('Can get max spread', async () => {
        await chainlinkInstance.setPair(
          priceIdentifier,
          1,
          serverAddress,
          0,
          '0x',
          maxSpread,
          {
            from: maintainer,
          },
        );
        const maxSpreadFromString = await chainlinkInstance.methods[
          'getMaxSpread(string)'
        ](priceIdentifier);
        const maxSpreadFromHex = await chainlinkInstance.methods[
          'getMaxSpread(bytes32)'
        ](priceIdentifierHex);
        assert.equal(
          maxSpreadFromString.toString(),
          maxSpreadFromHex.toString(),
          'Different spreads',
        );
        await chainlinkInstance.removePair(priceIdentifier, {
          from: maintainer,
        });
      });
      it('Can revert if price is not supported', async () => {
        await truffleAssert.reverts(
          chainlinkInstance.methods['getMaxSpread(string)']('EURGBP'),
          'Price identifier not supported',
        );
      });
      it('Can revert if trying to get dynamic spread', async () => {
        await chainlinkInstance.setPair(
          priceIdentifier,
          1,
          serverAddress,
          0,
          '0x',
          maxSpread,
          {
            from: maintainer,
          },
        );
        const slot = web3Utils
          .toBN(
            web3Utils.hexToNumberString(
              web3Utils.soliditySha3(
                web3Utils.hexToNumberString(priceIdentifierHex),
                2,
              ),
            ),
          )
          .add(web3Utils.toBN('0'))
          .toString();
        const actualValue = await network.provider.send('eth_getStorageAt', [
          chainlinkInstance.address,
          web3.utils.numberToHex(slot).replace('0x0', '0x'),
        ]);
        await network.provider.send('hardhat_setStorageAt', [
          chainlinkInstance.address,
          web3.utils.numberToHex(slot).replace('0x0', '0x'),
          '0x0000000000000000000000' + actualValue.substring(24, 66),
        ]);
        await truffleAssert.reverts(
          chainlinkInstance.methods['getMaxSpread(string)'](priceIdentifier),
          'Dynamic max spread not supported',
        );
      });
    });
  });
});
