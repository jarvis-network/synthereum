const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toBN, toWei, toHex } = web3Utils;

const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const IERC4626 = artifacts.require('IERC4626');
const ERC4626PriceFeed = artifacts.require('SynthereumERC4626PriceFeed');

contract('Synthereum Chainlink price feed', accounts => {
  let roles = {
    admin: accounts[0],
    maintainer: accounts[1],
  };
  let maintainer = accounts[1];
  let general = accounts[2];
  let maxSpread;
  let serverAddress = '0x01d1a890D40d890d59795aFCce22F5AdbB511A3a'; //wFRK vault

  describe('ERC4626 Provider', async () => {
    let finderInstance, priceFeedInstance, server;
    let priceIdentifier = 'FRK/wFRK';
    let priceIdentifierHex = web3Utils.padRight(
      web3Utils.toHex('FRK/wFRK'),
      64,
    );
    let networkId;

    before(async () => {
      networkId = await web3.eth.net.getId();
      finderInstance = await SynthereumFinder.deployed();
      priceFeedInstance = await ERC4626PriceFeed.deployed();
      maxSpread = web3.utils.toWei('0.001');
    });

    describe('Should register a pair', async () => {
      it('Can register a price feed server', async () => {
        const tx = await priceFeedInstance.setPair(
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
        const pairFromString = await priceFeedInstance.methods['pair(string)'](
          priceIdentifier,
        );
        const pairFromHex = await priceFeedInstance.methods['pair(bytes32)'](
          priceIdentifierHex,
        );
        assert.equal(
          JSON.stringify(pairFromString),
          JSON.stringify(pairFromHex),
          'wrong pairs',
        );
        const isSupportedFromString = await priceFeedInstance.methods[
          'isPriceSupported(string)'
        ](priceIdentifier);
        const isSupportedFromHex = await priceFeedInstance.methods[
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
          priceFeedInstance.setPair('', 0, serverAddress, 0, '0x', maxSpread, {
            from: maintainer,
          }),
          'Null identifier',
        );
      });
      it('Can revert if no type passed', async () => {
        await truffleAssert.reverts(
          priceFeedInstance.setPair(
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
          priceFeedInstance.setPair(
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
          priceFeedInstance.setPair(
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
          priceFeedInstance.setPair(
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
          priceFeedInstance.setPair(
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
        await priceFeedInstance.setPair(
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
        const isSupportedFromHex = await priceFeedInstance.methods[
          'isPriceSupported(bytes32)'
        ](priceIdentifierHex);
        assert.equal(isSupportedFromHex, true, 'wrong supported');
      });
      it('Can remove a pair', async () => {
        const tx = await priceFeedInstance.removePair(priceIdentifier, {
          from: maintainer,
        });
        truffleAssert.eventEmitted(tx, 'RemovePair', ev => {
          return ev.priceIdentifier == priceIdentifierHex;
        });
        await truffleAssert.reverts(
          priceFeedInstance.methods['pair(string)'](priceIdentifier),
          'Pair not supported',
        );
        await truffleAssert.reverts(
          priceFeedInstance.methods['pair(bytes32)'](priceIdentifierHex),
          'Pair not supported',
        );
        const isSupportedFromString = await priceFeedInstance.methods[
          'isPriceSupported(string)'
        ](priceIdentifier);
        const isSupportedFromHex = await priceFeedInstance.methods[
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
          priceFeedInstance.removePair('CHF/USD', {
            from: maintainer,
          }),
          'Price identifier not supported',
        );
      });
      it('Can revert if sender is not the maintainer', async () => {
        await truffleAssert.reverts(
          priceFeedInstance.removePair(priceIdentifier, {
            from: general,
          }),
          'Sender must be the maintainer',
        );
      });
    });

    describe('Should get a price', async () => {
      let value;
      let decimals;
      let server = await IERC4626.at(serverAddress);
      before(async () => {
        decimals = await server.decimals.call();
        value = await server.convertToAssets.call(
          Math.pow(10, decimals.toString()),
        );
      });
      it('Can get latest standard price', async () => {
        await priceFeedInstance.setPair(
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
        const priceFromString = await priceFeedInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const priceFromHex = await poolMock.getRate(
          priceFeedInstance.address,
          priceIdentifierHex,
        );
        const priceFromHexOffchain = await priceFeedInstance.methods[
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
        await priceFeedInstance.setPair(
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
        const priceFromString = await priceFeedInstance.methods[
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
        await priceFeedInstance.setPair(
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
        const priceFromString = await priceFeedInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const priceFromHex = await poolMock.getRate(
          priceFeedInstance.address,
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
        await priceFeedInstance.setPair(
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
        const priceFromString = await priceFeedInstance.methods[
          'getLatestPrice(string)'
        ](priceIdentifier);
        const priceFromHex = await poolMock.getRate(
          priceFeedInstance.address,
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
      it('Can revert if identifier not supported', async () => {
        const wrongIdentifier = 'CHFUSD';
        await truffleAssert.reverts(
          priceFeedInstance.methods['getLatestPrice(string)'](wrongIdentifier),
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
          tempMockPool.getRate(priceFeedInstance.address, priceIdentifierHex),
          'Only price-feed',
        );
      });
      it('Can revert if price is get from string by a contract', async () => {
        await truffleAssert.reverts(
          poolMock.getRateFromString(
            priceFeedInstance.address,
            priceIdentifierHex,
          ),
          'Only off-chain call',
        );
      });
    });

    describe('Should get a max spread', async () => {
      it('Can get max spread', async () => {
        await priceFeedInstance.setPair(
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
        const maxSpreadFromString = await priceFeedInstance.methods[
          'getMaxSpread(string)'
        ](priceIdentifier);
        const maxSpreadFromHex = await priceFeedInstance.methods[
          'getMaxSpread(bytes32)'
        ](priceIdentifierHex);
        assert.equal(
          maxSpreadFromString.toString(),
          maxSpreadFromHex.toString(),
          'Different spreads',
        );
        await priceFeedInstance.removePair(priceIdentifier, {
          from: maintainer,
        });
      });
      it('Can revert if price is not supported', async () => {
        await truffleAssert.reverts(
          priceFeedInstance.methods['getMaxSpread(string)']('EURGBP'),
          'Price identifier not supported',
        );
      });
      it('Can revert if trying to get dynamic spread', async () => {
        await priceFeedInstance.setPair(
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
          priceFeedInstance.address,
          web3.utils.numberToHex(slot).replace('0x0', '0x'),
        ]);
        await network.provider.send('hardhat_setStorageAt', [
          priceFeedInstance.address,
          web3.utils.numberToHex(slot).replace('0x0', '0x'),
          '0x0000000000000000000000' + actualValue.substring(24, 66),
        ]);
        await truffleAssert.reverts(
          priceFeedInstance.methods['getMaxSpread(string)'](priceIdentifier),
          'Dynamic max spread not supported',
        );
      });
    });
  });
});
