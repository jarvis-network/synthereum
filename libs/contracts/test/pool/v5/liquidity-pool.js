const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const Decimal = require('decimal.js');
const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const TestnetERC20 = artifacts.require('TestnetERC20');
const MintableBurnableSyntheticTokenPermit = artifacts.require(
  'MintableBurnableSyntheticTokenPermit',
);
const SynthereumLiquidityPool = artifacts.require('SynthereumLiquidityPool');
const SynthereumLiquidityPoolLib = artifacts.require(
  'SynthereumLiquidityPoolLib',
);
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const MockAggregator = artifacts.require('MockAggregator');
const PoolRegistryMock = artifacts.require('PoolRegistryMock');

contract('LiquidityPool', function (accounts) {
  let collateralInstance;
  let collateralAddress;
  let synthTokenInstance;
  let synthTokenAddress;
  let finderInstance;
  let finderAddress;
  let liquidityPoolLibInstance;
  let liquidityPoolInstance;
  let liquidityPoolAddress;
  let aggregatorInstance;
  let aggregatorInstanceAddress;
  let poolRegistryInstance;
  let poolRegistryAddress;
  let synthereumFinderInstance;
  let priceFeedInstance;
  const version = 5;
  const admin = accounts[0];
  const maintainer = accounts[1];
  const liquidityProvider = accounts[2];
  const DAO = accounts[3];
  const firstUser = accounts[4];
  const secondUser = accounts[5];
  const thirdUser = accounts[6];
  const roles = {
    admin,
    maintainer,
    liquidityProvider,
  };
  const overCollateralization = web3Utils.toWei('0.25');
  const feePercentageValue = web3Utils.toWei('0.002');
  const feePercentage = { rawValue: feePercentageValue };
  const feeRecipients = [liquidityProvider, DAO];
  const feeProportions = [50, 50];
  const feeTotalProportion = 100;
  const fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  const priceFeedIdentifier = web3Utils.padRight(
    web3Utils.toHex('EUR/USD'),
    64,
  );
  const collateralRequirement = web3Utils.toWei('1.05');
  const liquidationReward = web3Utils.toWei('0.75');
  const synthTokenSymbol = 'jEUR';
  const initialPoolAllocation = web3Utils.toWei('1000', 'mwei');
  const initialUserAllocation = web3Utils.toWei('500', 'mwei');

  const checkResult = async (
    liquidityPool,
    synthToken,
    user,
    userCollBalance,
    userSynthBalance,
    unusedLiquidity,
    totCollateralAmount,
    totSyntheticTokens,
    totFees,
    lpFees,
    daoFees,
    totCollateralInThePool,
  ) => {
    assert.equal(
      (await collateralInstance.balanceOf(user)).toString(),
      userCollBalance,
      'Wrong user collateral balance',
    );
    assert.equal(
      (await synthToken.balanceOf.call(user)).toString(),
      userSynthBalance,
      'Wrong user synth token balance',
    );
    assert.equal(
      (await liquidityPool.totalAvailableLiquidity.call()).toString(),
      unusedLiquidity,
      'Wrong available liquidity',
    );
    assert.equal(
      (await liquidityPool.totalCollateralAmount.call()).toString(),
      totCollateralAmount,
      'Wrong total collateral amount',
    );
    assert.equal(
      (await liquidityPool.totalSyntheticTokens.call()).toString(),
      totSyntheticTokens,
      'Wrong total synthetic tokens amount',
    );
    assert.equal(
      (await liquidityPool.totalFeeAmount.call()).toString(),
      totFees,
      'Wrong total fee amount',
    );
    assert.equal(
      (await liquidityPool.userFee.call(liquidityProvider)).toString(),
      lpFees,
      'Wrong Lp fee amount',
    );
    assert.equal(
      (await liquidityPool.userFee.call(DAO)).toString(),
      daoFees,
      'Wrong Dao fee amount',
    );
    assert.equal(
      (
        await collateralInstance.balanceOf.call(liquidityPool.address)
      ).toString(),
      totCollateralInThePool,
      'Total collateral in the pool amount',
    );
  };

  before(async () => {
    liquidityPoolLibInstance = await SynthereumLiquidityPoolLib.new();
    await SynthereumLiquidityPool.link(liquidityPoolLibInstance);
  });

  beforeEach(async () => {
    collateralInstance = await TestnetERC20.deployed();
    collateralAddress = collateralInstance.address;
    synthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
      'Jarvis Synthetic Euro',
      synthTokenSymbol,
      18,
      { from: admin },
    );
    synthTokenAddress = synthTokenInstance.address;
    finderInstance = await SynthereumFinder.deployed();
    finderAddress = finderInstance.address;
    liquidityPoolInstance = await SynthereumLiquidityPool.new(
      finderAddress,
      version,
      collateralAddress,
      synthTokenAddress,
      roles,
      overCollateralization,
      fee,
      priceFeedIdentifier,
      collateralRequirement,
      liquidationReward,
    );
    liquidityPoolAddress = liquidityPoolInstance.address;
    await synthTokenInstance.addMinter(liquidityPoolAddress, { from: admin });
    await synthTokenInstance.addBurner(liquidityPoolAddress, { from: admin });
    await collateralInstance.allocateTo(
      liquidityPoolAddress,
      initialPoolAllocation,
    );
    await collateralInstance.allocateTo(firstUser, initialUserAllocation);
    await collateralInstance.allocateTo(secondUser, initialUserAllocation);
    priceFeedInstance = await SynthereumChainlinkPriceFeed.deployed();
    aggregatorInstance = await MockAggregator.new(
      8,
      web3Utils.toWei('120', 'mwei'),
    );
    aggregatorInstanceAddress = aggregatorInstance.address;
    await priceFeedInstance.setAggregator(
      priceFeedIdentifier,
      aggregatorInstanceAddress,
      { from: maintainer },
    );
    poolRegistryInstance = await PoolRegistryMock.new();
    poolRegistryAddress = poolRegistryInstance.address;
    synthereumFinderInstance = await SynthereumFinder.deployed();
    await synthereumFinderInstance.changeImplementationAddress(
      web3Utils.toHex('PoolRegistry'),
      poolRegistryAddress,
      { from: maintainer },
    );
    await poolRegistryInstance.register(
      synthTokenSymbol,
      collateralAddress,
      version,
      liquidityPoolAddress,
    );
  });

  describe('Should initialize in the constructor', async () => {
    it('Can initialize variables in the correct way', async () => {
      assert.equal(
        await liquidityPoolInstance.synthereumFinder(),
        finderAddress,
        'Wrong finder initialization',
      );
      assert.equal(
        await liquidityPoolInstance.version(),
        version,
        'Wrong version initialization',
      );
      assert.equal(
        await liquidityPoolInstance.collateralToken(),
        collateralAddress,
        'Wrong collateral initialization',
      );
      assert.equal(
        await liquidityPoolInstance.syntheticToken(),
        synthTokenAddress,
        'Wrong synthetic token initialization',
      );
      assert.equal(
        await liquidityPoolInstance.syntheticTokenSymbol(),
        synthTokenSymbol,
        'Wrong synthetic token symbol',
      );
      assert.equal(
        await liquidityPoolInstance.overCollateralization(),
        overCollateralization,
        'Wrong over-collateralization initialization',
      );
      assert.equal(
        await liquidityPoolInstance.getPriceFeedIdentifier(),
        priceFeedIdentifier,
        'Wrong price feed identifier initialization',
      );
      assert.equal(
        await liquidityPoolInstance.collateralRequirement(),
        collateralRequirement,
        'Wrong collateral requirement initialization',
      );
      assert.equal(
        await liquidityPoolInstance.liquidationReward(),
        liquidationReward,
        'Wrong liquidation reward initialization',
      );
      assert.equal(
        await liquidityPoolInstance.feePercentage(),
        feePercentageValue,
        'Wrong fee percentage initialization',
      );
      const feeInfo = await liquidityPoolInstance.feeRecipientsInfo();
      assert.deepEqual(
        feeInfo[0],
        feeRecipients,
        'Wrong fee recipients initialization',
      );
      assert.deepEqual(
        feeInfo[1].map(fee => parseInt(fee.toString())),
        feeProportions,
        'Wrong fee proportions initialization',
      );
      assert.equal(
        feeInfo[2].toString(),
        web3Utils.toBN(feeTotalProportion).toString(),
        'Wrong fee total proportion initialization',
      );
    });
    it('Can revert if collateral requirement is less than 100% ', async () => {
      const wrongCollateralRequirement = web3Utils.toWei('0.999');
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          wrongCollateralRequirement,
          liquidationReward,
        ),
        'Collateral requirement must be bigger than 100%',
      );
    });
    it('Can revert if overCollateralization is less then Lp part of the collateral', async () => {
      const wrongOverCollateralization = web3Utils.toWei('0.03');
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          wrongOverCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Overcollateralization must be bigger than the Lp part of the collateral requirement',
      );
    });
    it('Can revert if liquidation reward is 0', async () => {
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          0,
        ),
        'Liquidation reward must be between 0 and 100%',
      );
    });
    it('Can revert if liquidation reward is bigger than 100%', async () => {
      const wrongLiquidationReward = web3Utils.toWei('1.01');
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          wrongLiquidationReward,
        ),
        'Liquidation reward must be between 0 and 100%',
      );
    });
    it('Can revert if collateral has more than 18 decimals', async () => {
      const wrongCollateralToken = await TestnetERC20.new(
        'Test token',
        'TEST',
        20,
      );
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          wrongCollateralToken.address,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Collateral has more than 18 decimals',
      );
    });
    it('Can revert if synthetic token has more or less than 18 decimals', async () => {
      let wrongSynthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        synthTokenSymbol,
        16,
        { from: admin },
      );
      let wrongSynthTokenAddress = wrongSynthTokenInstance.address;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          wrongSynthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Synthetic token has more or less than 18 decimals',
      );
      wrongSynthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        synthTokenSymbol,
        20,
        { from: admin },
      );
      wrongSynthTokenAddress = wrongSynthTokenInstance.address;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          wrongSynthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Synthetic token has more or less than 18 decimals',
      );
    });
    it('Can revert if price identifier is not supported by the the price feed', async () => {
      const wrongPriceIdentifier = web3Utils.padRight(
        web3Utils.toHex('EUR/NOT-USD'),
        64,
      );
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          wrongPriceIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Price identifier not supported',
      );
    });
  });

  describe('Should mint synthetic tokens', async () => {
    it('Can mint in the correct way', async () => {
      const collateralAmount = web3Utils.toWei('120', 'mwei');
      const feeAmount = web3Utils.toWei('0.24048', 'mwei');
      const lpAmount = web3Utils.toWei('0.12024', 'mwei');
      const daoAmount = web3Utils.toWei('0.12024', 'mwei');
      const totalCollateralAmount = web3Utils.toWei('120.24048', 'mwei');
      const synthTokens = web3Utils.toWei('100');
      const overCollateralAmount = web3Utils.toWei('30', 'mwei');
      const actualUserCollBalance = await collateralInstance.balanceOf.call(
        firstUser,
      );
      const actualUserSynthBalance = await synthTokenInstance.balanceOf.call(
        firstUser,
      );
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: synthTokens,
        collateralAmount: totalCollateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      const mintTx = await liquidityPoolInstance.mint(mintOperation, {
        from: firstUser,
      });
      console.log('Gas used for initial mint: ' + mintTx.receipt.gasUsed);
      truffleAssert.eventEmitted(mintTx, 'Mint', ev => {
        return (
          ev.account == firstUser &&
          ev.collateralSent == totalCollateralAmount &&
          ev.numTokensReceived == synthTokens &&
          ev.feePaid == feeAmount &&
          ev.recipient == firstUser
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        firstUser,
        web3Utils
          .toBN(actualUserCollBalance)
          .sub(web3Utils.toBN(totalCollateralAmount))
          .toString(),
        web3Utils
          .toBN(actualUserSynthBalance)
          .add(web3Utils.toBN(synthTokens))
          .toString(),
        web3Utils
          .toBN(initialPoolAllocation)
          .sub(web3Utils.toBN(overCollateralAmount))
          .toString(),
        web3Utils
          .toBN(collateralAmount)
          .add(web3Utils.toBN(overCollateralAmount))
          .toString(),
        synthTokens,
        feeAmount,
        lpAmount,
        daoAmount,
        web3Utils
          .toBN(initialPoolAllocation)
          .add(web3Utils.toBN(totalCollateralAmount))
          .toString(),
      );
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      const secondMintTx = await liquidityPoolInstance.mint(mintOperation, {
        from: firstUser,
      });
      console.log(
        'Gas used for standard mint: ' + secondMintTx.receipt.gasUsed,
      );
    });
    it('Can mint in the correct way and redirect tokens to a different address', async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const synthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const initalSynthBalance = await synthTokenInstance.balanceOf.call(
        secondUser,
      );
      const mintOperation = {
        minNumTokens: synthTokens,
        collateralAmount: totalCollateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      const mintTx = await liquidityPoolInstance.mint(mintOperation, {
        from: firstUser,
      });
      assert.equal(
        (await synthTokenInstance.balanceOf.call(secondUser)).toString(),
        web3Utils
          .toBN(initalSynthBalance)
          .add(web3Utils.toBN(synthTokens))
          .toString(),
        'Wrong synth balance with redirection',
      );
    });
    it('Can revert if too much slippage for the tokens received', async () => {
      const totalCollateralAmount = web3Utils.toWei('120.24048', 'mwei');
      const minNumberOfTokens = web3Utils.toWei('100.01');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: minNumberOfTokens,
        collateralAmount: totalCollateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      await truffleAssert.reverts(
        liquidityPoolInstance.mint(mintOperation, {
          from: firstUser,
        }),
        'Number of tokens less than minimum limit',
      );
    });
    it('Can revert if too much slippage for the fee percentage', async () => {
      const totalCollateralAmount = web3Utils.toWei('120.24048', 'mwei');
      const minNumberOfTokens = web3Utils.toWei('100');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const wrongFeePercentageValue = web3Utils.toWei('0.00199');
      const mintOperation = {
        minNumTokens: minNumberOfTokens,
        collateralAmount: totalCollateralAmount,
        feePercentage: wrongFeePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      await truffleAssert.reverts(
        liquidityPoolInstance.mint(mintOperation, {
          from: firstUser,
        }),
        'User fee percentage less than actual one',
      );
    });
    it('Can revert if transaction is expired', async () => {
      const totalCollateralAmount = web3Utils.toWei('120.24048', 'mwei');
      const minNumberOfTokens = web3Utils.toWei('100');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp - 1);
      const mintOperation = {
        minNumTokens: minNumberOfTokens,
        collateralAmount: totalCollateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      await truffleAssert.reverts(
        liquidityPoolInstance.mint(mintOperation, {
          from: firstUser,
        }),
        'Transaction expired',
      );
    });
    it('Can revert if no collateral amount is sent', async () => {
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await truffleAssert.reverts(
        liquidityPoolInstance.mint(mintOperation, {
          from: firstUser,
        }),
        'Sending collateral amount is equal to 0',
      );
    });
    it('Can revert if there is no enough liquidity in the pool', async () => {
      const totalCollateralAmount = web3Utils.toWei('12000', 'mwei');
      await collateralInstance.allocateTo(firstUser, totalCollateralAmount);
      const minNumberOfTokens = web3Utils.toWei('9980');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: minNumberOfTokens,
        collateralAmount: totalCollateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      await truffleAssert.reverts(
        liquidityPoolInstance.mint(mintOperation, {
          from: firstUser,
        }),
        'No enough liquidity for covering mint operation',
      );
    });
  });

  describe('Should redeem synthetic tokens', async () => {
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      await liquidityPoolInstance.mint(mintOperation, {
        from: firstUser,
      });
      await synthTokenInstance.transfer(secondUser, totSynthTokens, {
        from: firstUser,
      });
    });
    it('Can redeeem in the correct way', async () => {
      await aggregatorInstance.updateAnswer(web3Utils.toWei('115', 'mwei'));
      const synthTokens = web3Utils.toWei('50');
      const totalCollateralAmount = web3Utils.toWei('57.5', 'mwei');
      const collateralAmount = web3Utils.toWei('57.385', 'mwei');
      const feeAmount = web3Utils.toWei('0.115', 'mwei');
      const lpFee = web3Utils.toWei('0.0575', 'mwei');
      const daoFee = web3Utils.toWei('0.0575', 'mwei');
      const actualUserCollBalance = await collateralInstance.balanceOf.call(
        secondUser,
      );
      const actualUserSynthBalance = await synthTokenInstance.balanceOf.call(
        secondUser,
      );
      const totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      const totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      const redeemRatio =
        Decimal(synthTokens.toString())
          .div(Decimal(totalSynthTokensInPool.toString()))
          .toFixed(18) * Math.pow(10, 18);
      const freedCollateral = web3Utils
        .toBN(totalCollateralPosition)
        .mul(web3Utils.toBN(redeemRatio))
        .div(web3Utils.toBN(Math.pow(10, 18)))
        .sub(web3Utils.toBN(totalCollateralAmount));
      const availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const totalLpAmount = await liquidityPoolInstance.userFee.call(
        liquidityProvider,
      );
      const totalDaoAmount = await liquidityPoolInstance.userFee.call(DAO);
      const totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const redeeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      const redeemTx = await liquidityPoolInstance.redeem(redeeemOperation, {
        from: secondUser,
      });
      console.log('Gas used for standard redeem: ' + redeemTx.receipt.gasUsed);
      truffleAssert.eventEmitted(redeemTx, 'Redeem', ev => {
        return (
          ev.account == secondUser &&
          ev.numTokensSent == synthTokens &&
          ev.collateralReceived == collateralAmount &&
          ev.feePaid == feeAmount &&
          ev.recipient == secondUser
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        secondUser,
        web3Utils
          .toBN(actualUserCollBalance)
          .add(web3Utils.toBN(collateralAmount))
          .toString(),
        web3Utils
          .toBN(actualUserSynthBalance)
          .sub(web3Utils.toBN(synthTokens))
          .toString(),
        web3Utils.toBN(availableLiquidity).add(freedCollateral).toString(),
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(totalCollateralAmount))
          .sub(web3Utils.toBN(freedCollateral))
          .toString(),
        web3Utils
          .toBN(totalSynthTokensInPool)
          .sub(web3Utils.toBN(synthTokens))
          .toString(),
        web3Utils
          .toBN(totalFeeAmount)
          .add(web3Utils.toBN(feeAmount))
          .toString(),
        web3Utils.toBN(totalLpAmount).add(web3Utils.toBN(lpFee)).toString(),
        web3Utils.toBN(totalDaoAmount).add(web3Utils.toBN(daoFee)).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(collateralAmount))
          .toString(),
      );
    });
    it('Can redeem in the correct way and redirect tokens to a different address', async () => {
      const synthTokens = web3Utils.toWei('50');
      const collateralAmount = web3Utils.toWei('59.88', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const redeeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: thirdUser,
      };
      const userCollBalance = await collateralInstance.balanceOf.call(
        thirdUser,
      );
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await liquidityPoolInstance.redeem(redeeemOperation, {
        from: secondUser,
      });
      assert.equal(
        (await collateralInstance.balanceOf.call(thirdUser)).toString(),
        web3Utils
          .toBN(userCollBalance)
          .add(web3Utils.toBN(collateralAmount))
          .toString(),
      );
    });
    it('Can revert if too much slippage for the collateral received', async () => {
      const synthTokens = web3Utils.toWei('50');
      const collateralAmount = web3Utils.toWei('59.9', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const redeeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeeemOperation, {
          from: secondUser,
        }),
        'Collateral amount less than minimum limit',
      );
    });
    it('Can revert if too much slippage for the fee percentage', async () => {
      const synthTokens = web3Utils.toWei('50');
      const collateralAmount = web3Utils.toWei('59.88', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const wrongFeePercentageValue = web3Utils.toWei('0.018', 'mwei');
      const redeeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        feePercentage: wrongFeePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeeemOperation, {
          from: secondUser,
        }),
        'User fee percentage less than actual one',
      );
    });
    it('Can revert if transaction is expired', async () => {
      const synthTokens = web3Utils.toWei('50');
      const collateralAmount = web3Utils.toWei('59.88', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp - 60);
      const redeeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeeemOperation, {
          from: secondUser,
        }),
        'Transaction expired',
      );
    });
    it('Can revert if no synthetic tokens are sent', async () => {
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const redeeemOperation = {
        numTokens: 0,
        minCollateral: 0,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeeemOperation, {
          from: secondUser,
        }),
        'Sending tokens amount is equal to 0',
      );
    });
    it('Can revert if position becomes undercapitalized', async () => {
      await aggregatorInstance.updateAnswer(web3Utils.toWei('160', 'mwei'));
      const synthTokens = web3Utils.toWei('50');
      const collateralAmount = web3Utils.toWei('79.84', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const redeeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeeemOperation, {
          from: secondUser,
        }),
        'Position undercapitalized',
      );
    });
    it('Can revert if trying to redeem more token than ones generated by the pool', async () => {
      const synthTokens = web3Utils.toWei('150');
      await synthTokenInstance.addMinter(admin, { from: admin });
      await synthTokenInstance.mint(secondUser, synthTokens, { from: admin });
      await synthTokenInstance.renounceMinter({ from: admin });
      const collateralAmount = web3Utils.toWei('179.64', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const redeeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeeemOperation, {
          from: secondUser,
        }),
      );
    });
  });

  describe('Should exchange synthetic tokens', async () => {
    let destSynthTokenInstance;
    let destSynthTokenAddress;
    let destLiquidityPoolInstance;
    let destLiquidityPoolAddress;
    let destAggregatorInstance;
    let destAggregatorAddress;
    const destSynthTokenSymbol = 'jGBP';
    const destPriceFeedIdentifier = web3Utils.padRight(
      web3Utils.toHex('GBP/USD'),
      64,
    );
    const destOverCollateralization = web3Utils.toWei('0.15');
    const sourceRate = web3Utils.toWei('130', 'mwei');
    const destRate = web3Utils.toWei('160', 'mwei');
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('240', 'mwei');
      const totSynthTokens = web3Utils.toWei('199.6');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      await liquidityPoolInstance.mint(mintOperation, {
        from: firstUser,
      });
      destSynthTokenInstance = await await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Sterlin',
        destSynthTokenSymbol,
        18,
        { from: admin },
      );
      destSynthTokenAddress = destSynthTokenInstance.address;
      destAggregatorInstance = await MockAggregator.new(8, destRate);
      destAggregatorAddress = destAggregatorInstance.address;
      await priceFeedInstance.setAggregator(
        destPriceFeedIdentifier,
        destAggregatorAddress,
        { from: maintainer },
      );
      destLiquidityPoolInstance = await SynthereumLiquidityPool.new(
        finderAddress,
        version,
        collateralAddress,
        destSynthTokenAddress,
        roles,
        destOverCollateralization,
        fee,
        destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      );
      destLiquidityPoolAddress = destLiquidityPoolInstance.address;
      await destSynthTokenInstance.addMinter(destLiquidityPoolAddress, {
        from: admin,
      });
      await destSynthTokenInstance.addBurner(destLiquidityPoolAddress, {
        from: admin,
      });
      await collateralInstance.allocateTo(
        destLiquidityPoolAddress,
        initialPoolAllocation,
      );
      await poolRegistryInstance.register(
        destSynthTokenSymbol,
        collateralAddress,
        version,
        destLiquidityPoolAddress,
      );
      await aggregatorInstance.updateAnswer(sourceRate);
    });
    it('Can exchange in the correct way', async () => {
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const totalCollateralAmount = web3Utils.toWei('65', 'mwei');
      const collateralAmount = web3Utils.toWei('64.87', 'mwei');
      const feeAmount = web3Utils.toWei('0.13', 'mwei');
      const daoFee = web3Utils.toWei('0.065', 'mwei');
      const lpFee = web3Utils.toWei('0.065', 'mwei');
      const destOverCollateralAmount = web3Utils
        .toBN(destOverCollateralization)
        .mul(web3Utils.toBN(collateralAmount))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const actualUserCollBalance = await collateralInstance.balanceOf.call(
        firstUser,
      );
      const totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      const totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      const actualUserSynthBalance = await synthTokenInstance.balanceOf.call(
        firstUser,
      );
      const destTotalCollateralPosition = await destLiquidityPoolInstance.totalCollateralAmount.call();
      const destTotalSynthTokensInPool = await destLiquidityPoolInstance.totalSyntheticTokens.call();
      const destActualUserSynthBalance = await destSynthTokenInstance.balanceOf.call(
        firstUser,
      );
      const redeemRatio =
        Decimal(synthTokens.toString())
          .div(Decimal(totalSynthTokensInPool.toString()))
          .toFixed(18) * Math.pow(10, 18);
      const freedCollateral = web3Utils
        .toBN(totalCollateralPosition)
        .mul(web3Utils.toBN(redeemRatio))
        .div(web3Utils.toBN(Math.pow(10, 18)))
        .sub(web3Utils.toBN(totalCollateralAmount));
      const availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const totalLpAmount = await liquidityPoolInstance.userFee.call(
        liquidityProvider,
      );
      const totalDaoAmount = await liquidityPoolInstance.userFee.call(DAO);
      const totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      const destAvailableLiquidity = await destLiquidityPoolInstance.totalAvailableLiquidity.call();
      const destTotalFeeAmount = await destLiquidityPoolInstance.totalFeeAmount.call();
      const destTotalLpAmount = await destLiquidityPoolInstance.userFee.call(
        liquidityProvider,
      );
      const destTotalDaoAmount = await destLiquidityPoolInstance.userFee.call(
        DAO,
      );
      const destTotalPoolBalance = await collateralInstance.balanceOf.call(
        destLiquidityPoolAddress,
      );
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const exchangeOperation = {
        destPool: destLiquidityPoolAddress,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      const exchangeTx = await liquidityPoolInstance.exchange(
        exchangeOperation,
        {
          from: firstUser,
        },
      );
      console.log(
        'Gas used for inital exchange: ' + exchangeTx.receipt.gasUsed,
      );
      truffleAssert.eventEmitted(exchangeTx, 'Exchange', ev => {
        return (
          ev.account == firstUser &&
          ev.destPool == destLiquidityPoolAddress &&
          ev.numTokensSent == synthTokens &&
          ev.destNumTokensReceived == destNumTokens.toString() &&
          ev.feePaid == feeAmount &&
          ev.recipient == firstUser
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        firstUser,
        web3Utils.toBN(actualUserCollBalance),
        web3Utils
          .toBN(actualUserSynthBalance)
          .sub(web3Utils.toBN(synthTokens))
          .toString(),
        web3Utils.toBN(availableLiquidity).add(freedCollateral).toString(),
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(totalCollateralAmount))
          .sub(web3Utils.toBN(freedCollateral))
          .toString(),
        web3Utils
          .toBN(totalSynthTokensInPool)
          .sub(web3Utils.toBN(synthTokens))
          .toString(),
        web3Utils
          .toBN(totalFeeAmount)
          .add(web3Utils.toBN(feeAmount))
          .toString(),
        web3Utils.toBN(totalLpAmount).add(web3Utils.toBN(lpFee)).toString(),
        web3Utils.toBN(totalDaoAmount).add(web3Utils.toBN(daoFee)).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(collateralAmount))
          .toString(),
      );
      await checkResult(
        destLiquidityPoolInstance,
        destSynthTokenInstance,
        firstUser,
        web3Utils.toBN(actualUserCollBalance),
        web3Utils
          .toBN(destActualUserSynthBalance)
          .add(destNumTokens)
          .toString(),
        web3Utils
          .toBN(destAvailableLiquidity)
          .sub(web3Utils.toBN(destOverCollateralAmount))
          .toString(),
        web3Utils
          .toBN(destTotalCollateralPosition)
          .add(web3Utils.toBN(destOverCollateralAmount))
          .add(web3Utils.toBN(collateralAmount))
          .toString(),
        web3Utils
          .toBN(destTotalSynthTokensInPool)
          .add(destNumTokens)
          .toString(),
        web3Utils.toBN(destTotalFeeAmount).toString(),
        web3Utils.toBN(destTotalLpAmount).toString(),
        web3Utils.toBN(destTotalDaoAmount).toString(),
        web3Utils
          .toBN(destTotalPoolBalance)
          .add(web3Utils.toBN(collateralAmount))
          .toString(),
      );
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      const secondExchangeTx = await liquidityPoolInstance.exchange(
        exchangeOperation,
        {
          from: firstUser,
        },
      );
      console.log(
        'Gas used for standard exchange: ' + secondExchangeTx.receipt.gasUsed,
      );
    });
    it('Can exchange in the correct way and redirect tokens to a different address', async () => {
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const destActualUserSynthBalance = await destSynthTokenInstance.balanceOf.call(
        secondUser,
      );
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: destLiquidityPoolAddress,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await liquidityPoolInstance.exchange(exchangeOperation, {
        from: firstUser,
      });
      assert.equal(
        (await destSynthTokenInstance.balanceOf.call(secondUser)).toString(),
        web3Utils
          .toWei(destActualUserSynthBalance)
          .add(destNumTokens)
          .toString(),
        'Wrong destination synthetic balance',
      );
    });
    it('Can revert if too much slippage for the destination tokens received', async () => {
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)))
        .add(web3Utils.toBN('1'));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: destLiquidityPoolAddress,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'Number of destination tokens less than minimum limit',
      );
    });
    it('Can revert if too much slippage for the fee percentage', async () => {
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const wrongFeePercentageValue = web3Utils.toWei('0.0019');
      const exchangeOperation = {
        destPool: destLiquidityPoolAddress,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: wrongFeePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'User fee percentage less than actual one',
      );
    });
    it('Can revert if transaction is expired', async () => {
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp - 60);
      const exchangeOperation = {
        destPool: destLiquidityPoolAddress,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'Transaction expired',
      );
    });
    it('Can revert if no synthetic tokens are sent', async () => {
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: destLiquidityPoolAddress,
        numTokens: 0,
        minDestNumTokens: 0,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'Sending tokens amount is equal to 0',
      );
    });
    it('Can revert if position becomes undercapitalized', async () => {
      await aggregatorInstance.updateAnswer(web3Utils.toWei('160', 'mwei'));
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: destLiquidityPoolAddress,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'Position undercapitalized',
      );
    });
    it('Can revert if source and destination pools are the same', async () => {
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate = Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: liquidityPoolAddress,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'Same source and destination pool',
      );
    });
    it('Can revert if the source and destination pools have different collateral', async () => {
      const wrongCollateralInstance = await TestnetERC20.new(
        'Test Token',
        'USDC',
        18,
      );
      const wrongCollateralAddress = wrongCollateralInstance.address;
      const wrongCollateraLiquidityPoolInstance = await SynthereumLiquidityPool.new(
        finderAddress,
        version,
        wrongCollateralAddress,
        destSynthTokenAddress,
        roles,
        destOverCollateralization,
        fee,
        destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      );
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: wrongCollateraLiquidityPoolInstance.address,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'Collateral tokens do not match',
      );
    });
    it('Can revert if the source and destination pools have different finder', async () => {
      const wrongFinderAddress = accounts[7];
      const wrongFinderLiquidityPoolInstance = await SynthereumLiquidityPool.new(
        wrongFinderAddress,
        version,
        collateralAddress,
        destSynthTokenAddress,
        roles,
        destOverCollateralization,
        fee,
        destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      );
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: wrongFinderLiquidityPoolInstance.address,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'Finders do not match',
      );
    });
    it('Can revert if the destination pool is not registered', async () => {
      const wrongLiquidityPoolInstance = await SynthereumLiquidityPool.new(
        finderAddress,
        version,
        collateralAddress,
        destSynthTokenAddress,
        roles,
        destOverCollateralization,
        fee,
        destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      );
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: wrongLiquidityPoolInstance.address,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'Destination pool not registered',
      );
    });
    it('Can revert if no collateral is sent to the destination pool', async () => {
      await aggregatorInstance.updateAnswer('0');
      const synthTokens = web3Utils.toWei('50');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: destLiquidityPoolAddress,
        numTokens: synthTokens,
        minDestNumTokens: 0,
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'Sending collateral amount is equal to 0',
      );
    });
    it('Can revert if there is no enough liquidity in the destination pool', async () => {
      const underCapitalizedPoolInstance = await SynthereumLiquidityPool.new(
        finderAddress,
        version,
        collateralAddress,
        destSynthTokenAddress,
        roles,
        destOverCollateralization,
        fee,
        destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      );
      await destSynthTokenInstance.addMinter(
        underCapitalizedPoolInstance.address,
        { from: admin },
      );
      await destSynthTokenInstance.addBurner(
        underCapitalizedPoolInstance.address,
        { from: admin },
      );
      await poolRegistryInstance.register(
        destSynthTokenSymbol,
        collateralAddress,
        version,
        underCapitalizedPoolInstance.address,
      );
      await collateralInstance.allocateTo(
        underCapitalizedPoolInstance.address,
        web3Utils.toWei('5', 'mwei'),
      );
      const synthTokens = web3Utils.toWei('50');
      const netSynthTokens = web3Utils.toWei('49.9');
      const exchangeRate =
        Decimal(sourceRate.toString())
          .div(Decimal(destRate.toString()))
          .toFixed(8) * Math.pow(10, 18);
      const destNumTokens = web3Utils
        .toBN(netSynthTokens)
        .mul(web3Utils.toBN(exchangeRate))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: underCapitalizedPoolInstance.address,
        numTokens: synthTokens,
        minDestNumTokens: destNumTokens.toString(),
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: firstUser,
        }),
        'No enough liquidity for cover mint operation',
      );
    });
    it('Can revert if exchange-mint is not called by a pool', async () => {
      const collateralAmount = web3Utils.toWei('12', 'mwei');
      const synthTokens = web3Utils.toWei('10');
      await truffleAssert.reverts(
        liquidityPoolInstance.exchangeMint(
          collateralAmount,
          synthTokens,
          firstUser,
          {
            from: firstUser,
          },
        ),
      );
    });
    it('Can revert if trying to exchange more token than ones generated by the pool', async () => {
      const synthTokens = web3Utils.toWei('200');
      await synthTokenInstance.addMinter(admin, { from: admin });
      await synthTokenInstance.mint(secondUser, synthTokens, { from: admin });
      await synthTokenInstance.renounceMinter({ from: admin });
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: destLiquidityPoolAddress,
        numTokens: synthTokens,
        minDestNumTokens: '0',
        feePercentage: feePercentageValue,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, {
          from: secondUser,
        }),
      );
    });
  });
});
