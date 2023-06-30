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
const PoolMock = artifacts.require('PoolMock');
const PoolRegistryMock = artifacts.require('PoolRegistryMock');
const PriceFeed = artifacts.require('SynthereumPriceFeed');
const DIAOracleV2 = artifacts.require('DIAOracleV2');
const SynthereumDiaPriceFeed = artifacts.require('SynthereumDiaPriceFeed');
const oracle = require('../../data/test/oracle.json');

contract('Synthereum price feed', accounts => {
  let finderInstance, priceFeed;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let priceIdentifier;
  let priceIdentifierHex;
  let oracleIdentifier;
  let oracleIdentifierHex;
  let secondOracleIndentifier;
  let secondOracleIndentifierHex;
  let secondMaxSpread;
  let chainlinkServer;
  let secondPriceIdentifier;
  let secondPriceIdentifierHex;
  let computedPriceIdentifier;
  let computedPriceIdentifierHex;
  let diaPrice;
  let diaServer;
  let diaOracle;
  let networkId;
  let maxSpread;

  before(async () => {
    networkId = await web3.eth.net.getId();
    finderInstance = await SynthereumFinder.deployed();
    priceFeed = await PriceFeed.deployed();
    chainlinkImpl = await ChainlinkPriceFeed.deployed();
    priceIdentifier = 'MATICUSD';
    priceIdentifierHex = web3Utils.padRight(web3Utils.toHex('MATICUSD'), 64);
    chainlinkServer = oracle[networkId].chainlinkServer;
    maxSpread = web3.utils.toWei('0.002');
    await chainlinkImpl.setPair(
      priceIdentifier,
      1,
      chainlinkServer,
      0,
      '0x',
      maxSpread,
      {
        from: maintainer,
      },
    );
    oracleIdentifier = 'chainlink';
    oracleIdentifierHex = web3Utils.padRight(
      web3Utils.toHex(oracleIdentifier),
      64,
    );
    secondOracleIndentifier = 'dia';
    secondOracleIdentifierHex = web3Utils.padRight(
      web3Utils.toHex(secondOracleIndentifier),
      64,
    );
    secondPriceIdentifier = 'USDEUR';
    secondPriceIdentifierHex = web3Utils.padRight(
      web3Utils.toHex(secondPriceIdentifier),
      64,
    );
    secondMaxSpread = web3.utils.toWei('0.0015');
    computedPriceIdentifier = 'MATICEUR';
    computedPriceIdentifierHex = web3Utils.padRight(
      web3Utils.toHex(computedPriceIdentifier),
      64,
    );
    diaPrice = web3Utils.toWei('0.11', 'gwei');
    diaServer = await DIAOracleV2.new();
    await diaServer.setValue(
      secondPriceIdentifier,
      diaPrice,
      Math.floor(new Date() / 1000),
    );
    diaOracle = await SynthereumDiaPriceFeed.deployed();
    await diaOracle.setPair(
      secondPriceIdentifier,
      2,
      diaServer.address,
      0,
      '0x',
      secondMaxSpread,
      { from: maintainer },
    );
  });

  describe('Should add oracle', async () => {
    it('Can add oracle protocol', async () => {
      let tx = await priceFeed.addOracle(
        oracleIdentifier,
        chainlinkImpl.address,
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'OracleAdded', ev => {
        return (
          ev.priceId == oracleIdentifierHex &&
          ev.oracleContract == chainlinkImpl.address
        );
      });
      const oracleFromString = await priceFeed.methods[
        'oracleImplementation(string)'
      ](oracleIdentifier);
      const oracleFromHex = await priceFeed.methods[
        'oracleImplementation(bytes32)'
      ](oracleIdentifierHex);
      assert.equal(
        oracleFromString,
        oracleFromHex,
        'Implemenations do not match',
      );
      assert.equal(
        oracleFromHex,
        chainlinkImpl.address,
        'Wrong implementation',
      );
      let oraclesList = await priceFeed.getOracles.call();
      assert.deepEqual([oracleIdentifier], oraclesList, 'Wrong oracle list');
      const oracleIdentifierTwo = 'chainlink2';
      await priceFeed.addOracle(oracleIdentifierTwo, chainlinkImpl.address, {
        from: maintainer,
      });
      oraclesList = await priceFeed.getOracles.call();
      assert.deepEqual(
        [oracleIdentifier, oracleIdentifierTwo],
        oraclesList,
        'Wrong oracle list',
      );
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
      await priceFeed.removeOracle(oracleIdentifierTwo, {
        from: maintainer,
      });
    });
    it('Can revert if implementation is not a contract', async () => {
      await truffleAssert.reverts(
        priceFeed.addOracle(oracleIdentifier, accounts[3], {
          from: maintainer,
        }),
        'Implementation is not a contract',
      );
    });
    it('Can revert if oracle already added', async () => {
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
          from: maintainer,
        }),
        'Oracle already added',
      );
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
    });
    it('Can revert if sender is not the maintainer', async () => {
      await truffleAssert.reverts(
        priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
          from: admin,
        }),
        'Sender must be the maintainer',
      );
    });
  });

  describe('Should update oracle', async () => {
    beforeEach(async () => {
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
    });
    afterEach(async () => {
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
    });
    it('Can update oracle protocol', async () => {
      const newOracle = await ChainlinkPriceFeed.new(finderInstance.address, {
        admin,
        maintainer,
      });
      let tx = await priceFeed.updateOracle(
        oracleIdentifier,
        newOracle.address,
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'OracleUpdated', ev => {
        return (
          ev.priceId == oracleIdentifierHex &&
          ev.oracleContract == newOracle.address
        );
      });
      const oracleFromString = await priceFeed.methods[
        'oracleImplementation(string)'
      ](oracleIdentifier);
      const oracleFromHex = await priceFeed.methods[
        'oracleImplementation(bytes32)'
      ](oracleIdentifierHex);
      assert.equal(
        oracleFromString,
        oracleFromHex,
        'Implemenations do not match',
      );
      assert.equal(oracleFromHex, newOracle.address, 'Wrong implementation');
      let oraclesList = await priceFeed.getOracles.call();
      assert.deepEqual([oracleIdentifier], oraclesList, 'Wrong oracle list');
    });
    it('Can revert if implementation is not a contract', async () => {
      await truffleAssert.reverts(
        priceFeed.updateOracle(oracleIdentifier, accounts[3], {
          from: maintainer,
        }),
        'Implementation is not a contract',
      );
    });
    it('Can revert if oracle not added', async () => {
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        priceFeed.updateOracle(oracleIdentifier, chainlinkImpl.address, {
          from: maintainer,
        }),
        'Oracle not added',
      );
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
    });
    it('Can revert if same implementation set', async () => {
      await truffleAssert.reverts(
        priceFeed.updateOracle(oracleIdentifier, chainlinkImpl.address, {
          from: maintainer,
        }),
        'Same implementation set',
      );
    });
    it('Can revert if sender is not the maintainer', async () => {
      const newOracle = await ChainlinkPriceFeed.new(finderInstance.address, {
        admin,
        maintainer,
      });
      await truffleAssert.reverts(
        priceFeed.updateOracle(oracleIdentifier, newOracle.address, {
          from: admin,
        }),
        'Sender must be the maintainer',
      );
    });
  });

  describe('Should remove oracle', async () => {
    beforeEach(async () => {
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
    });
    it('Can remove oracle protocol', async () => {
      let tx = await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
      truffleAssert.eventEmitted(tx, 'OracleRemoved', ev => {
        return ev.priceId == oracleIdentifierHex;
      });
      await truffleAssert.reverts(
        priceFeed.methods['oracleImplementation(string)'](oracleIdentifier),
        'Oracle not supported',
      );
      await truffleAssert.reverts(
        priceFeed.methods['oracleImplementation(bytes32)'](oracleIdentifierHex),
        'Oracle not supported',
      );
      let oraclesList = await priceFeed.getOracles.call();
      assert.deepEqual([], oraclesList, 'Wrong oracle list');
    });
    it('Can revert if trying to remove an orcacle not supported', async () => {
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        priceFeed.removeOracle(oracleIdentifier, {
          from: maintainer,
        }),
        'Oracle not supported',
      );
    });
    it('Can revert if sender is not the maintainer', async () => {
      await truffleAssert.reverts(
        priceFeed.removeOracle(oracleIdentifier, {
          from: admin,
        }),
        'Sender must be the maintainer',
      );
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
    });
  });

  describe('Should set pair', async () => {
    before(async () => {
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
    });
    after(async () => {
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
    });
    it('Can set standard pair', async () => {
      let isSupportedFromString = await priceFeed.methods[
        'isPriceSupported(string)'
      ](priceIdentifier);
      assert.equal(isSupportedFromString, false, 'Price supported');
      await truffleAssert.reverts(
        priceFeed.methods['pair(string)'](priceIdentifier),
        'Pair not supported',
      );
      const tx = await priceFeed.setPair(
        priceIdentifier,
        1,
        oracleIdentifier,
        [],
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'PairSet', ev => {
        return (
          ev.priceId == priceIdentifierHex &&
          ev.kind == 1 &&
          ev.oracle == oracleIdentifierHex &&
          ev.intermediatePairs.length == 0
        );
      });
      const pairFromString = await priceFeed.methods['pair(string)'](
        priceIdentifier,
      );
      const pairFromHex = await priceFeed.methods['pair(bytes32)'](
        priceIdentifierHex,
      );
      assert.equal(
        JSON.stringify(pairFromString),
        JSON.stringify(pairFromHex),
        'Pairs do not match',
      );
      assert.equal(pairFromHex[0], 1, 'Type does not match');
      assert.equal(pairFromHex[1], oracleIdentifier, 'Oracle does not match');
      assert.deepEqual(pairFromHex[2], [], 'Intermediate pairs do not match');
      const identifiers = await priceFeed.getIdentifiers.call();
      assert.deepEqual(
        identifiers,
        [priceIdentifier],
        'Identifies do not match',
      );
      isSupportedFromString = await priceFeed.methods[
        'isPriceSupported(string)'
      ](priceIdentifier);
      const isSupportedFromHex = await priceFeed.methods[
        'isPriceSupported(bytes32)'
      ](priceIdentifierHex);
      assert.equal(
        isSupportedFromString,
        isSupportedFromHex,
        'Price support does not match',
      );
      assert.equal(isSupportedFromHex, true, 'Price not supported');
    });
    it('Can revert if intermediate pairs are passed for standard price', async () => {
      await truffleAssert.reverts(
        priceFeed.setPair(
          priceIdentifier,
          1,
          oracleIdentifier,
          ['USDCHF', 'CHFEUR'],
          {
            from: maintainer,
          },
        ),
        'No intermediate pairs should be specified',
      );
    });
    it('Can revert if oracle is not supported for standard pair', async () => {
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        priceFeed.setPair(priceIdentifier, 1, 'chainlink', [], {
          from: maintainer,
        }),
        'Oracle not supported',
      );
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
      await priceFeed.setPair(priceIdentifier, 1, 'chainlink', [], {
        from: maintainer,
      });
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
      const isSupported = await priceFeed.methods['isPriceSupported(string)'](
        priceIdentifier,
      );
      assert.equal(isSupported, false, 'Price supported');
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
    });
    it('Can revert if pair is not set in the implementation', async () => {
      await chainlinkImpl.removePair(priceIdentifier, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        priceFeed.setPair(priceIdentifier, 1, oracleIdentifier, [], {
          from: maintainer,
        }),
        'Price not supported by implementation',
      );
      await chainlinkImpl.setPair(
        priceIdentifier,
        1,
        chainlinkServer,
        0,
        '0x',
        maxSpread,
        {
          from: maintainer,
        },
      );
      await priceFeed.setPair(priceIdentifier, 1, oracleIdentifier, [], {
        from: maintainer,
      });
      await chainlinkImpl.removePair(priceIdentifier, {
        from: maintainer,
      });
      const isSupported = await priceFeed.methods['isPriceSupported(string)'](
        priceIdentifier,
      );
      assert.equal(isSupported, false, 'Price supported');
      await chainlinkImpl.setPair(
        priceIdentifier,
        1,
        chainlinkServer,
        0,
        '0x',
        maxSpread,
        {
          from: maintainer,
        },
      );
    });
    it('Can set computed pair', async () => {
      await priceFeed.addOracle(secondOracleIndentifier, diaOracle.address, {
        from: maintainer,
      });
      await priceFeed.setPair(
        secondPriceIdentifier,
        1,
        secondOracleIndentifier,
        [],
        {
          from: maintainer,
        },
      );
      let isSupportedFromString = await priceFeed.methods[
        'isPriceSupported(string)'
      ](secondPriceIdentifier);
      assert.equal(isSupportedFromString, true, 'Price supported');
      let identifierList = await priceFeed.getIdentifiers.call();
      assert.deepEqual(
        identifierList,
        [priceIdentifier, secondPriceIdentifier],
        'Wrong identifiers list',
      );
      await truffleAssert.reverts(
        priceFeed.methods['pair(string)'](computedPriceIdentifier),
        'Pair not supported',
      );
      const tx = await priceFeed.setPair(
        computedPriceIdentifier,
        2,
        '',
        [priceIdentifier, secondPriceIdentifier],
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'PairSet', ev => {
        return (
          ev.priceId == computedPriceIdentifierHex &&
          ev.kind == 2 &&
          ev.oracle == web3Utils.padRight(web3Utils.toHex(''), 64) &&
          ev.intermediatePairs[0] == priceIdentifierHex &&
          ev.intermediatePairs[1] == secondPriceIdentifierHex
        );
      });
      const pairFromString = await priceFeed.methods['pair(string)'](
        computedPriceIdentifier,
      );
      const pairFromHex = await priceFeed.methods['pair(bytes32)'](
        computedPriceIdentifierHex,
      );
      assert.equal(
        JSON.stringify(pairFromString),
        JSON.stringify(pairFromHex),
        'Pairs do not match',
      );
      assert.equal(pairFromHex[0], 2, 'Type does not match');
      assert.equal(pairFromHex[1], '', 'Oracle does not match');
      assert.deepEqual(
        pairFromHex[2],
        [priceIdentifier, secondPriceIdentifier],
        'Intermediate pairs do not match',
      );
      identifierList = await priceFeed.getIdentifiers.call();
      assert.deepEqual(
        identifierList,
        [priceIdentifier, secondPriceIdentifier, computedPriceIdentifier],
        'Wrong identifiers list',
      );
      isSupportedFromString = await priceFeed.methods[
        'isPriceSupported(string)'
      ](computedPriceIdentifier);
      const isSupportedFromHex = await priceFeed.methods[
        'isPriceSupported(bytes32)'
      ](computedPriceIdentifierHex);
      assert.equal(
        isSupportedFromString,
        isSupportedFromHex,
        'Price support does not match',
      );
      assert.equal(isSupportedFromHex, true, 'Price not supported');
      await diaOracle.removePair(secondPriceIdentifier, { from: maintainer });
      isSupportedFromString = await priceFeed.methods[
        'isPriceSupported(string)'
      ](computedPriceIdentifier);
      assert.equal(isSupportedFromString, false, 'Price supported');
      await priceFeed.removePair(secondPriceIdentifier, { from: maintainer });
      await priceFeed.removePair(computedPriceIdentifier, { from: maintainer });
      await diaOracle.setPair(
        secondPriceIdentifier,
        2,
        diaServer.address,
        0,
        '0x',
        secondMaxSpread,
        { from: maintainer },
      );
      await priceFeed.removeOracle(secondOracleIndentifier, {
        from: maintainer,
      });
    });
    it('Can revert if less than two intermediate pairs setting computed price', async () => {
      await priceFeed.addOracle(secondOracleIndentifier, diaOracle.address, {
        from: maintainer,
      });
      await priceFeed.setPair(
        secondPriceIdentifier,
        1,
        secondOracleIndentifier,
        [],
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        priceFeed.setPair(computedPriceIdentifier, 2, '', [priceIdentifier], {
          from: maintainer,
        }),
        'No intermediate pairs set',
      );
      await priceFeed.removePair(secondPriceIdentifier, { from: maintainer });
      await priceFeed.removeOracle(secondOracleIndentifier, {
        from: maintainer,
      });
    });
    it('Can revert if oracle passed setting computed price', async () => {
      await priceFeed.addOracle(secondOracleIndentifier, diaOracle.address, {
        from: maintainer,
      });
      await priceFeed.setPair(
        secondPriceIdentifier,
        1,
        secondOracleIndentifier,
        [],
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        priceFeed.setPair(
          computedPriceIdentifier,
          2,
          oracleIdentifier,
          [priceIdentifier, secondPriceIdentifier],
          {
            from: maintainer,
          },
        ),
        'Oracle must not be set',
      );
      await priceFeed.removePair(secondPriceIdentifier, { from: maintainer });
      await priceFeed.removeOracle(secondOracleIndentifier, {
        from: maintainer,
      });
    });
    it('Can revert if no identifier passed', async () => {
      await truffleAssert.reverts(
        priceFeed.setPair('', 1, oracleIdentifier, [], {
          from: maintainer,
        }),
        'Null identifier',
      );
    });
    it('Can revert if no type passed', async () => {
      await truffleAssert.reverts(
        priceFeed.setPair(priceIdentifier, 0, oracleIdentifier, [], {
          from: maintainer,
        }),
        'Pair not supported',
      );
    });
    it('Can revert if sender is not the maintainer', async () => {
      await truffleAssert.reverts(
        priceFeed.setPair(priceIdentifier, 1, oracleIdentifier, [], {
          from: admin,
        }),
        'Sender must be the maintainer',
      );
    });
  });

  describe('Should remove pair', async () => {
    before(async () => {
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
      await priceFeed.setPair(priceIdentifier, 1, oracleIdentifier, [], {
        from: maintainer,
      });
    });
    after(async () => {
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
      await priceFeed.removePair(priceIdentifier, {
        from: maintainer,
      });
    });
    it('Can remove pair', async () => {
      const tx = await priceFeed.removePair(priceIdentifier, {
        from: maintainer,
      });
      truffleAssert.eventEmitted(tx, 'PairRemoved', ev => {
        return ev.priceId == priceIdentifierHex;
      });
      const isSupportedFromHex = await priceFeed.methods[
        'isPriceSupported(bytes32)'
      ](priceIdentifierHex);
      assert.equal(isSupportedFromHex, false, 'Price supported');
      await priceFeed.setPair(priceIdentifier, 1, oracleIdentifier, [], {
        from: maintainer,
      });
    });
    it('Can revert if pair not supported', async () => {
      await truffleAssert.reverts(
        priceFeed.removePair(secondPriceIdentifier, { from: maintainer }),
        'Identifier not supported',
      );
    });
    it('Can revert if sender is not the maintainer', async () => {
      await truffleAssert.reverts(
        priceFeed.removePair(priceIdentifier, { from: admin }),
        'Sender must be the maintainer',
      );
    });
  });

  describe('Should get price', async () => {
    let mainPrice;
    let secondPrice;
    let poolMock;
    let testRegistry;
    before(async () => {
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
      await priceFeed.setPair(priceIdentifier, 1, oracleIdentifier, [], {
        from: maintainer,
      });
      mainPrice = await chainlinkImpl.methods['getLatestPrice(string)'](
        priceIdentifier,
      );
      secondPrice = await diaOracle.methods['getLatestPrice(string)'](
        secondPriceIdentifier,
      );
      poolMock = await PoolMock.new(1, ZERO_ADDRESS, 'test', ZERO_ADDRESS);
      testRegistry = await PoolRegistryMock.new();
      await finderInstance.changeImplementationAddress(
        web3Utils.stringToHex('PoolRegistry'),
        testRegistry.address,
        { from: maintainer },
      );
      await testRegistry.register('test', ZERO_ADDRESS, 1, poolMock.address);
    });
    after(async () => {
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
      await priceFeed.removePair(priceIdentifier, {
        from: maintainer,
      });
    });
    it('Can get standard price', async () => {
      const priceFromString = await priceFeed.methods['getLatestPrice(string)'](
        priceIdentifier,
      );
      const priceFromHex = await poolMock.getRate.call(
        priceFeed.address,
        priceIdentifierHex,
      );
      assert.equal(
        priceFromString.toString(),
        priceFromHex.toString(),
        'Prices do not match',
      );
      assert.equal(
        priceFromString.toString(),
        web3Utils.toBN(mainPrice).toString(),
        'Price wrong',
      );
    });
    it('Can get computed price', async () => {
      await priceFeed.addOracle(secondOracleIndentifier, diaOracle.address, {
        from: maintainer,
      });
      await priceFeed.setPair(
        secondPriceIdentifier,
        1,
        secondOracleIndentifier,
        [],
        {
          from: maintainer,
        },
      );
      await priceFeed.setPair(
        computedPriceIdentifier,
        2,
        '',
        [priceIdentifier, secondPriceIdentifier],
        {
          from: maintainer,
        },
      );
      const priceFromString = await priceFeed.methods['getLatestPrice(string)'](
        computedPriceIdentifier,
      );
      const priceFromHex = await poolMock.getRate.call(
        priceFeed.address,
        computedPriceIdentifierHex,
      );
      const priceFromHexOffchain = await priceFeed.methods[
        'getLatestPrice(bytes32)'
      ](computedPriceIdentifierHex);
      assert.equal(
        priceFromString.toString(),
        priceFromHex.toString(),
        'Prices do not match',
      );
      assert.equal(
        priceFromHexOffchain.toString(),
        priceFromHex.toString(),
        'Prices do not match',
      );
      assert.equal(
        priceFromString.toString(),
        web3Utils
          .toBN(mainPrice)
          .mul(web3Utils.toBN(secondPrice))
          .div(web3Utils.toBN(web3Utils.toWei('1')))
          .toString(),
        'Price wrong',
      );
      await priceFeed.removePair(secondPriceIdentifier, {
        from: maintainer,
      });
      await priceFeed.removePair(computedPriceIdentifier, {
        from: maintainer,
      });
      await priceFeed.removeOracle(secondOracleIndentifier, {
        from: maintainer,
      });
    });
    it('Can revert if price is not supported', async () => {
      await truffleAssert.reverts(
        priceFeed.methods['getLatestPrice(string)']('JRTUSD'),
        'Pair not supported',
      );
    });
    it('Can revert if standard price not supported by implementation', async () => {
      await chainlinkImpl.removePair(priceIdentifier, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        priceFeed.methods['getLatestPrice(string)'](priceIdentifier),
        'Pair not supported',
      );
      await chainlinkImpl.setPair(
        priceIdentifier,
        1,
        chainlinkServer,
        0,
        '0x',
        maxSpread,
        {
          from: maintainer,
        },
      );
    });
    it('Can revert if computed price not supported by an implementation', async () => {
      await priceFeed.addOracle(secondOracleIndentifier, diaOracle.address, {
        from: maintainer,
      });
      await priceFeed.setPair(
        secondPriceIdentifier,
        1,
        secondOracleIndentifier,
        [],
        {
          from: maintainer,
        },
      );
      await priceFeed.setPair(
        computedPriceIdentifier,
        2,
        '',
        [priceIdentifier, secondPriceIdentifier],
        {
          from: maintainer,
        },
      );
      await chainlinkImpl.removePair(priceIdentifier, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        priceFeed.methods['getLatestPrice(string)'](computedPriceIdentifier),
        'Pair not supported',
      );
      await chainlinkImpl.setPair(
        priceIdentifier,
        1,
        chainlinkServer,
        0,
        '0x',
        maxSpread,
        {
          from: maintainer,
        },
      );
      await priceFeed.removePair(secondPriceIdentifier, {
        from: maintainer,
      });
      await priceFeed.removePair(computedPriceIdentifier, {
        from: maintainer,
      });
      await priceFeed.removeOracle(secondOracleIndentifier, {
        from: maintainer,
      });
    });
    it('Can revert if price called by on-chain smart contract not authorized', async () => {
      await truffleAssert.reverts(
        poolMock.getRateFromString(priceFeed.address, priceIdentifier),
        'Only off-chain call',
      );
      await testRegistry.unregister('test', ZERO_ADDRESS, 1, poolMock.address);
      await truffleAssert.reverts(
        poolMock.getRate(priceFeed.address, priceIdentifierHex),
        'Calling contract not registered',
      );
      await testRegistry.register('test', ZERO_ADDRESS, 1, poolMock.address);
    });
    it('Can get multiple prices', async () => {
      await priceFeed.addOracle(secondOracleIndentifier, diaOracle.address, {
        from: maintainer,
      });
      await priceFeed.setPair(
        secondPriceIdentifier,
        1,
        secondOracleIndentifier,
        [],
        {
          from: maintainer,
        },
      );
      await priceFeed.setPair(
        computedPriceIdentifier,
        2,
        '',
        [priceIdentifier, secondPriceIdentifier],
        {
          from: maintainer,
        },
      );
      const pricesFromString = await priceFeed.methods[
        'getLatestPrices(string[])'
      ]([priceIdentifier, computedPriceIdentifier]);
      const pricesFromHex = await priceFeed.methods[
        'getLatestPrices(bytes32[])'
      ]([priceIdentifierHex, computedPriceIdentifierHex]);
      assert.deepEqual(pricesFromString, pricesFromHex, 'Wrong multi-prices');
      assert.deepEqual(
        [
          web3Utils.toBN(mainPrice).toString(),
          web3Utils
            .toBN(mainPrice)
            .mul(web3Utils.toBN(secondPrice))
            .div(web3Utils.toBN(web3Utils.toWei('1')))
            .toString(),
        ],
        [
          web3Utils.toBN(pricesFromHex[0]).toString(),
          web3Utils.toBN(pricesFromHex[1]).toString(),
        ],
      );
      await priceFeed.removeOracle(secondOracleIndentifier, {
        from: maintainer,
      });
    });
  });

  describe('Should get max spread', async () => {
    let mainPrice;
    let secondPrice;
    let poolMock;
    let testRegistry;
    before(async () => {
      await priceFeed.addOracle(oracleIdentifier, chainlinkImpl.address, {
        from: maintainer,
      });
      await priceFeed.setPair(priceIdentifier, 1, oracleIdentifier, [], {
        from: maintainer,
      });
    });
    after(async () => {
      await priceFeed.removeOracle(oracleIdentifier, {
        from: maintainer,
      });
      await priceFeed.removePair(priceIdentifier, {
        from: maintainer,
      });
    });
    it('Can get standard max spread', async () => {
      const maxSpreadFromString = await priceFeed.methods[
        'getMaxSpread(string)'
      ](priceIdentifier);
      const maxSpreadFromHex = await priceFeed.methods['getMaxSpread(bytes32)'](
        priceIdentifierHex,
      );
      assert.equal(
        maxSpreadFromString.toString(),
        maxSpreadFromHex.toString(),
        'Max spreads do not match',
      );
      assert.equal(
        maxSpreadFromHex.toString(),
        web3Utils.toBN(maxSpread).toString(),
        'Max spread wrong',
      );
    });
    it('Can get computed max spread', async () => {
      await priceFeed.addOracle(secondOracleIndentifier, diaOracle.address, {
        from: maintainer,
      });
      await priceFeed.setPair(
        secondPriceIdentifier,
        1,
        secondOracleIndentifier,
        [],
        {
          from: maintainer,
        },
      );
      await priceFeed.setPair(
        computedPriceIdentifier,
        2,
        '',
        [priceIdentifier, secondPriceIdentifier],
        {
          from: maintainer,
        },
      );
      const maxSpreadFromString = await priceFeed.methods[
        'getMaxSpread(string)'
      ](computedPriceIdentifier);
      const maxSpreadFromHex = await priceFeed.methods['getMaxSpread(bytes32)'](
        computedPriceIdentifierHex,
      );
      assert.equal(
        maxSpreadFromString.toString(),
        maxSpreadFromHex.toString(),
        'Max spreads do not match',
      );
      const computedSpread = web3Utils.toBN(web3Utils.toWei('1')).sub(
        web3Utils
          .toBN(web3Utils.toWei('0.998'))
          .mul(web3Utils.toBN(web3Utils.toWei('0.9985')))
          .div(web3Utils.toBN(web3Utils.toWei('1'))),
      );
      assert.equal(
        computedSpread.toString(),
        maxSpreadFromHex.toString(),
        'Max spread wrong',
      );
      await priceFeed.removePair(secondPriceIdentifier, {
        from: maintainer,
      });
      await priceFeed.removePair(computedPriceIdentifier, {
        from: maintainer,
      });
      await priceFeed.removeOracle(secondOracleIndentifier, {
        from: maintainer,
      });
    });
    it('Can revert if price is not supported', async () => {
      await truffleAssert.reverts(
        priceFeed.methods['getMaxSpread(string)']('JRTUSD'),
        'Pair not supported',
      );
    });
  });
});
