//helper scripts
const {
  interfaceName,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toBN, toWei, toHex } = web3Utils;
const {
  encodeLiquidityPool,
  encodeCreditLineDerivative,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumCollateralWhitelist = artifacts.require(
  'SynthereumCollateralWhitelist',
);
const SynthereumIdentifierWhitelist = artifacts.require(
  'SynthereumIdentifierWhitelist',
);
const SynthereumPoolRegistry = artifacts.require('SynthereumPoolRegistry');
const TestnetERC20 = artifacts.require('TestnetERC20');
const ChainlinkPriceFeed = artifacts.require('SynthereumChainlinkPriceFeed');
const MockAggregator = artifacts.require('MockAggregator');
const PriceFeedGetter = artifacts.require('PriceFeedGetter');
const SynthereumLiquidityPool = artifacts.require('SynthereumLiquidityPool');
const CreditLine = artifacts.require('CreditLine');
const WrongTypology = artifacts.require('WrongTypology');
const PoolMock = artifacts.require('PoolMock');
const PoolRegistryMock = artifacts.require('PoolRegistryMock');
const SynthereumLiquidityPoolLib = artifacts.require(
  'SynthereumLiquidityPoolLib',
);
const SynthereumLiquidityPoolFactory = artifacts.require(
  'SynthereumLiquidityPoolFactory',
);
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);

contract('Synthereum chainlink price feed', function (accounts) {
  let collateralAddress;
  let priceFeedIdentifier = 'EURUSD';
  let secondPriceFeedIdentifier = 'GBPUSD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let secondSyntheticName = 'Jarvis Synthetic British Pound';
  let syntheticSymbol = 'jEUR';
  let secondSyntheticSymbol = 'jGBP';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let collateralRequirement = web3Utils.toWei('1.1');
  let liquidationReward = web3Utils.toWei('0.6');
  let overCollateralization = web3Utils.toWei('1.2');
  let capMintAmount = web3Utils.toWei('10000000');
  let minSponsorTokens = web3Utils.toWei('0');
  let excessBeneficiary = accounts[4];
  let synthereumFinderAddress;
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let newAggregatorAddress = accounts[4];
  let secondNewAggregatorAddress = accounts[5];
  let newAggregatorIdentifier = web3Utils.toHex('TEST/USD');
  let feePercentage = '0.002';
  let feePercentageWei;
  let DAO = accounts[5];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  let sender = accounts[6];
  let poolPayload;
  let collateralInstance;
  let poolStartingDeposit = web3Utils.toWei('1000', 'mwei');
  let poolInstance;
  let priceFeedInstance;
  let aggregator;
  let collateralAmount;
  let collateralAmountSelfMinting;
  let numTokens;
  let expiration;
  let priceFeedId;
  before(async () => {
    priceFeedInstance = await ChainlinkPriceFeed.deployed();
    aggregator = await MockAggregator.new(8, 120000000);
    checkingPrice = web3Utils.toWei('1.2');
    priceFeedId = web3Utils.toHex('EURUSD');
    await priceFeedInstance.setPair(
      0,
      web3.utils.utf8ToHex(priceFeedIdentifier),
      aggregator.address,
      [],
      { from: maintainer },
    );
    const synthereumLiquidityPoolLib = await SynthereumLiquidityPoolLib.new();
    await SynthereumLiquidityPoolFactory.link(synthereumLiquidityPoolLib);
    const finder = await SynthereumFinder.deployed();
    poolFactoryInstance = await SynthereumLiquidityPoolFactory.new(
      finder.address,
    );
    const factoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
    await factoryVersioningInstance.setFactory(
      web3.utils.stringToHex('PoolFactory'),
      5,
      poolFactoryInstance.address,
      { from: maintainer },
    );
  });
  describe('Should manage aggregators', async () => {
    it('Can add aggregator', async () => {
      const addAggregatortTx = await priceFeedInstance.setPair(
        0,
        newAggregatorIdentifier,
        newAggregatorAddress,
        [],
        { from: maintainer },
      );
      truffleAssert.eventEmitted(addAggregatortTx, 'SetPair', ev => {
        return (
          ev.priceIdentifier ==
            web3Utils.padRight(newAggregatorIdentifier, 64) &&
          ev.aggregator == newAggregatorAddress &&
          ev.kind == 0
        );
      });
      assert.equal(
        await priceFeedInstance.isPriceSupported.call(newAggregatorIdentifier),
        true,
        'Price identifier not supported',
      );
      await priceFeedInstance.removePair(newAggregatorIdentifier, {
        from: maintainer,
      });
      assert.equal(
        await priceFeedInstance.isPriceSupported.call(newAggregatorIdentifier),
        false,
        'Price identifier supported',
      );
    });
    it('Can update aggregator', async () => {
      await priceFeedInstance.setPair(
        0,
        newAggregatorIdentifier,
        newAggregatorAddress,
        [],
        { from: maintainer },
      );
      const updateAggregatortTx = await priceFeedInstance.setPair(
        0,
        newAggregatorIdentifier,
        secondNewAggregatorAddress,
        [],
        { from: maintainer },
      );
      truffleAssert.eventEmitted(updateAggregatortTx, 'SetPair', ev => {
        return (
          ev.priceIdentifier ==
            web3Utils.padRight(newAggregatorIdentifier, 64) &&
          ev.aggregator == secondNewAggregatorAddress &&
          ev.kind == 0
        );
      });
      await priceFeedInstance.removePair(newAggregatorIdentifier, {
        from: maintainer,
      });
    });
    it('Can revert if the transaction for setting the aggregator is not sent by the maintainer', async () => {
      await truffleAssert.reverts(
        priceFeedInstance.setPair(
          0,
          newAggregatorIdentifier,
          newAggregatorAddress,
          [],
          { from: sender },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can remove aggregator', async () => {
      const addAggregatortTx = await priceFeedInstance.setPair(
        0,
        newAggregatorIdentifier,
        newAggregatorAddress,
        [],
        { from: maintainer },
      );
      const removePairTx = await priceFeedInstance.removePair(
        newAggregatorIdentifier,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(removePairTx, 'RemovePair', ev => {
        return (
          ev.priceIdentifier == web3Utils.padRight(newAggregatorIdentifier, 64)
        );
      });
    });
    it('Can revert if remove a non existing aggregator', async () => {
      await truffleAssert.reverts(
        priceFeedInstance.removePair(newAggregatorIdentifier, {
          from: maintainer,
        }),
        'Price identifier does not exist',
      );
    });
    it('Can revert if the transaction for remove the aggregator is not sent by the maintainer', async () => {
      await priceFeedInstance.setPair(
        0,
        newAggregatorIdentifier,
        newAggregatorAddress,
        [],
        { from: maintainer },
      );
      await truffleAssert.reverts(
        priceFeedInstance.removePair(newAggregatorIdentifier, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
      await priceFeedInstance.removePair(newAggregatorIdentifier, {
        from: maintainer,
      });
    });
    it('Can check get aggreagtor view function', async () => {
      await priceFeedInstance.setPair(
        0,
        newAggregatorIdentifier,
        newAggregatorAddress,
        [],
        { from: maintainer },
      );
      const aggregator = await priceFeedInstance.getAggregator.call(
        newAggregatorIdentifier,
      );
      newAggregatorAddress,
        assert.equal(
          newAggregatorAddress,
          aggregator,
          'Wrong aggregator address',
        );
      await priceFeedInstance.removePair(newAggregatorIdentifier, {
        from: maintainer,
      });
    });
    it('Can revert if get aggregator does not find aggregator', async () => {
      await truffleAssert.reverts(
        priceFeedInstance.getAggregator(newAggregatorIdentifier, {
          from: sender,
        }),
        'Price identifier does not exist',
      );
    });
  });

  describe('Should have access to the price feed', async () => {
    let deployerInstance;
    let poolVersion = 5;
    let selfMintingDerivativeVersion = 2;
    let finderInstance;
    let synthereumFinderAddress;
    let roles = {
      admin,
      maintainer,
      liquidityProvider,
    };
    let collateralInstance;
    let collateralAddress;
    before(async () => {
      deployerInstance = await SynthereumDeployer.deployed();
      poolVersion = 5;
      finderInstance = await SynthereumFinder.deployed();
      synthereumFinderAddress = finderInstance.address;
      collateralInstance = await TestnetERC20.new('Test Token', 'USDC', 6);
      collateralAddress = collateralInstance.address;
      collateralWhitelistInstance = await SynthereumCollateralWhitelist.deployed();
      await collateralWhitelistInstance.addToWhitelist(collateralAddress, {
        from: maintainer,
      });
      identifierWhitelistInstance = await SynthereumIdentifierWhitelist.deployed();
      await identifierWhitelistInstance.addToWhitelist(
        web3.utils.utf8ToHex(priceFeedIdentifier),
        {
          from: maintainer,
        },
      );
    });
    it('Can price be get by an EOA (off-chain)', async () => {
      await priceFeedInstance.getLatestPrice.call(priceFeedId);
    });
    it('Can price be get by a synthereum pool', async () => {
      poolPayload = encodeLiquidityPool(
        collateralAddress,
        syntheticName,
        syntheticSymbol,
        syntheticTokenAddress,
        roles,
        overCollateralization,
        fee,
        priceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
        poolVersion,
      );
      const pool = await deployerInstance.deployPool.call(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      poolInstance = await SynthereumLiquidityPool.at(pool);
      expiration = (await web3.eth.getBlock('latest')).timestamp + 60;
      collateralAmount = web3Utils.toWei('120', 'mwei');
      numTokens = web3Utils.toWei('99.8');
      let MintParameters = {
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        expiration: expiration,
        recipient: sender,
      };
      await collateralInstance.allocateTo(pool, poolStartingDeposit);
      await collateralInstance.allocateTo(sender, collateralAmount);
      await collateralInstance.approve(pool, collateralAmount, {
        from: sender,
      });
      const mintTx = await poolInstance.mint(MintParameters, {
        from: sender,
      });
    });
    it('Can price be get by a self-minting derivative', async () => {
      poolPayload = encodeLiquidityPool(
        collateralAddress,
        syntheticName,
        syntheticSymbol,
        syntheticTokenAddress,
        roles,
        overCollateralization,
        fee,
        priceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
        poolVersion,
      );
      const pool = await deployerInstance.deployPool.call(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      poolInstance = await SynthereumLiquidityPool.at(pool);
      const synthTokenAddress = await poolInstance.syntheticToken.call();
      selfMintingFee = {
        feePercentage,
        feeRecipients,
        feeProportions,
      };
      selfMintingPayload = encodeCreditLineDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        minSponsorTokens,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        selfMintingFee,
        liquidationReward,
        capMintAmount,
      );
      const selfMintingDerivative = await deployerInstance.deploySelfMintingDerivative.call(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await deployerInstance.deploySelfMintingDerivative(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      const selfMintingInstance = await CreditLine.at(selfMintingDerivative);
      collateralAmountSelfMinting = web3Utils.toWei('200', 'mwei');
      await collateralInstance.allocateTo(sender, collateralAmountSelfMinting);
      await collateralInstance.approve(
        selfMintingInstance.address,
        collateralAmountSelfMinting,
        {
          from: sender,
        },
      );
      await selfMintingInstance.create(collateralAmountSelfMinting, numTokens, {
        from: sender,
      });
    });
    it('Can price be get by a an old version of synthereum pool', async () => {
      const oldVersion = 4;
      const oldPool = await PoolMock.new(
        4,
        collateralAddress,
        syntheticSymbol,
        syntheticTokenAddress,
      );
      const tempRegistry = await PoolRegistryMock.new();
      const poolRegistryInterface = web3Utils.stringToHex('PoolRegistry');
      await finderInstance.changeImplementationAddress(
        poolRegistryInterface,
        tempRegistry.address,
        { from: maintainer },
      );
      await tempRegistry.register(
        syntheticSymbol,
        collateralAddress,
        oldVersion,
        oldPool.address,
      );
      const priceResult = await oldPool.getRate.call(
        priceFeedInstance.address,
        web3Utils.toHex(priceFeedIdentifier),
      );
      assert.equal(
        priceResult.toString(),
        checkingPrice.toString(),
        'Wrong price return in old pool',
      );
      await finderInstance.changeImplementationAddress(
        poolRegistryInterface,
        (await SynthereumPoolRegistry.deployed()).address,
        { from: maintainer },
      );
    });
    it('Can revert if price getter is called by a contract that is not a pool', async () => {
      const proxyPriceContract = await PriceFeedGetter.new(
        priceFeedInstance.address,
        'jEUR',
        collateralAddress,
        poolVersion,
      );
      await truffleAssert.reverts(
        proxyPriceContract.getPrice.call(priceFeedId),
        'Calling contract not registered',
      );
    });
    it('Can revert if price getter is called by a contract with a wrong typology', async () => {
      const wrongContract = await WrongTypology.new(priceFeedInstance.address);
      await truffleAssert.reverts(
        wrongContract.getPrice.call(priceFeedId),
        'Typology not supported',
      );
    });
  });
  describe('Should Check price and data getters', async () => {
    let prevAnswer;
    let prevAnswerUnscaled;
    let prevTimestamp;
    let prevRound;
    let newAnswer;
    let newAnswerUnscaled;
    it('Can check latest price', async () => {
      const price = (
        await priceFeedInstance.getLatestPrice.call(priceFeedId)
      ).toString();
      assert.equal(price, checkingPrice, 'Wrong price getter');
    });
    // it('Can check latest data', async () => {
    //   prevRound = (await aggregator.latestRoundData.call()).roundId;
    //   newAnswer = web3Utils.toWei('130', 'mwei');
    //   newAnswerUnscaled = web3Utils.toWei('1.30');
    //   const updateTx = await aggregator.updateAnswer(newAnswer);
    //   txTimestamp = (await web3.eth.getBlock(updateTx.receipt.blockNumber))
    //     .timestamp;
    //   const data = await priceFeedInstance.getOracleLatestData.call(
    //     priceFeedId,
    //   );
    //   assert.equal(data.startedAt, txTimestamp, 'Wrong starting time');
    //   assert.equal(data.updatedAt, txTimestamp, 'Wrong updating time');
    //   assert.equal(data.answer, newAnswer, 'Wrong answer');
    //   assert.equal(
    //     data.roundId,
    //     (parseInt(prevRound) + 1).toString(),
    //     'Wrong round',
    //   );
    //   assert.equal(
    //     data.answeredInRound,
    //     (parseInt(prevRound) + 1).toString(),
    //     'Wrong answer in round',
    //   );
    //   assert.equal(data.decimals, 8, 'Wrong decimals');

    //   prevAnswer = newAnswer;
    //   prevAnswerUnscaled = newAnswerUnscaled;
    //   prevTimestamp = txTimestamp;
    //   prevRound = (parseInt(prevRound) + 1).toString();
    // });
    it('Can check previous round price', async () => {
      prevRound = (await aggregator.latestRoundData.call()).roundId;
      prevRound = (parseInt(prevRound) + 1).toString();
      newAnswer = web3Utils.toWei('130', 'mwei');
      prevAnswerUnscaled = web3Utils.toWei('1.30');
      await aggregator.updateAnswer(newAnswer);

      newAnswer = web3Utils.toWei('140', 'mwei');
      newAnswerUnscaled = web3Utils.toWei('1.40');
      const updateTx = await aggregator.updateAnswer(newAnswer);
      txTimestamp = (await web3.eth.getBlock(updateTx.receipt.blockNumber))
        .timestamp;
      const price = (
        await priceFeedInstance.getRoundPrice.call(priceFeedId, prevRound)
      ).toString();
      assert.equal(price, prevAnswerUnscaled, 'Wrong previous price getter');
      prevRound = (parseInt(prevRound) + 1).toString();
      prevAnswer = newAnswer;
      prevAnswerUnscaled = newAnswerUnscaled;
      prevTimestamp = txTimestamp;
    });
    // it('Can check previous round data', async () => {
    //   const newAnswer = web3Utils.toWei('150', 'mwei');
    //   const updateTx = await aggregator.updateAnswer(newAnswer);
    //   const prevData = await priceFeedInstance.getOracleRoundData.call(
    //     priceFeedId,
    //     prevRound,
    //   );
    //   assert.equal(
    //     prevData.startedAt,
    //     prevTimestamp,
    //     'Wrong previous starting time',
    //   );
    //   assert.equal(
    //     prevData.updatedAt,
    //     prevTimestamp,
    //     'Wrong previous updating time',
    //   );
    //   assert.equal(prevData.answer, prevAnswer, 'Wrong previous answer');
    //   assert.equal(prevData.roundId, prevRound, 'Wrong previous round');
    //   assert.equal(
    //     prevData.answeredInRound,
    //     prevRound,
    //     'Wrong previous answer in round',
    //   );
    //   assert.equal(prevData.decimals, 8, 'Wrong previous decimals');
    // });
    it('Revert if oracle price of aggregator is negative', async () => {
      let newAnswer = web3Utils.toWei('-140', 'mwei');
      const updateTx = await aggregator.updateAnswer(newAnswer);
      await truffleAssert.reverts(
        priceFeedInstance.getLatestPrice.call(priceFeedId),
        'Negative value',
      );
    });
  });

  describe('Inverse price, Computed Price', async () => {
    it('Only maintainer should set a pair', async () => {
      // inverse pair
      let inverseId = web3.utils.utf8ToHex('USDEUR');
      let tx = await priceFeedInstance.setPair(
        1,
        inverseId,
        aggregator.address,
        [],
        { from: maintainer },
      );

      truffleAssert.eventEmitted(tx, 'SetPair', ev => {
        return (
          ev.priceIdentifier == web3Utils.padRight(inverseId, 64) &&
          ev.aggregator == aggregator.address &&
          ev.kind == 1
        );
      });

      let actualStorage = await priceFeedInstance.pairs.call(inverseId);
      assert.equal(actualStorage.isSupported, true);
      assert.equal(actualStorage.priceType, 1);
      assert.equal(actualStorage.aggregator, aggregator.address);
      // assert.equal(actualStorage.intermediatePairs.length, 0);

      await truffleAssert.reverts(
        priceFeedInstance.setPair(1, inverseId, aggregator.address, [], {
          from: accounts[0],
        }),
        'Sender must be the maintainer',
      );

      await truffleAssert.reverts(
        priceFeedInstance.setPair(1, inverseId, ZERO_ADDRESS, [], {
          from: maintainer,
        }),
        'No aggregator set',
      );

      await truffleAssert.reverts(
        priceFeedInstance.setPair(0, inverseId, ZERO_ADDRESS, [], {
          from: maintainer,
        }),
        'No aggregator set',
      );

      await truffleAssert.reverts(
        priceFeedInstance.setPair(
          1,
          inverseId,
          aggregator.address,
          [ZERO_ADDRESS],
          { from: maintainer },
        ),
        'No intermediate pairs should be specified',
      );

      await truffleAssert.reverts(
        priceFeedInstance.setPair(
          0,
          inverseId,
          aggregator.address,
          [ZERO_ADDRESS],
          { from: maintainer },
        ),
        'No intermediate pairs should be specified',
      );

      await truffleAssert.reverts(
        priceFeedInstance.setPair(2, inverseId, aggregator.address, [], {
          from: maintainer,
        }),
        'Aggregator should not be set',
      );

      await truffleAssert.reverts(
        priceFeedInstance.setPair(2, inverseId, ZERO_ADDRESS, [], {
          from: maintainer,
        }),
        'No intermediate pairs set',
      );
    });

    it('Should retrieve the inverse price of a pair', async () => {
      let newPrice = web3Utils.toWei('110', 'mwei');
      // update price
      await aggregator.updateAnswer(newPrice);
      let inverseId = web3.utils.utf8ToHex('USDEUR');

      let expectedInversePrice = toBN(Math.pow(10, 18))
        .mul(toBN(Math.pow(10, 8)))
        .div(toBN(newPrice));

      // call the inverse price
      let actualInversePrice = await priceFeedInstance.getLatestPrice.call(
        inverseId,
      );
      assert.equal(
        actualInversePrice.toString(),
        expectedInversePrice.toString(),
      );
    });
    it('Should retrieve previous round price of an inverse pair', async () => {
      let inverseId = web3.utils.utf8ToHex('USDEUR');
      prevRound = (await aggregator.latestRoundData.call()).roundId;
      prevRound = (parseInt(prevRound) + 1).toString();
      newAnswer = web3Utils.toWei('130', 'mwei');
      prevAnswerUnscaled = web3Utils.toWei('1.30');
      await aggregator.updateAnswer(newAnswer);

      newAnswer = web3Utils.toWei('140', 'mwei');
      newAnswerUnscaled = web3Utils.toWei('1.40');
      const updateTx = await aggregator.updateAnswer(newAnswer);
      txTimestamp = (await web3.eth.getBlock(updateTx.receipt.blockNumber))
        .timestamp;
      const price = (
        await priceFeedInstance.getRoundPrice.call(inverseId, prevRound)
      ).toString();
      let expectedInversePrice = toBN(Math.pow(10, 18))
        .mul(toBN(Math.pow(10, 18)))
        .div(toBN(prevAnswerUnscaled));

      assert.equal(
        price,
        expectedInversePrice.toString(),
        'Wrong previous price getter',
      );
    });
    it('Should retrieve a computed price of a pair', async () => {
      let ETHUSD = web3.utils.utf8ToHex('ETHUSD');
      let jEURUSD = web3.utils.utf8ToHex('jEURUSD');
      let jEURETH = web3.utils.utf8ToHex('jEURETH');
      let USDETH = web3.utils.utf8ToHex('USDETH');

      let ETHUSDPrice = web3Utils.toWei('300000', 'mwei');
      let jEURUSDPrice = web3Utils.toWei('110', 'mwei');

      let ETHUSDAggregator = await MockAggregator.new(8, 120000000);
      let jEURUSDAggregator = await MockAggregator.new(8, 120000000);

      // register aggregators
      await priceFeedInstance.setPair(
        0,
        jEURUSD,
        jEURUSDAggregator.address,
        [],
        { from: maintainer },
      );

      await priceFeedInstance.setPair(0, ETHUSD, ETHUSDAggregator.address, [], {
        from: maintainer,
      });

      await priceFeedInstance.setPair(1, USDETH, ETHUSDAggregator.address, [], {
        from: maintainer,
      });

      // update prices
      await ETHUSDAggregator.updateAnswer(ETHUSDPrice);
      await jEURUSDAggregator.updateAnswer(jEURUSDPrice);

      // register jEUR/ETH pair
      await priceFeedInstance.setPair(
        2,
        jEURETH,
        ZERO_ADDRESS,
        [jEURUSD, USDETH],
        {
          from: maintainer,
        },
      );

      let expectedPrice = toBN(jEURUSDPrice)
        .mul(toBN(Math.pow(10, 18)))
        .div(toBN(ETHUSDPrice));

      let actualPrice = await priceFeedInstance.getLatestPrice.call(jEURETH);
      assert.equal(actualPrice.toString(), expectedPrice.toString());
    });
    it('Should not support round data of a computer pair', async () => {
      let jEURETH = web3.utils.utf8ToHex('jEURETH');

      await truffleAssert.reverts(
        priceFeedInstance.getRoundPrice.call(jEURETH, '2'),
        'Computed price not supported',
      );
    });
  });

  describe('Multi price feeds call', async () => {
    it('Should correctly retrieve multiple latest prices', async () => {
      let USDEUR = web3.utils.utf8ToHex('USDEUR');
      let EURUSDPrice = web3Utils.toWei('140', 'mwei');
      let expectedUSDEUR = toBN(Math.pow(10, 18))
        .mul(toBN(Math.pow(10, 8)))
        .div(toBN(EURUSDPrice));

      let jEURUSD = web3.utils.utf8ToHex('jEURUSD');
      let expectedjEURUSDPriceUnscaled = web3Utils.toWei('1.10');

      let jEURETH = web3.utils.utf8ToHex('jEURETH');
      let expectedjEURETH = web3Utils.toWei('0.000366666666666666');

      let actualPrices = await priceFeedInstance.getLatestPrices.call([
        USDEUR,
        jEURUSD,
        jEURETH,
      ]);

      assert.equal(actualPrices[0].toString(), expectedUSDEUR.toString());
      assert.equal(
        actualPrices[1].toString(),
        expectedjEURUSDPriceUnscaled.toString(),
      );
      assert.equal(actualPrices[2].toString(), expectedjEURETH.toString());
    });
  });
});
