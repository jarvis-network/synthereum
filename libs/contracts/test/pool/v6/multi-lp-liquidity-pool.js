const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const ERC20 = artifacts.require('ERC20');
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
const PoolAnalyticsMock = artifacts.require('PoolAnalyticsMock');
const LendingManager = artifacts.require('LendingManager');
const LendingStorageManager = artifacts.require('LendingStorageManager');
const IUniswapRouter = artifacts.require('IUniswapV2Router02');
const {
  encodeMultiLpLiquidityPool,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const PoolV6Data = require('../../../data/test/poolV6.json');

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
  let lpNumber;
  let LPs = [];
  let LPsCollateral = [];
  let LPsOverCollateral = [];
  let genericSender;
  let lendingStorageManagerContract;
  let analyticsMock;
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

  const getCollateralToken = async (user, collateral, collateralAmount) => {
    const deadline = ((Date.now() / 1000) | 0) + 7200;
    const uniswapInstance = await IUniswapRouter.at(
      PoolV6Data[networkId].swapRouter,
    );
    const nativeAmount = web3.utils.toWei('5000');
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

  const checkGlobalData = async (
    pool,
    lps,
    totTokens,
    totCollateral,
    totalLps,
  ) => {
    await network.provider.send('evm_increaseTime', [3000]);
    await network.provider.send('evm_mine');
    const result = await analyticsMock.getAllPoolData.call(pool.address, lps);
    console.log(result);
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
    const sumTotAvailLiquidity = result[3]
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
      sumTotAvailLiquidity.toString(),
      'Wrong result of available liquidity',
    );
    const price = await priceFeedContract.getLatestPrice.call(
      priceIdenitiferBytes,
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
    priceFeedContract = await SynthereumChainlinkPriceFeed.deployed();
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
      LPsCollateral[j] = web3.utils
        .toBN(PoolV6Data[networkId].lpData.collateralAmount[j])
        .mul(web3.utils.toBN(Math.pow(10, collateralDecimals).toString()));
      LPsOverCollateral[j] = web3.utils.toBN(
        web3.utils.toWei(PoolV6Data[networkId].lpData.overCollateral[j]),
      );
    }
    genericSender = accounts[2 + PoolV6Data[networkId].lpNumber];
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
      isLpActive = await poolContract.isActiveLP.call(LPs[0]);
      assert.equal(true, isLpActive, 'Lp not active');
      const activeLps = await poolContract.getActiveLPs.call();
      assert.deepEqual(activeLps, [LPs[0]], 'Wrong active Lps');
      const lpInfo = await poolContract.positionLPInfo.call(LPs[0]);
      await checkGlobalData(
        poolContract,
        [LPs[0]],
        0,
        LPsCollateral[0],
        LPsCollateral[0],
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
        const activateTx = await poolContract.activateLP(
          LPsCollateral[j],
          LPsOverCollateral[j],
          {
            from: LPs[j],
          },
        );
        totalCollateral = totalCollateral.add(LPsCollateral[j]);
        if (j == lpNumber - 1) {
          console.log('Gas used fot activation: ', activateTx.receipt.gasUsed);
        }
      }
      await checkGlobalData(
        poolContract,
        LPs,
        0,
        totalCollateral,
        totalCollateral,
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
});
