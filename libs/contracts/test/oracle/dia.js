const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toBN, toWei, toHex } = web3Utils;

const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const DiaPriceFeed = artifacts.require('SynthereumDiaPriceFeed');
const MockDiaOracle = artifacts.require('DIAOracleV2');
const PoolMock = artifacts.require('PoolMock');

contract('Synthereum DIA price feed', accounts => {
  let finderInstance, router;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let general = accounts[2];
  let maxSpread;

  describe('DIA Provider', async () => {
    let finderInstance, diaInstance, server, serverAddress;
    let priceIdentifier = 'MATIC/USD';
    let priceIdentifierHex = web3Utils.padRight(
      web3Utils.toHex('MATIC/USD'),
      64,
    );
    let value = toWei('0.0997', 'gwei');
    let time;

    before(async () => {
      finderInstance = await SynthereumFinder.deployed();
      diaInstance = await DiaPriceFeed.deployed();
      server = await MockDiaOracle.new();
      serverAddress = server.address;
      time = (await web3.eth.getBlock('latest')).timestamp;
      await server.setValue(priceIdentifierHex, value, time);
      maxSpread = web3.utils.toWei('0.001');
    });

    describe('Should register a pair', async () => {
      it('Can register a price feed server', async () => {
        const tx = await diaInstance.setPair(
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
        const pairFromString = await diaInstance.methods['pair(string)'](
          priceIdentifier,
        );
        const pairFromHex = await diaInstance.methods['pair(bytes32)'](
          priceIdentifierHex,
        );
        assert.equal(
          JSON.stringify(pairFromString),
          JSON.stringify(pairFromHex),
          'wrong pairs',
        );
        const isSupportedFromString = await diaInstance.methods[
          'isPriceSupported(string)'
        ](priceIdentifier);
        const isSupportedFromHex = await diaInstance.methods[
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
          diaInstance.setPair('', 0, serverAddress, 0, '0x', maxSpread, {
            from: maintainer,
          }),
          'Null identifier',
        );
      });
      it('Can revert if no type passed', async () => {
        await truffleAssert.reverts(
          diaInstance.setPair(
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
          diaInstance.setPair(
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
          diaInstance.setPair(
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
          diaInstance.setPair(priceIdentifier, 1, serverAddress, 0, '0x', 0, {
            from: maintainer,
          }),
          'Max spread can not be dynamic',
        );
      });
      it('Can revert if sender is not the maintainer', async () => {
        await truffleAssert.reverts(
          diaInstance.setPair(
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
        await diaInstance.setPair(
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
        const isSupportedFromHex = await diaInstance.methods[
          'isPriceSupported(bytes32)'
        ](priceIdentifierHex);
        assert.equal(isSupportedFromHex, true, 'wrong supported');
      });
      it('Can remove a pair', async () => {
        const tx = await diaInstance.removePair(priceIdentifier, {
          from: maintainer,
        });
        truffleAssert.eventEmitted(tx, 'RemovePair', ev => {
          return ev.priceIdentifier == priceIdentifierHex;
        });
        await truffleAssert.reverts(
          diaInstance.methods['pair(string)'](priceIdentifier),
          'Pair not supported',
        );
        await truffleAssert.reverts(
          diaInstance.methods['pair(bytes32)'](priceIdentifierHex),
          'Pair not supported',
        );
        const isSupportedFromString = await diaInstance.methods[
          'isPriceSupported(string)'
        ](priceIdentifier);
        const isSupportedFromHex = await diaInstance.methods[
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
          diaInstance.removePair('CHF/USD', {
            from: maintainer,
          }),
          'Price identifier not supported',
        );
      });
      it('Can revert if sender is not the maintainer', async () => {
        await truffleAssert.reverts(
          diaInstance.removePair(priceIdentifier, {
            from: general,
          }),
          'Sender must be the maintainer',
        );
      });
    });

    describe('Should get a price', async () => {
      let value;
      let expectedValue;
      let poolMock;
      before(async () => {
        value = web3Utils.toWei('0.15', 'gwei');
        expectedValue = web3Utils.toWei('1.5');
        const timestmp = (await web3.eth.getBlock('latest')).timestamp;
        await server.setValue(priceIdentifier, value, timestmp);
        poolMock = await PoolMock.new(1, ZERO_ADDRESS, '', ZERO_ADDRESS);
        await finderInstance.changeImplementationAddress(
          web3Utils.stringToHex('PriceFeed'),
          poolMock.address,
          { from: maintainer },
        );
      });
      it('Can get latest standard price', async () => {
        await diaInstance.setPair(
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
        const priceFromString = await diaInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const priceFromHex = await poolMock.getRate(
          diaInstance.address,
          priceIdentifierHex,
        );
        const priceFromHexOffchain = await diaInstance.methods[
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
        assert.equal(
          expectedValue.toString(),
          priceFromHex.toString(),
          'Different price value',
        );
      });
      it('Can get latest standard price with conversion unit', async () => {
        const conversionUnit = web3Utils.toWei('1.5');
        await diaInstance.setPair(
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
        const priceFromString = await diaInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const result = web3Utils.toWei('1');
        assert.equal(
          priceFromString.toString(),
          result.toString(),
          'Different prices',
        );
      });
      it('Can get latest reverse price', async () => {
        await diaInstance.setPair(
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
        const priceFromString = await diaInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const priceFromHex = await poolMock.getRate(
          diaInstance.address,
          priceIdentifierHex,
        );
        assert.equal(
          priceFromString.toString(),
          priceFromHex.toString(),
          'Different prices',
        );
        const result = web3Utils
          .toBN(web3Utils.toWei(web3Utils.toWei('1').toString()))
          .div(web3Utils.toBN(expectedValue));
        assert.equal(
          result.toString(),
          priceFromHex.toString(),
          'Different price value',
        );
      });
      it('Can get latest reverse price with conversion unit', async () => {
        const conversionUnit = web3Utils.toWei('1.5');
        await diaInstance.setPair(
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
        const priceFromString = await diaInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const priceFromHex = await poolMock.getRate(
          diaInstance.address,
          priceIdentifierHex,
        );
        assert.equal(
          priceFromString.toString(),
          priceFromHex.toString(),
          'Different prices',
        );
        const convertedResult = web3Utils.toWei('1');
        const result = web3Utils
          .toBN(web3Utils.toWei(web3Utils.toWei('1').toString()))
          .div(web3Utils.toBN(convertedResult));
        assert.equal(
          result.toString(),
          priceFromHex.toString(),
          'Different price value',
        );
      });
      it('Can revert if identifier not supported', async () => {
        const wrongIdentifier = 'CHFUSD';
        await truffleAssert.reverts(
          diaInstance.methods['getLatestPrice(string)'](wrongIdentifier),
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
          tempMockPool.getRate(diaInstance.address, priceIdentifierHex),
          'Only price-feed',
        );
      });
      it('Can revert if price is get from string by a contract', async () => {
        await truffleAssert.reverts(
          poolMock.getRateFromString(diaInstance.address, priceIdentifierHex),
          'Only off-chain call',
        );
      });
    });

    describe('Should get a max spread', async () => {
      it('Can get max spread', async () => {
        await diaInstance.setPair(
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
        const maxSpreadFromString = await diaInstance.methods[
          'getMaxSpread(string)'
        ](priceIdentifier);
        const maxSpreadFromHex = await diaInstance.methods[
          'getMaxSpread(bytes32)'
        ](priceIdentifierHex);
        assert.equal(
          maxSpreadFromString.toString(),
          maxSpreadFromHex.toString(),
          'Different spreads',
        );
        await diaInstance.removePair(priceIdentifier, {
          from: maintainer,
        });
      });
      it('Can revert if price is not supported', async () => {
        await truffleAssert.reverts(
          diaInstance.methods['getMaxSpread(string)']('EURGBP'),
          'Price identifier not supported',
        );
      });
      it('Can revert if trying to get dynamic spread', async () => {
        await diaInstance.setPair(
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
          diaInstance.address,
          web3.utils.numberToHex(slot).replace('0x0', '0x'),
        ]);
        await network.provider.send('hardhat_setStorageAt', [
          diaInstance.address,
          web3.utils.numberToHex(slot).replace('0x0', '0x'),
          '0x0000000000000000000000' + actualValue.substring(24, 66),
        ]);
        await truffleAssert.reverts(
          diaInstance.methods['getMaxSpread(string)'](priceIdentifier),
          'Dynamic max spread not supported',
        );
      });
    });
  });
});
