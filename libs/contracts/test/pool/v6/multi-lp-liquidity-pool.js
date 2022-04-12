const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const ERC20 = artifacts.require('ERC20');
const MintableBurnableERC20 = artifacts.require('MintableBurnableERC20');
const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumCollateralWhitelist = artifacts.require(
  'SynthereumCollateralWhitelist',
);
const SynthereumIdentifierWhitelist = artifacts.require(
  'SynthereumIdentifierWhitelist',
);
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const SynthereumMultiLpLiquidityPool = artifacts.require(
  'SynthereumMultiLpLiquidityPool',
);
const SynthereumManager = artifacts.require('SynthereumManager');
const PoolAnalyticsMock = artifacts.require('PoolAnalyticsMock');
const LendingManager = artifacts.require('LendingManager');
const LendingStorageManager = artifacts.require('LendingStorageManager');
const IUniswapRouter = artifacts.require('IUniswapV2Router02');
const MockOnChainOracle = artifacts.require('MockOnChainOracle');
const {
  encodeMultiLpLiquidityPool,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const PoolV6Data = require('../../../data/test/poolV6.json');
const { network } = require('hardhat');

contract('MultiLPLiquidityPool', function (accounts) {
  let networkId;
  let collateralContract;
  let collateralAddress;
  let collateralDecimals;
  let deployer;
  let poolDataPayload;
  let poolContract;
  let poolAddress;
  let synthFinder;
  let syntheFinderAddress;
  let collateralWhiteListInstance;
  let identifierWhiteListInstance;
  let priceFeedContract;
  let chainlinkAggregator;
  let managerContract;
  let syntTokenContract;
  let syntTokenAddress;
  let lpNumber;
  let LPs = [];
  let LPsCollateral = [];
  let LPsOverCollateral = [];
  let lendingStorageManagerContract;
  let analyticsMock;
  let sender;
  let receiver;
  let genericSender;
  const admin = accounts[0];
  const maintainer = accounts[1];
  const roles = {
    admin: admin,
    maintainer: maintainer,
  };
  const priceIdentifier = 'EURUSD';
  const priceIdenitiferBytes = web3.utils.padRight(
    web3.utils.toHex(priceIdentifier),
    64,
  );
  const synthTokenName = 'Jarvis Synthetic Euro';
  const synthTokenSymbol = 'jEUR';
  const feePercentage = '0.0015';
  const feePercentageWei = web3.utils.toWei(feePercentage);
  const overCollateralRequirement = web3.utils.toWei('0.05');
  const liquidationReward = web3.utils.toWei('0.7');
  const lendingId = 'AaveV3';
  const daoInterestShare = web3.utils.toWei('0.1');
  const jrtBuybackShare = web3.utils.toWei('0.6');
  const poolVersion = 6;
  const preciseUnit = Math.pow(10, 18);
  const maxTime = web3.utils.toBN(Math.pow(10, 18)).toString();

  const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  };

  const getCollateralToken = async (user, collateral, collateralAmount) => {
    const deadline = ((Date.now() / 1000) | 0) + 1000000000;
    const uniswapInstance = await IUniswapRouter.at(
      PoolV6Data[networkId].swapRouter,
    );
    const nativeAmount = web3.utils.toWei('1000000');
    const actualBalance = await web3.eth.getBalance(user);
    const newTotal = web3.utils
      .toBN(nativeAmount)
      .add(web3.utils.toBN(actualBalance));
    await network.provider.send('hardhat_setBalance', [
      user,
      web3.utils.toHex(newTotal.toString()),
    ]);
    await uniswapInstance.swapETHForExactTokens(
      collateralAmount,
      [PoolV6Data[networkId].nativeWrapper, collateral],
      user,
      deadline,
      {
        value: nativeAmount,
        from: user,
      },
    );
  };

  const setPoolPrice = async price => {
    const orcaleContract = await MockOnChainOracle.new(18);
    await orcaleContract.setPrice(
      priceIdenitiferBytes,
      web3.utils.toWei(price),
    );
    await synthFinder.changeImplementationAddress(
      web3.utils.stringToHex('PriceFeed'),
      orcaleContract.address,
      { from: maintainer },
    );
  };

  const resetOracle = async () => {
    await synthFinder.changeImplementationAddress(
      web3.utils.stringToHex('PriceFeed'),
      priceFeedContract.address,
      { from: maintainer },
    );
  };

  const calculateFeeAndSynthAssetForMint = async (feePrc, collateralAmount) => {
    const price = await priceFeedContract.getLatestPrice.call(
      priceIdenitiferBytes,
    );
    const feeAmount = collateralAmount
      .mul(web3.utils.toBN(feePrc))
      .div(web3.utils.toBN(preciseUnit));
    const netAmount = collateralAmount.sub(feeAmount);
    const tokensAmount = netAmount
      .mul(web3.utils.toBN(Math.pow(10, 18 - collateralDecimals).toString()))
      .mul(web3.utils.toBN(preciseUnit))
      .div(web3.utils.toBN(price));
    return { feeAmount, netAmount, tokensAmount };
  };

  const calculateFeeAndSynthAssetForRedeem = async (feePrc, tokensAmount) => {
    const price = await priceFeedContract.getLatestPrice.call(
      priceIdenitiferBytes,
    );
    const collAmount = tokensAmount
      .mul(web3.utils.toBN(price))
      .div(web3.utils.toBN(preciseUnit))
      .div(web3.utils.toBN(Math.pow(10, 18 - collateralDecimals).toString()));
    const feeAmount = collAmount
      .mul(web3.utils.toBN(feePrc))
      .div(web3.utils.toBN(preciseUnit));
    const netAmount = collAmount.sub(feeAmount);
    return { feeAmount, netAmount, collAmount };
  };

  const checkUserBalance = async (token, user, expectedBalance) => {
    const balance = await token.balanceOf(user);
    return balance;
    assert.equal(
      expectedBalance.toString(),
      balance.toString(),
      'Wrong user balance',
    );
  };

  const checkGlobalData = async (
    pool,
    lps,
    totTokens,
    totCollateral,
    totalLps,
    price,
    timeTravel,
  ) => {
    if (timeTravel != 0) {
      await network.provider.send('evm_increaseTime', [timeTravel]);
      await network.provider.send('evm_mine');
    }
    console.log('RESULT AFTER: ' + timeTravel + ' seconds');
    const result = await analyticsMock.getAllPoolData.call(pool.address, lps);
    console.log(result[0], result[1], result[2], result[4]);
    const _totTokens = result[2][0];
    assert.equal(
      _totTokens.toString(),
      totTokens.toString(),
      'Wrong total tokens in the pool',
    );
    const collateralInfo = result[1];
    assert.equal(
      web3.utils.toBN(collateralInfo[2]).gte(web3.utils.toBN(totCollateral)),
      true,
      'Wrong result of total collateral in the pool',
    );
    assert.equal(
      web3.utils.toBN(collateralInfo[1]).gte(web3.utils.toBN(totalLps)),
      true,
      'Wrong result of total LPs collateral in the pool',
    );

    const sumLpsTokens = result[3]
      .map(elem => {
        return web3.utils.toBN(elem[1]);
      })
      .reduce((a, b) => a.add(b), web3.utils.toBN('0'));
    const sumLpsCollateral = result[3]
      .map(elem => {
        return web3.utils.toBN(elem[0]);
      })
      .reduce((a, b) => a.add(b), web3.utils.toBN('0'));
    const sumTotCapacity = result[3]
      .map(elem => {
        return web3.utils.toBN(elem[3]);
      })
      .reduce((a, b) => a.add(b), web3.utils.toBN('0'));
    assert.equal(
      _totTokens.toString(),
      sumLpsTokens.toString(),
      'Wrong total LPs tokens in the pool',
    );
    assert.equal(
      collateralInfo[1].toString(),
      sumLpsCollateral.toString(),
      'Wrong result of LPs collateral in the pool',
    );
    assert.equal(
      result[2][1].toString(),
      sumTotCapacity.toString(),
      'Wrong result of capacity',
    );
    const decimals = await pool.collateralTokenDecimals.call();
    const usersValue = web3.utils
      .toBN(price)
      .mul(web3.utils.toBN(_totTokens))
      .div(web3.utils.toBN(preciseUnit.toString()))
      .div(web3.utils.toBN(Math.pow(10, 18 - decimals).toString()));
    assert.equal(
      usersValue.toString(),
      collateralInfo[0].toString(),
      'Wrong total users collateral in the pool',
    );
    assert.equal(
      collateralInfo[2].toString(),
      web3.utils
        .toBN(collateralInfo[0])
        .add(web3.utils.toBN(collateralInfo[1]))
        .toString(),
      'Wrong total splitted collateral in the pool',
    );
    const poolData = result[0];
    const interests = result[4];
    assert.equal(
      web3.utils
        .toBN(poolData[5])
        .add(web3.utils.toBN(interests[0]))
        .toString(),
      collateralInfo[2].toString(),
      'Wrong total collateral in the manager storage',
    );
    const poolBearingBalance = result[2][2];
    const bearingValue = result[2][4];
    assert.equal(
      poolBearingBalance.toString(),
      bearingValue.toString(),
      'Wrong total bearing amount in the pool',
    );
    const poolCollBalance = result[2][3];
    assert.equal(
      poolCollBalance.toString(),
      '0',
      'Collateral in the pool not 0',
    );
  };

  const allLpsAboveCollateralization = async (pool, lps) => {
    const result = await analyticsMock.getAllPoolData.call(pool.address, lps);
    for (let j = 0; j < result[3].length; j++) {
      assert.equal(result[3][j][8], true, 'Lp below overCollateral limit');
    }
  };

  const allLpsAboveOwnOverCollateral = async (pool, lps) => {
    const result = await analyticsMock.getAllPoolData.call(pool.address, lps);
    for (let j = 0; j < result[3].length; j++) {
      assert.equal(result[3][j][3] > 0, true, 'Lp below own overCollateral');
    }
  };

  before(async () => {
    networkId = await web3.eth.net.getId();
    collateralContract = await ERC20.at(PoolV6Data[networkId].collateral);
    collateralAddress = collateralContract.address;
    collateralDecimals = await collateralContract.decimals.call();
    collateralWhiteListInstance = await SynthereumCollateralWhitelist.deployed();
    await collateralWhiteListInstance.addToWhitelist(collateralAddress, {
      from: maintainer,
    });
    identifierWhiteListInstance = await SynthereumIdentifierWhitelist.deployed();
    await identifierWhiteListInstance.addToWhitelist(
      web3.utils.utf8ToHex(priceIdentifier),
      { from: maintainer },
    );
    synthFinder = await SynthereumFinder.deployed();
    syntheFinderAddress = synthFinder.address;
    deployer = await SynthereumDeployer.deployed();
    managerContract = await SynthereumManager.deployed();
    priceFeedContract = await SynthereumChainlinkPriceFeed.deployed();
    chainlinkAggregator = await priceFeedContract.getAggregator.call(
      priceIdenitiferBytes,
    );
    poolDataPayload = encodeMultiLpLiquidityPool(
      poolVersion,
      collateralAddress,
      synthTokenName,
      synthTokenSymbol,
      ZERO_ADDRESS,
      roles,
      feePercentage,
      priceIdentifier,
      overCollateralRequirement,
      liquidationReward,
      lendingId,
      ZERO_ADDRESS,
      daoInterestShare,
      jrtBuybackShare,
    );
    lpNumber = PoolV6Data[networkId].lpNumber;
    for (let j = 0; j < lpNumber; j++) {
      LPs[j] = accounts[j + 2];
      LPsCollateral[j] = web3.utils.toBN(
        parseInt(
          PoolV6Data[networkId].lpData.collateralAmount[j] *
            Math.pow(10, collateralDecimals),
        ).toString(),
      );
      LPsOverCollateral[j] = web3.utils.toBN(
        web3.utils.toWei(PoolV6Data[networkId].lpData.overCollateral[j]),
      );
    }
    genericSender = accounts[2 + lpNumber];
    sender = accounts[3 + lpNumber];
    receiver = accounts[4 + lpNumber];
    lendingStorageManagerContract = await LendingStorageManager.deployed();
    lendingManagerContract = await LendingManager.deployed();
    analyticsMock = await PoolAnalyticsMock.new(syntheFinderAddress);
  });

  beforeEach(async () => {
    poolAddress = await deployer.deployPool.call(poolVersion, poolDataPayload, {
      from: maintainer,
    });
  });

  describe('Should initialize pool', async () => {
    it('Can deploy', async () => {
      await deployer.deployPool(poolVersion, poolDataPayload, {
        from: maintainer,
      });
      poolContract = await SynthereumMultiLpLiquidityPool.at(poolAddress);
      const version = await poolContract.version.call();
      assert.equal(version, poolVersion, 'Wrong version');
      const finder = await poolContract.synthereumFinder.call();
      assert.equal(finder, syntheFinderAddress, 'Wrong finder');
      const collateral = await poolContract.collateralToken.call();
      assert.equal(collateral, collateralAddress, 'Wrong collateral');
      const synthToken = await poolContract.syntheticToken.call();
      const synthTokenInstance = await ERC20.at(synthToken);
      const tokenName = await synthTokenInstance.name.call();
      assert.equal(tokenName, synthTokenName, 'Wrong synthetic name');
      const symbol = await poolContract.syntheticTokenSymbol.call();
      assert.equal(symbol, synthTokenSymbol, 'Wrong synth symbol');
      const lendingProtocolInfo = await poolContract.lendingProtocolInfo.call();
      assert.equal(lendingId, lendingProtocolInfo[0], 'Wrong lending id');
      const collateralRequirement = await poolContract.collateralRequirement.call();
      assert.equal(
        collateralRequirement.toString(),
        web3.utils
          .toBN(overCollateralRequirement)
          .add(web3.utils.toBN(web3.utils.toWei('1')))
          .toString(),
        'Wrong overCollateral',
      );
      const liqReward = await poolContract.liquidationReward.call();
      assert.equal(
        liqReward.toString(),
        liquidationReward.toString(),
        'Wrong liquidation reward',
      );
      const identifier = await poolContract.priceFeedIdentifier.call();
      assert.equal(identifier, priceIdenitiferBytes, 'Wrong price identifier');
      const feePrc = await poolContract.feePercentage.call();
      assert.equal(
        feePrc.toString(),
        feePercentageWei.toString(),
        'Wrong fee percentage',
      );
    });
    it('Can revert if trying to re-initialize pool', async () => {
      await deployer.deployPool(poolVersion, poolDataPayload, {
        from: maintainer,
      });
      poolContract = await SynthereumMultiLpLiquidityPool.at(poolAddress);
      const InitializationParams = {
        finder: syntheFinderAddress,
        version: poolVersion,
        collateralToken: collateralAddress,
        syntheticToken: ZERO_ADDRESS,
        roles: roles,
        fee: feePercentageWei,
        priceIdentifier: priceIdenitiferBytes,
        overCollateralRequirement: overCollateralRequirement,
        liquidationReward: liquidationReward,
        lendingModuleId: lendingId,
      };
      await truffleAssert.reverts(
        poolContract.initialize(InitializationParams),
        'Pool already initialized',
      );
    });
    it('Can revert if overCollateral is 0', async () => {
      const wrongPoolPayload = encodeMultiLpLiquidityPool(
        poolVersion,
        collateralAddress,
        synthTokenName,
        synthTokenSymbol,
        ZERO_ADDRESS,
        roles,
        feePercentage,
        priceIdentifier,
        0,
        liquidationReward,
        lendingId,
        ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      );
      await truffleAssert.reverts(
        deployer.deployPool(poolVersion, wrongPoolPayload, {
          from: maintainer,
        }),
        'Overcollateral requirement must be bigger than 0%',
      );
    });
    it('Can revert if collateral more than 18 decimals', async () => {
      const testToken = await TestnetERC20.new('Test token', 'TEST', 19);
      await collateralWhiteListInstance.addToWhitelist(testToken.address, {
        from: maintainer,
      });
      const wrongPoolPayload = encodeMultiLpLiquidityPool(
        poolVersion,
        testToken.address,
        synthTokenName,
        synthTokenSymbol,
        ZERO_ADDRESS,
        roles,
        feePercentage,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingId,
        ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      );
      await truffleAssert.reverts(
        deployer.deployPool(poolVersion, wrongPoolPayload, {
          from: maintainer,
        }),
        'Collateral has more than 18 decimals',
      );
      await collateralWhiteListInstance.removeFromWhitelist(testToken.address, {
        from: maintainer,
      });
    });
    it('Can revert if synth token has more than 18 decimals', async () => {
      const testToken = await TestnetERC20.new(
        synthTokenName,
        synthTokenSymbol,
        19,
      );
      const wrongPoolPayload = encodeMultiLpLiquidityPool(
        poolVersion,
        collateralAddress,
        synthTokenName,
        synthTokenSymbol,
        testToken.address,
        roles,
        feePercentage,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingId,
        ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      );
      await truffleAssert.reverts(
        deployer.deployPool(poolVersion, wrongPoolPayload, {
          from: maintainer,
        }),
        'Synthetic token has more or less than 18 decimals',
      );
    });
    it('Can revert if synth token has less than 18 decimals', async () => {
      const testToken = await TestnetERC20.new(
        synthTokenName,
        synthTokenSymbol,
        17,
      );
      const wrongPoolPayload = encodeMultiLpLiquidityPool(
        poolVersion,
        collateralAddress,
        synthTokenName,
        synthTokenSymbol,
        testToken.address,
        roles,
        feePercentage,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingId,
        ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      );
      await truffleAssert.reverts(
        deployer.deployPool(poolVersion, wrongPoolPayload, {
          from: maintainer,
        }),
        'Synthetic token has more or less than 18 decimals',
      );
    });
    it('Can revert if price feed is not supported', async () => {
      const aggregator = await priceFeedContract.getAggregator.call(
        priceIdenitiferBytes,
      );
      await priceFeedContract.removeAggregator(priceIdenitiferBytes, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        deployer.deployPool(poolVersion, poolDataPayload, {
          from: maintainer,
        }),
        'Price identifier not supported',
      );
      await priceFeedContract.setAggregator(priceIdenitiferBytes, aggregator, {
        from: maintainer,
      });
    });
  });

  describe('Should register LP', async () => {
    beforeEach(async () => {
      await deployer.deployPool(poolVersion, poolDataPayload, {
        from: maintainer,
      });
      poolContract = await SynthereumMultiLpLiquidityPool.at(poolAddress);
    });
    it('Can register new LP', async () => {
      let isLpRegistered = await poolContract.isRegisteredLP.call(LPs[0]);
      assert.equal(false, isLpRegistered, 'Lp is registred');
      const registerTx = await poolContract.registerLP(LPs[0], {
        from: maintainer,
      });
      truffleAssert.eventEmitted(registerTx, 'RegisteredLp', ev => {
        return ev.lp == LPs[0];
      });
      isLpRegistered = await poolContract.isRegisteredLP.call(LPs[0]);
      assert.equal(true, isLpRegistered, 'Lp not registred');
      const registeredLps = await poolContract.getRegisteredLPs.call();
      assert.deepEqual(registeredLps, [LPs[0]], 'Wrong registered Lps');
    });
    it('Can revert if the sender is not the maintainer', async () => {
      await truffleAssert.reverts(
        poolContract.registerLP(LPs[0], {
          from: genericSender,
        }),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if trying to register an already regitred LP', async () => {
      await poolContract.registerLP(LPs[0], {
        from: maintainer,
      });
      await truffleAssert.reverts(
        poolContract.registerLP(LPs[0], {
          from: maintainer,
        }),
        'LP already registered',
      );
    });
  });

  describe('Should activate LP', async () => {
    beforeEach(async () => {
      await deployer.deployPool(poolVersion, poolDataPayload, {
        from: maintainer,
      });
      poolContract = await SynthereumMultiLpLiquidityPool.at(poolAddress);
    });
    it('Can activate a registered LP - edge case with no active LPs', async () => {
      await poolContract.registerLP(LPs[0], {
        from: maintainer,
      });
      let isLpActive = await poolContract.isActiveLP.call(LPs[0]);
      assert.equal(false, isLpActive, 'Lp is active');
      await getCollateralToken(LPs[0], collateralAddress, LPsCollateral[0]);
      await collateralContract.approve(poolAddress, LPsCollateral[0], {
        from: LPs[0],
      });
      const prevBalance = await collateralContract.balanceOf.call(LPs[0]);
      const activateTx = await poolContract.activateLP(
        LPsCollateral[0],
        LPsOverCollateral[0],
        {
          from: LPs[0],
        },
      );
      truffleAssert.eventEmitted(activateTx, 'ActivatedLP', ev => {
        return ev.lp == LPs[0];
      });
      truffleAssert.eventEmitted(activateTx, 'DepositedLiquidity', ev => {
        return (
          ev.lp == LPs[0] &&
          ev.collateralSent.toString() == LPsCollateral[0].toString() &&
          ev.collateralDeposited.toString() == LPsCollateral[0].toString()
        );
      });
      truffleAssert.eventEmitted(activateTx, 'SetOvercollateralization', ev => {
        return (
          ev.lp == LPs[0] &&
          ev.overCollateralization.toString() == LPsOverCollateral[0].toString()
        );
      });
      const temp = await poolContract.positionLPInfo.call(LPs[0]);
      isLpActive = await poolContract.isActiveLP.call(LPs[0]);
      assert.equal(true, isLpActive, 'Lp not active');
      const activeLps = await poolContract.getActiveLPs.call();
      assert.deepEqual(activeLps, [LPs[0]], 'Wrong active Lps');
      const lpInfo = await poolContract.positionLPInfo.call(LPs[0]);
      await checkUserBalance(
        collateralContract,
        LPs[0],
        web3.utils.toBN(prevBalance).sub(LPsCollateral[0]),
      );
      const price = await priceFeedContract.getLatestPrice.call(
        priceIdenitiferBytes,
      );
      await checkGlobalData(
        poolContract,
        [LPs[0]],
        0,
        LPsCollateral[0],
        LPsCollateral[0],
        price,
        0,
      );
      await checkGlobalData(
        poolContract,
        [LPs[0]],
        0,
        LPsCollateral[0],
        LPsCollateral[0],
        price,
        getRandomInt(3600, 24 * 7 * 3600),
      );
    });
    it('Can activate a registered LP - with active LPs', async () => {
      let totalCollateral = web3.utils.toBN('0');
      for (let j = 0; j < lpNumber; j++) {
        await poolContract.registerLP(LPs[j], {
          from: maintainer,
        });
        await getCollateralToken(LPs[j], collateralAddress, LPsCollateral[j]);
        await collateralContract.approve(poolAddress, LPsCollateral[j], {
          from: LPs[j],
        });
        const prevBalance = await collateralContract.balanceOf.call(LPs[j]);
        const activateTx = await poolContract.activateLP(
          LPsCollateral[j],
          LPsOverCollateral[j],
          {
            from: LPs[j],
          },
        );
        await checkUserBalance(
          collateralContract,
          LPs[j],
          web3.utils.toBN(prevBalance).sub(LPsCollateral[j]),
        );
        totalCollateral = totalCollateral.add(LPsCollateral[j]);
        if (j == lpNumber - 1) {
          console.log('Gas used fot activation: ', activateTx.receipt.gasUsed);
        }
      }
      const price = await priceFeedContract.getLatestPrice.call(
        priceIdenitiferBytes,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        0,
        totalCollateral,
        totalCollateral,
        price,
        0,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        0,
        totalCollateral,
        totalCollateral,
        price,
        getRandomInt(3600, 24 * 7 * 3600),
      );
    });
    it('Can revert if sender is not a registered LP', async () => {
      await getCollateralToken(LPs[0], collateralAddress, LPsCollateral[0]);
      await collateralContract.approve(poolAddress, LPsCollateral[0], {
        from: LPs[0],
      });
      await truffleAssert.reverts(
        poolContract.activateLP(LPsCollateral[0], LPsOverCollateral[0], {
          from: LPs[0],
        }),
        'Sender must be a registered LP',
      );
    });
    it('Can revert if collateral deposited is zero', async () => {
      await poolContract.registerLP(LPs[0], {
        from: maintainer,
      });
      await getCollateralToken(LPs[0], collateralAddress, LPsCollateral[0]);
      await collateralContract.approve(poolAddress, LPsCollateral[0], {
        from: LPs[0],
      });
      await truffleAssert.reverts(
        poolContract.activateLP(0, web3.utils.toWei('1.045'), {
          from: LPs[0],
        }),
        'No collateral deposited',
      );
    });
    it('Can revert if LP overcollateralization is lesst then overcollateral requirement', async () => {
      await poolContract.registerLP(LPs[0], {
        from: maintainer,
      });
      await getCollateralToken(LPs[0], collateralAddress, LPsCollateral[0]);
      await collateralContract.approve(poolAddress, LPsCollateral[0], {
        from: LPs[0],
      });
      await truffleAssert.reverts(
        poolContract.activateLP(LPsCollateral[0], web3.utils.toWei('0.045'), {
          from: LPs[0],
        }),
        'Overcollateralization must be bigger than Overcollateral requirement',
      );
    });
    it('Can revert if an already active LP try to activate', async () => {
      await poolContract.registerLP(LPs[0], {
        from: maintainer,
      });
      await getCollateralToken(LPs[0], collateralAddress, LPsCollateral[0]);
      await collateralContract.approve(poolAddress, LPsCollateral[0], {
        from: LPs[0],
      });
      await poolContract.activateLP(LPsCollateral[0], LPsOverCollateral[0], {
        from: LPs[0],
      });
      await getCollateralToken(LPs[0], collateralAddress, LPsCollateral[0]);
      await collateralContract.approve(poolAddress, LPsCollateral[0], {
        from: LPs[0],
      });
      await truffleAssert.reverts(
        poolContract.activateLP(LPsCollateral[0], LPsOverCollateral[0], {
          from: LPs[0],
        }),
        'LP already active',
      );
    });
  });

  describe('Should mint', async () => {
    let totalCollateral = web3.utils.toBN('0');
    beforeEach(async () => {
      await deployer.deployPool(poolVersion, poolDataPayload, {
        from: maintainer,
      });
      poolContract = await SynthereumMultiLpLiquidityPool.at(poolAddress);
      for (let j = 0; j < lpNumber; j++) {
        await poolContract.registerLP(LPs[j], {
          from: maintainer,
        });
        await getCollateralToken(LPs[j], collateralAddress, LPsCollateral[j]);
        await collateralContract.approve(poolAddress, LPsCollateral[j], {
          from: LPs[j],
        });
        const activateTx = await poolContract.activateLP(
          LPsCollateral[j],
          LPsOverCollateral[j],
          {
            from: LPs[j],
          },
        );
        totalCollateral = totalCollateral.add(LPsCollateral[j]);
        await network.provider.send('evm_increaseTime', [3600]);
      }
      syntTokenAddress = await poolContract.syntheticToken.call();
      syntTokenContract = await ERC20.at(syntTokenAddress);
    });
    afterEach(async () => {
      totalCollateral = web3.utils.toBN('0');
    });
    it('Can mint', async () => {
      const collateralAmount = web3.utils
        .toBN('300')
        .mul(web3.utils.toBN(Math.pow(10, collateralDecimals).toString()));
      await getCollateralToken(sender, collateralAddress, collateralAmount);
      await collateralContract.approve(poolAddress, collateralAmount, {
        from: sender,
      });
      const prevSenderBalance = await collateralContract.balanceOf.call(sender);
      const prevReceiverBalance = await syntTokenContract.balanceOf.call(
        receiver,
      );
      let mintParams = {
        minNumTokens: 0,
        collateralAmount: collateralAmount.toString(),
        expiration: maxTime.toString(),
        recipient: receiver,
      };
      let mintTx = await poolContract.mint(mintParams, {
        from: sender,
      });
      let tokensMinted;
      truffleAssert.eventEmitted(mintTx, 'Minted', ev => {
        tokensMinted = web3.utils.toBN(ev.mintvalues[3].toString());
        return (
          ev.user == sender &&
          ev.mintvalues[0].toString() == collateralAmount.toString() &&
          ev.recipient == receiver
        );
      });
      await checkUserBalance(
        collateralContract,
        sender,
        web3.utils.toBN(prevSenderBalance).sub(collateralAmount),
      );
      await checkUserBalance(
        syntTokenContract,
        receiver,
        web3.utils.toBN(prevReceiverBalance).add(tokensMinted),
      );
      const price = await priceFeedContract.getLatestPrice.call(
        priceIdenitiferBytes,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        tokensMinted,
        collateralAmount.add(totalCollateral),
        totalCollateral,
        price,
        0,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        tokensMinted,
        collateralAmount.add(totalCollateral),
        totalCollateral,
        price,
        getRandomInt(3600, 24 * 7 * 3600),
      );
      const secondCollAmount = web3.utils
        .toBN('200')
        .mul(web3.utils.toBN(Math.pow(10, collateralDecimals).toString()));
      await getCollateralToken(sender, collateralAddress, secondCollAmount);
      await collateralContract.approve(poolAddress, secondCollAmount, {
        from: sender,
      });
      mintParams.collateralAmount = secondCollAmount.toString();
      mintTx = await poolContract.mint(mintParams, {
        from: sender,
      });
      let secTokensMinted;
      truffleAssert.eventEmitted(mintTx, 'Minted', ev => {
        secTokensMinted = web3.utils.toBN(ev.mintvalues[3].toString());
        return (
          ev.user == sender &&
          ev.mintvalues[0].toString() == secondCollAmount.toString() &&
          ev.recipient == receiver
        );
      });
      await checkGlobalData(
        poolContract,
        LPs,
        secTokensMinted.add(tokensMinted),
        collateralAmount.add(totalCollateral).add(secondCollAmount),
        totalCollateral,
        price,
        0,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        secTokensMinted.add(tokensMinted),
        collateralAmount.add(totalCollateral).add(secondCollAmount),
        totalCollateral,
        price,
        getRandomInt(3600, 24 * 7 * 3600),
      );
      console.log('Gas used for mint tx: ', mintTx.receipt.gasUsed);
    });
    it('Can revert if the transaction is expired', async () => {
      const collateralAmount = web3.utils
        .toBN('300')
        .mul(web3.utils.toBN(Math.pow(10, collateralDecimals).toString()));
      await getCollateralToken(sender, collateralAddress, collateralAmount);
      await collateralContract.approve(poolAddress, collateralAmount, {
        from: sender,
      });
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp - 60);
      const mintParams = {
        minNumTokens: 0,
        collateralAmount: collateralAmount.toString(),
        expiration: expirationTime,
        recipient: receiver,
      };
      await truffleAssert.reverts(
        poolContract.mint(mintParams, {
          from: sender,
        }),
        'Transaction expired',
      );
    });
    it('Can revert if collateral amount is zero', async () => {
      const collateralAmount = '0';
      const mintParams = {
        minNumTokens: 0,
        collateralAmount: collateralAmount,
        expiration: maxTime.toString(),
        recipient: receiver,
      };
      await truffleAssert.reverts(
        poolContract.mint(mintParams, {
          from: sender,
        }),
        'No collateral sent',
      );
    });
    it('Can revert if tokens received less than minimum set', async () => {
      const collateralAmount = web3.utils
        .toBN('300')
        .mul(web3.utils.toBN(Math.pow(10, collateralDecimals).toString()));
      await getCollateralToken(sender, collateralAddress, collateralAmount);
      await collateralContract.approve(poolAddress, collateralAmount, {
        from: sender,
      });
      const mintReturnValues = await calculateFeeAndSynthAssetForMint(
        feePercentageWei,
        collateralAmount,
      );
      const minTokensAmount = mintReturnValues.tokensAmount;
      const mintParams = {
        minNumTokens: minTokensAmount
          .add(web3.utils.toBN(web3.utils.toWei('1')))
          .toString(),
        collateralAmount: collateralAmount.toString(),
        expiration: maxTime.toString(),
        recipient: receiver,
      };
      await truffleAssert.reverts(
        poolContract.mint(mintParams, {
          from: sender,
        }),
        'Number of tokens less than minimum limit',
      );
    });
    it('Can revert if not enough capacity in the pool', async () => {
      await poolContract.setFee('0', { from: maintainer });
      const price = '1';
      await setPoolPrice(price);
      const exceedingApproval = web3.utils.toBN('100').mul(totalCollateral);
      await getCollateralToken(sender, collateralAddress, exceedingApproval);
      await collateralContract.approve(
        analyticsMock.address,
        exceedingApproval,
        {
          from: sender,
        },
      );
      await truffleAssert.reverts(
        analyticsMock.depositCapacity(
          poolContract.address,
          web3.utils.toWei(price),
          true,
          '2',
          { from: sender },
        ),
        'No enough liquidity for covering mint operation',
      );
      await poolContract.setFee(feePercentageWei, { from: maintainer });
      await resetOracle();
    });
    it('Can check all Lps are above the collateralization level after mint', async () => {
      await poolContract.setFee('0', { from: maintainer });
      const price = '1';
      await setPoolPrice(price);
      const exceedingApproval = web3.utils.toBN('100').mul(totalCollateral);
      await getCollateralToken(sender, collateralAddress, exceedingApproval);
      await collateralContract.approve(
        analyticsMock.address,
        exceedingApproval,
        {
          from: sender,
        },
      );
      await analyticsMock.depositCapacity(
        poolContract.address,
        web3.utils.toWei(price),
        false,
        '2',
        { from: sender },
      );
      const preCapacity = await analyticsMock.preCapacity.call();
      const postCapacity = await analyticsMock.postCapacity.call();
      const collAmount = await analyticsMock.collAmount.call();
      const tokensMinted = await analyticsMock.tokensMinted.call();
      assert.equal(
        web3.utils
          .toBN(preCapacity)
          .sub(web3.utils.toBN(tokensMinted))
          .toString(),
        web3.utils.toBN(postCapacity).toString(),
        'Wrong capacity post deposit',
      );
      await allLpsAboveCollateralization(poolContract, LPs);
      await allLpsAboveOwnOverCollateral(poolContract, LPs);
      await checkGlobalData(
        poolContract,
        LPs,
        web3.utils.toBN(tokensMinted),
        web3.utils.toBN(collAmount).add(totalCollateral),
        totalCollateral,
        web3.utils.toBN(web3.utils.toWei(price)),
        0,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        web3.utils.toBN(tokensMinted),
        web3.utils.toBN(collAmount).add(totalCollateral),
        totalCollateral,
        web3.utils.toBN(web3.utils.toWei(price)),
        getRandomInt(3600, 24 * 7 * 3600),
      );
      await poolContract.setFee(feePercentageWei, { from: maintainer });
      await resetOracle();
    });
  });

  describe('Should redeem', async () => {
    let totalCollateral = web3.utils.toBN('0');
    let collateralAmount;
    let mintTokens;
    beforeEach(async () => {
      await deployer.deployPool(poolVersion, poolDataPayload, {
        from: maintainer,
      });
      poolContract = await SynthereumMultiLpLiquidityPool.at(poolAddress);
      for (let j = 0; j < lpNumber; j++) {
        await poolContract.registerLP(LPs[j], {
          from: maintainer,
        });
        await getCollateralToken(LPs[j], collateralAddress, LPsCollateral[j]);
        await collateralContract.approve(poolAddress, LPsCollateral[j], {
          from: LPs[j],
        });
        const activateTx = await poolContract.activateLP(
          LPsCollateral[j],
          LPsOverCollateral[j],
          {
            from: LPs[j],
          },
        );
        totalCollateral = totalCollateral.add(LPsCollateral[j]);
        await network.provider.send('evm_increaseTime', [3600]);
      }
      syntTokenAddress = await poolContract.syntheticToken.call();
      syntTokenContract = await MintableBurnableERC20.at(syntTokenAddress);
      collateralAmount = web3.utils
        .toBN('200')
        .mul(web3.utils.toBN(Math.pow(10, collateralDecimals).toString()));
      await getCollateralToken(sender, collateralAddress, collateralAmount);
      await collateralContract.approve(poolAddress, collateralAmount, {
        from: sender,
      });
      const mintParams = {
        minNumTokens: 0,
        collateralAmount: collateralAmount.toString(),
        expiration: maxTime.toString(),
        recipient: sender,
      };
      await poolContract.mint(mintParams, {
        from: sender,
      });
      mintTokens = await poolContract.totalSyntheticTokens.call();
    });
    afterEach(async () => {
      totalCollateral = web3.utils.toBN('0');
    });

    it('Can redeem', async () => {
      const tokensAmount = web3.utils.toBN(web3.utils.toWei('100'));
      const redeemReturnValues = await calculateFeeAndSynthAssetForRedeem(
        feePercentageWei,
        tokensAmount,
      );
      const prevSenderBalance = await syntTokenContract.balanceOf.call(sender);
      const prevReceiverBalance = await collateralContract.balanceOf.call(
        receiver,
      );
      const redeemParams = {
        numTokens: tokensAmount.toString(),
        minCollateral: '0',
        expiration: maxTime.toString(),
        recipient: receiver,
      };
      await syntTokenContract.approve(poolAddress, tokensAmount, {
        from: sender,
      });
      const redeemTx = await poolContract.redeem(redeemParams, {
        from: sender,
      });
      let collateralRedeemed;
      truffleAssert.eventEmitted(redeemTx, 'Redeemed', ev => {
        collateralRedeemed = web3.utils.toBN(ev.redeemvalues[3].toString());
        return (
          ev.user == sender &&
          ev.redeemvalues[0].toString() == tokensAmount.toString() &&
          ev.redeemvalues[1].toString() ==
            redeemReturnValues.collAmount.toString() &&
          ev.redeemvalues[2].toString() ==
            redeemReturnValues.feeAmount.toString() &&
          ev.recipient == receiver
        );
      });
      await checkUserBalance(
        collateralContract,
        receiver,
        web3.utils.toBN(prevReceiverBalance).add(collateralRedeemed),
      );
      await checkUserBalance(
        syntTokenContract,
        sender,
        web3.utils.toBN(prevSenderBalance).sub(tokensAmount),
      );
      const price = await priceFeedContract.getLatestPrice.call(
        priceIdenitiferBytes,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        web3.utils.toBN(mintTokens).sub(tokensAmount),
        collateralAmount.add(totalCollateral).sub(redeemReturnValues.netAmount),
        totalCollateral,
        price,
        0,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        web3.utils.toBN(mintTokens).sub(tokensAmount),
        collateralAmount.add(totalCollateral).sub(redeemReturnValues.netAmount),
        totalCollateral,
        price,
        getRandomInt(3600, 24 * 7 * 3600),
      );
      console.log('Gas used for redeem tx: ', redeemTx.receipt.gasUsed);
    });
    it('Can redeem all synthetic tokens', async () => {
      const redeemReturnValues = await calculateFeeAndSynthAssetForRedeem(
        feePercentageWei,
        mintTokens,
      );
      const prevSenderBalance = await syntTokenContract.balanceOf.call(sender);
      const prevReceiverBalance = await collateralContract.balanceOf.call(
        receiver,
      );
      const redeemParams = {
        numTokens: mintTokens.toString(),
        minCollateral: '0',
        expiration: maxTime.toString(),
        recipient: receiver,
      };
      await syntTokenContract.approve(poolAddress, mintTokens, {
        from: sender,
      });
      const redeemTx = await poolContract.redeem(redeemParams, {
        from: sender,
      });
      let collateralRedeemed;
      truffleAssert.eventEmitted(redeemTx, 'Redeemed', ev => {
        collateralRedeemed = web3.utils.toBN(ev.redeemvalues[3].toString());
        return (
          ev.user == sender &&
          ev.redeemvalues[0].toString() == mintTokens.toString() &&
          ev.redeemvalues[1].toString() ==
            redeemReturnValues.collAmount.toString() &&
          ev.redeemvalues[2].toString() ==
            redeemReturnValues.feeAmount.toString() &&
          ev.recipient == receiver
        );
      });
      await checkUserBalance(
        collateralContract,
        receiver,
        web3.utils.toBN(prevReceiverBalance).add(collateralRedeemed),
      );
      await checkUserBalance(
        syntTokenContract,
        sender,
        web3.utils.toBN(prevSenderBalance).sub(mintTokens),
      );
      const price = await priceFeedContract.getLatestPrice.call(
        priceIdenitiferBytes,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        '0',
        collateralAmount.add(totalCollateral).sub(redeemReturnValues.netAmount),
        totalCollateral,
        price,
        0,
      );
      await checkGlobalData(
        poolContract,
        LPs,
        '0',
        collateralAmount.add(totalCollateral).sub(redeemReturnValues.netAmount),
        totalCollateral,
        price,
        getRandomInt(3600, 24 * 7 * 3600),
      );
    });
    it('Can revert if the transaction is expired', async () => {
      const tokensAmount = web3.utils.toBN(web3.utils.toWei('100'));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp - 60);
      const redeemParams = {
        numTokens: tokensAmount.toString(),
        minCollateral: '0',
        expiration: expirationTime.toString(),
        recipient: receiver,
      };
      await truffleAssert.reverts(
        poolContract.redeem(redeemParams, {
          from: sender,
        }),
        'Transaction expired',
      );
    });
    it('Can revert if no tokens are sent', async () => {
      const redeemParams = {
        numTokens: '0',
        minCollateral: '0',
        expiration: maxTime.toString(),
        recipient: receiver,
      };
      await truffleAssert.reverts(
        poolContract.redeem(redeemParams, {
          from: sender,
        }),
        'No tokens sent',
      );
    });
    it('Can revert if collateral received less than minimum set', async () => {
      const tokensAmount = web3.utils.toBN(web3.utils.toWei('100'));
      const redeemReturnValues = await calculateFeeAndSynthAssetForRedeem(
        feePercentageWei,
        tokensAmount,
      );
      const minAmount = redeemReturnValues.netAmount.add(
        web3.utils
          .toBN('2')
          .mul(web3.utils.toBN(Math.pow(10, collateralDecimals).toString())),
      );
      const redeemParams = {
        numTokens: tokensAmount.toString(),
        minCollateral: minAmount.toString(),
        expiration: maxTime.toString(),
        recipient: receiver,
      };
      await syntTokenContract.approve(poolAddress, tokensAmount, {
        from: sender,
      });
      await truffleAssert.reverts(
        poolContract.redeem(redeemParams, {
          from: sender,
        }),
        'Collateral amount less than minimum limit',
      );
    });
    it('Can revert if trying to redeem more amount of synth asset than one in the pool', async () => {
      await managerContract.grantSynthereumRole(
        [syntTokenAddress],
        [web3.utils.soliditySha3('Minter')],
        [sender],
        { from: maintainer },
      );
      const synthAmountMinted = web3.utils.toWei('1');
      await syntTokenContract.mint(sender, synthAmountMinted, { from: sender });
      await managerContract.revokeSynthereumRole(
        [syntTokenAddress],
        [web3.utils.soliditySha3('Minter')],
        [sender],
        { from: maintainer },
      );
      const totalTokens = web3.utils
        .toBN(mintTokens)
        .add(web3.utils.toBN(synthAmountMinted));
      const redeemParams = {
        numTokens: totalTokens.toString(),
        minCollateral: '0',
        expiration: maxTime.toString(),
        recipient: receiver,
      };
      await syntTokenContract.approve(poolAddress, totalTokens, {
        from: sender,
      });
      await truffleAssert.reverts(
        poolContract.redeem(redeemParams, {
          from: sender,
        }),
      );
    });
  });
});
