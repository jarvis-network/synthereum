const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
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
  let poolRegistryInstance;
  let poolRegistryAddress;
  let synthereumFinderInstance;
  const version = 5;
  const admin = accounts[0];
  const maintainer = accounts[1];
  const liquidityProvider = accounts[2];
  const DAO = accounts[3];
  const firstUser = accounts[4];
  const secondUser = accounts[5];
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
      (await synthTokenInstance.balanceOf.call(user)).toString(),
      userSynthBalance,
      'Wrong user synth token balance',
    );
    assert.equal(
      (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
      unusedLiquidity,
      'Wrong available liquidity',
    );
    assert.equal(
      (await liquidityPoolInstance.totalCollateralAmount.call()).toString(),
      totCollateralAmount,
      'Wrong total collateral amount',
    );
    assert.equal(
      (await liquidityPoolInstance.totalSyntheticTokens.call()).toString(),
      totSyntheticTokens,
      'Wrong total synthetic tokens amount',
    );
    assert.equal(
      (await liquidityPoolInstance.totalFeeAmount.call()).toString(),
      totFees,
      'Wrong total fee amount',
    );
    assert.equal(
      (await liquidityPoolInstance.userFee.call(liquidityProvider)).toString(),
      lpFees,
      'Wrong Lp fee amount',
    );
    assert.equal(
      (await liquidityPoolInstance.userFee.call(DAO)).toString(),
      daoFees,
      'Wrong Dao fee amount',
    );
    assert.equal(
      (
        await collateralInstance.balanceOf.call(liquidityPoolAddress)
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
    aggregatorInstance = await MockAggregator.deployed();
    await aggregatorInstance.updateAnswer(web3Utils.toWei('120', 'mwei'));
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
});
