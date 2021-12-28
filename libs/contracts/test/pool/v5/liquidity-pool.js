const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const web3Utils = require('web3-utils');
const Web3EthAbi = require('web3-eth-abi');
const truffleAssert = require('truffle-assertions');
const { mnemonicToPrivateKey } = require('@jarvis-network/crypto-utils');
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
const SynthereumManager = artifacts.require('SynthereumManager');
const MockAggregator = artifacts.require('MockAggregator');
const PoolRegistryMock = artifacts.require('PoolRegistryMock');
const SynthereumTrustedForwarder = artifacts.require(
  'SynthereumTrustedForwarder',
);
const MockContext = artifacts.require('MockContext');
const {
  mintV5Encoding,
  redeemV5Encoding,
  exchangeV5Encoding,
  withdrawLiquidityV5Encoding,
  increaseCollateralV5Encoding,
  decreaseCollateralV5Encoding,
  generateForwarderSignature,
  claimFeeV5Encoding,
  liquidateV5Encoding,
  settleEmergencyShutdownV5Encoding,
} = require('../../../utils/metaTx.js');

contract('LiquidityPool', function (accounts) {
  let collateralInstance;
  let collateralToken;
  let synthTokenInstance;
  let syntheticToken;
  let finderInstance;
  let finder;
  let liquidityPoolLibInstance;
  let liquidityPoolInstance;
  let liquidityPoolAddress;
  let aggregatorInstance;
  let aggregatorInstanceAddress;
  let poolRegistryInstance;
  let poolRegistryAddress;
  let priceFeedInstance;
  let managerInstance;
  let params;
  const version = 5;
  const admin = accounts[0];
  const maintainer = accounts[1];
  const liquidityProvider = accounts[2];
  const DAO = accounts[3];
  const firstUser = accounts[4];
  const secondUser = accounts[5];
  const thirdUser = accounts[6];
  const relayer = accounts[7];
  const roles = {
    admin,
    maintainer,
    liquidityProvider,
  };
  const overCollateralization = web3Utils.toWei('0.25');
  const feeDataPercentageValue = web3Utils.toWei('0.002');
  const feePercentage = { rawValue: feeDataPercentageValue };
  const feeRecipients = [liquidityProvider, DAO];
  const feeProportions = [50, 50];
  const feeDataTotalProportion = 100;
  const feeData = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  const priceIdentifier = web3Utils.padRight(web3Utils.toHex('EUR/USD'), 64);
  const collateralRequirement = web3Utils.toWei('1.05');
  const liquidationReward = web3Utils.toWei('0.75');
  const syntheticName = 'Jarvis Synthetic Euro';
  const syntheticSymbol = 'jEUR';
  const initialPoolAllocation = web3Utils.toWei('1000', 'mwei');
  const initialUserAllocation = web3Utils.toWei('500', 'mwei');
  const MAX_GAS = 12000000;
  const mnemonic =
    'test test test test test test test test test test test junk';

  const checkResult = async (
    liquidityPool,
    syntheticToken,
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
      (await syntheticToken.balanceOf.call(user)).toString(),
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
      'Wrong total feeData amount',
    );
    assert.equal(
      (await liquidityPool.userFee.call(liquidityProvider)).toString(),
      lpFees,
      'Wrong Lp feeData amount',
    );
    assert.equal(
      (await liquidityPool.userFee.call(DAO)).toString(),
      daoFees,
      'Wrong Dao feeData amount',
    );
    assert.equal(
      (
        await collateralInstance.balanceOf.call(liquidityPool.address)
      ).toString(),
      totCollateralInThePool,
      'Total collateral in the pool amount',
    );
  };

  const checkBalances = async liquidityPool => {
    const availableLiquidity = await liquidityPool.totalAvailableLiquidity.call();
    const totCollAmount = await liquidityPool.totalCollateralAmount.call();
    const totalFees = await liquidityPool.totalFeeAmount.call();
    const poolBalance = await collateralInstance.balanceOf(
      liquidityPool.address,
    );
    assert.equal(
      poolBalance.toString(),
      web3Utils
        .toBN(availableLiquidity)
        .add(web3Utils.toBN(totCollAmount))
        .add(web3Utils.toBN(totalFees))
        .toString(),
      'Wrong balances',
    );
  };

  before(async () => {
    liquidityPoolLibInstance = await SynthereumLiquidityPoolLib.new();
    await SynthereumLiquidityPool.link(liquidityPoolLibInstance);
  });

  beforeEach(async () => {
    collateralInstance = await TestnetERC20.new('Test Token', 'USDC', 6);
    collateralToken = collateralInstance.address;
    synthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
      syntheticName,
      syntheticSymbol,
      18,
      { from: admin },
    );
    syntheticToken = synthTokenInstance.address;
    finderInstance = await SynthereumFinder.deployed();
    finder = finderInstance.address;
    priceFeedInstance = await SynthereumChainlinkPriceFeed.deployed();
    aggregatorInstance = await MockAggregator.new(
      8,
      web3Utils.toWei('120', 'mwei'),
    );
    aggregatorInstanceAddress = aggregatorInstance.address;
    await priceFeedInstance.setAggregator(
      priceIdentifier,
      aggregatorInstanceAddress,
      { from: maintainer },
    );
    params = {
      finder,
      version,
      collateralToken,
      syntheticToken,
      roles,
      overCollateralization,
      feeData,
      priceIdentifier,
      collateralRequirement,
      liquidationReward,
    };
    liquidityPoolInstance = await SynthereumLiquidityPool.new(params, {
      from: admin,
    });
    liquidityPoolAddress = liquidityPoolInstance.address;
    await synthTokenInstance.addMinter(liquidityPoolAddress, { from: admin });
    await synthTokenInstance.addBurner(liquidityPoolAddress, { from: admin });
    await collateralInstance.allocateTo(
      liquidityPoolAddress,
      initialPoolAllocation,
    );
    await collateralInstance.allocateTo(firstUser, initialUserAllocation);
    await collateralInstance.allocateTo(secondUser, initialUserAllocation);
    await collateralInstance.allocateTo(
      liquidityProvider,
      initialUserAllocation,
    );
    poolRegistryInstance = await PoolRegistryMock.new();
    poolRegistryAddress = poolRegistryInstance.address;
    await finderInstance.changeImplementationAddress(
      web3Utils.toHex('PoolRegistry'),
      poolRegistryAddress,
      { from: maintainer },
    );
    await poolRegistryInstance.register(
      syntheticSymbol,
      collateralToken,
      version,
      liquidityPoolAddress,
    );
    managerInstance = await SynthereumManager.deployed();
  });

  describe('Should initialize in the constructor', async () => {
    it('Can initialize variables in the correct way', async () => {
      assert.equal(
        await liquidityPoolInstance.synthereumFinder(),
        finder,
        'Wrong finder initialization',
      );
      assert.equal(
        await liquidityPoolInstance.version(),
        version,
        'Wrong version initialization',
      );
      assert.equal(
        await liquidityPoolInstance.collateralToken(),
        collateralToken,
        'Wrong collateral initialization',
      );
      assert.equal(
        await liquidityPoolInstance.syntheticToken(),
        syntheticToken,
        'Wrong synthetic token initialization',
      );
      assert.equal(
        await liquidityPoolInstance.syntheticTokenSymbol(),
        syntheticSymbol,
        'Wrong synthetic token symbol',
      );
      assert.equal(
        await liquidityPoolInstance.overCollateralization(),
        overCollateralization,
        'Wrong over-collateralization initialization',
      );
      assert.equal(
        await liquidityPoolInstance.getPriceFeedIdentifier(),
        priceIdentifier,
        'Wrong price feeDatad identifier initialization',
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
        feeDataPercentageValue,
        'Wrong feeData percentage initialization',
      );
      const feeDataInfo = await liquidityPoolInstance.feeRecipientsInfo();
      assert.deepEqual(
        feeDataInfo[0],
        feeRecipients,
        'Wrong feeData recipients initialization',
      );
      assert.deepEqual(
        feeDataInfo[1].map(feeData => parseInt(feeData.toString())),
        feeProportions,
        'Wrong feeData proportions initialization',
      );
      assert.equal(
        feeDataInfo[2].toString(),
        web3Utils.toBN(feeDataTotalProportion).toString(),
        'Wrong feeData total proportion initialization',
      );
    });
    it('Can revert if collateral requirement is less than 100% ', async () => {
      const wrongCollateralRequirement = web3Utils.toWei('0.999');
      const wrongParams = params;
      wrongParams.collateralRequirement = wrongCollateralRequirement;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(wrongParams),
        'Collateral requirement must be bigger than 100%',
      );
    });
    it('Can revert if overCollateralization is less then Lp part of the collateral', async () => {
      const wrongOverCollateralization = web3Utils.toWei('0.03');
      const wrongParams = params;
      wrongParams.overCollateralization = wrongOverCollateralization;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(wrongParams),
        'Overcollateralization must be bigger than the Lp part of the collateral requirement',
      );
    });
    it('Can revert if liquidation reward is 0', async () => {
      const wrongParams = params;
      wrongParams.liquidationReward = 0;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(wrongParams),
        'Liquidation reward must be between 0 and 100%',
      );
    });
    it('Can revert if liquidation reward is bigger than 100%', async () => {
      const wrongParams = params;
      const wrongLiquidationReward = web3Utils.toWei('1.01');
      wrongParams.liquidationReward = wrongLiquidationReward;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(wrongParams),
        'Liquidation reward must be between 0 and 100%',
      );
    });
    it('Can revert if collateral has more than 18 decimals', async () => {
      const wrongParams = params;
      const wrongCollateralToken = await TestnetERC20.new(
        'Test token',
        'TEST',
        20,
      );
      wrongParams.collateralToken = wrongCollateralToken.address;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(wrongParams),
        'Collateral has more than 18 decimals',
      );
    });
    it('Can revert if synthetic token has more or less than 18 decimals', async () => {
      let wrongParams = params;
      let wrongSynthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        syntheticSymbol,
        16,
        { from: admin },
      );
      let wrongSynthTokenAddress = wrongSynthTokenInstance.address;
      wrongParams.syntheticToken = wrongSynthTokenAddress;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(wrongParams),
        'Synthetic token has more or less than 18 decimals',
      );
      wrongSynthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        syntheticSymbol,
        20,
        { from: admin },
      );
      wrongSynthTokenAddress = wrongSynthTokenInstance.address;
      wrongParams.syntheticToken = wrongSynthTokenAddress;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(wrongParams),
        'Synthetic token has more or less than 18 decimals',
      );
    });
    it('Can revert if price identifier is not supported by the the price feeDatad', async () => {
      const wrongParams = params;
      const wrongPriceIdentifier = web3Utils.padRight(
        web3Utils.toHex('EUR/NOT-USD'),
        64,
      );
      wrongParams.priceIdentifier = wrongPriceIdentifier;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(wrongParams),
        'Price identifier not supported',
      );
    });
  });

  describe('Should mint synthetic tokens', async () => {
    it('Can mint in the correct way', async () => {
      const collateralAmount = web3Utils.toWei('120', 'mwei');
      const feeDataAmount = web3Utils.toWei('0.24048', 'mwei');
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
          ev.feePaid == feeDataAmount &&
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
        feeDataAmount,
        lpAmount,
        daoAmount,
        web3Utils
          .toBN(initialPoolAllocation)
          .add(web3Utils.toBN(totalCollateralAmount))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
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
    it('Can revert if transaction is expired', async () => {
      const totalCollateralAmount = web3Utils.toWei('120.24048', 'mwei');
      const minNumberOfTokens = web3Utils.toWei('100');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp - 1);
      const mintOperation = {
        minNumTokens: minNumberOfTokens,
        collateralAmount: totalCollateralAmount,
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
    it('Can redeem in the correct way', async () => {
      await aggregatorInstance.updateAnswer(web3Utils.toWei('115', 'mwei'));
      const synthTokens = web3Utils.toWei('50');
      const totalCollateralAmount = web3Utils.toWei('57.5', 'mwei');
      const collateralAmount = web3Utils.toWei('57.385', 'mwei');
      const feeDataAmount = web3Utils.toWei('0.115', 'mwei');
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
      const redeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      const redeemTx = await liquidityPoolInstance.redeem(redeemOperation, {
        from: secondUser,
      });
      console.log('Gas used for standard redeem: ' + redeemTx.receipt.gasUsed);
      truffleAssert.eventEmitted(redeemTx, 'Redeem', ev => {
        return (
          ev.account == secondUser &&
          ev.numTokensSent == synthTokens &&
          ev.collateralReceived == collateralAmount &&
          ev.feePaid == feeDataAmount &&
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
          .add(web3Utils.toBN(feeDataAmount))
          .toString(),
        web3Utils.toBN(totalLpAmount).add(web3Utils.toBN(lpFee)).toString(),
        web3Utils.toBN(totalDaoAmount).add(web3Utils.toBN(daoFee)).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(collateralAmount))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can redeem in the correct way and redirect tokens to a different address', async () => {
      const synthTokens = web3Utils.toWei('50');
      const collateralAmount = web3Utils.toWei('59.88', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const redeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        expiration: expirationTime,
        recipient: thirdUser,
      };
      const userCollBalance = await collateralInstance.balanceOf.call(
        thirdUser,
      );
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await liquidityPoolInstance.redeem(redeemOperation, {
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
      const redeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeemOperation, {
          from: secondUser,
        }),
        'Collateral amount less than minimum limit',
      );
    });
    it('Can revert if transaction is expired', async () => {
      const synthTokens = web3Utils.toWei('50');
      const collateralAmount = web3Utils.toWei('59.88', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp - 60);
      const redeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeemOperation, {
          from: secondUser,
        }),
        'Transaction expired',
      );
    });
    it('Can revert if no synthetic tokens are sent', async () => {
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const redeemOperation = {
        numTokens: 0,
        minCollateral: 0,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeemOperation, {
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
      const redeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeemOperation, {
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
      const redeemOperation = {
        numTokens: synthTokens,
        minCollateral: collateralAmount,
        expiration: expirationTime,
        recipient: secondUser,
      };
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeemOperation, {
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
      destSynthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
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
      const destParams = {
        finder,
        version,
        collateralToken,
        syntheticToken: destSynthTokenAddress,
        roles,
        overCollateralization: destOverCollateralization,
        feeData,
        priceIdentifier: destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      };
      destLiquidityPoolInstance = await SynthereumLiquidityPool.new(destParams);
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
        collateralToken,
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
      await checkBalances(liquidityPoolInstance);
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
      await checkBalances(destLiquidityPoolInstance);
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
      const wrongParams = params;
      const wrongCollateralAddress = wrongCollateralInstance.address;
      wrongParams.collateralToken = wrongCollateralAddress;
      const wrongCollateraLiquidityPoolInstance = await SynthereumLiquidityPool.new(
        wrongParams,
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
      const wrongFinderInstance = await SynthereumFinder.new({
        admin: admin,
        maintainer: maintainer,
      });
      const priceFeedInterface = await web3.utils.stringToHex('PriceFeed');
      await wrongFinderInstance.changeImplementationAddress(
        priceFeedInterface,
        priceFeedInstance.address,
        { from: maintainer },
      );
      const forwarderInstance = await SynthereumTrustedForwarder.deployed();
      const forwarderInterface = await web3.utils.stringToHex(
        'TrustedForwarder',
      );
      await wrongFinderInstance.changeImplementationAddress(
        forwarderInterface,
        forwarderInstance.address,
        { from: maintainer },
      );
      const wrongParams = {
        finder: wrongFinderInstance.address,
        version,
        collateralToken,
        syntheticToken: destSynthTokenAddress,
        roles,
        overCollateralization: destOverCollateralization,
        feeData,
        priceIdentifier: destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      };
      const wrongFinderLiquidityPoolInstance = await SynthereumLiquidityPool.new(
        wrongParams,
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
      const wrongParams = {
        finder,
        version,
        collateralToken,
        syntheticToken: destSynthTokenAddress,
        roles,
        overCollateralization: destOverCollateralization,
        feeData,
        priceIdentifier: destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      };
      const wrongLiquidityPoolInstance = await SynthereumLiquidityPool.new(
        wrongParams,
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
      const wrongParams = {
        finder,
        version,
        collateralToken,
        syntheticToken: destSynthTokenAddress,
        roles,
        overCollateralization: destOverCollateralization,
        feeData,
        priceIdentifier: destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      };
      const underCapitalizedPoolInstance = await SynthereumLiquidityPool.new(
        wrongParams,
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
        collateralToken,
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

  describe('Should withdraw liquidity from the pool', async () => {
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
    });
    it('Can withdraw liquidity from the pool by the LP', async () => {
      const unusedCollateral = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const lpBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const withdrawAmount = web3Utils.toWei('150', 'mwei');
      const remainingLiquidity = web3Utils
        .toBN(unusedCollateral)
        .sub(web3Utils.toBN(withdrawAmount))
        .toString();
      const withdrawTx = await liquidityPoolInstance.withdrawLiquidity(
        withdrawAmount,
        { from: liquidityProvider },
      );
      truffleAssert.eventEmitted(withdrawTx, 'WithdrawLiquidity', ev => {
        return (
          ev.lp == liquidityProvider &&
          ev.liquidityWithdrawn == withdrawAmount &&
          ev.remainingLiquidity == remainingLiquidity
        );
      });
      assert.equal(
        (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
        web3Utils
          .toBN(unusedCollateral)
          .sub(web3Utils.toBN(withdrawAmount))
          .toString(),
        'Wrong withdraw amount',
      );
      assert.equal(
        (await collateralInstance.balanceOf.call(liquidityProvider)).toString(),
        web3Utils
          .toBN(lpBalance)
          .add(web3Utils.toBN(withdrawAmount))
          .toString(),
        'Wrong LP balance after withdraw',
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can revert if sender is not LP', async () => {
      const withdrawAmount = web3Utils.toWei('150', 'mwei');
      await truffleAssert.reverts(
        liquidityPoolInstance.withdrawLiquidity(withdrawAmount, {
          from: firstUser,
        }),
        'Sender must be the liquidity provider',
      );
    });
    it('Can revert if trying to withdraw more than available liquidity', async () => {
      const withdrawAmount = web3Utils.toWei('1000', 'mwei');
      await truffleAssert.reverts(
        liquidityPoolInstance.withdrawLiquidity(withdrawAmount, {
          from: liquidityProvider,
        }),
      );
    });
  });

  describe('Should increase collateralization in the position', async () => {
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
    });
    it('Can increase collateralization without deposit by the LP', async () => {
      const collateralToAdd = web3Utils.toWei('50', 'mwei');
      const unusedCollateral = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const actualPositionCollateral = await liquidityPoolInstance.totalCollateralAmount.call();
      const increaseCollateralTx = await liquidityPoolInstance.increaseCollateral(
        0,
        collateralToAdd,
        { from: liquidityProvider },
      );
      const newTotalCollateral = web3Utils
        .toBN(actualPositionCollateral)
        .add(web3Utils.toBN(collateralToAdd))
        .toString();
      truffleAssert.eventEmitted(
        increaseCollateralTx,
        'IncreaseCollateral',
        ev => {
          return (
            ev.lp == liquidityProvider &&
            ev.collateralAdded == collateralToAdd &&
            ev.newTotalCollateral == newTotalCollateral
          );
        },
      );
      assert.equal(
        (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
        web3Utils
          .toBN(unusedCollateral)
          .sub(web3Utils.toBN(collateralToAdd))
          .toString(),
        'Wrong liquidity after increasing collateral',
      );
      assert.equal(
        (await liquidityPoolInstance.totalCollateralAmount.call()).toString(),
        web3Utils
          .toBN(actualPositionCollateral)
          .add(web3Utils.toBN(collateralToAdd))
          .toString(),
        'Wrong increase collateral amount',
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can increase collateralization with deposit by the LP', async () => {
      const collateralToTransfer = web3Utils.toWei('30', 'mwei');
      const collateralToAdd = initialPoolAllocation;
      const unusedCollateral = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const actualPositionCollateral = await liquidityPoolInstance.totalCollateralAmount.call();
      const actualUserBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const actualPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      await collateralInstance.approve(
        liquidityPoolAddress,
        collateralToTransfer,
        { from: liquidityProvider },
      );
      const increaseCollateralTx = await liquidityPoolInstance.increaseCollateral(
        collateralToTransfer,
        collateralToAdd,
        { from: liquidityProvider },
      );
      const newTotalCollateral = web3Utils
        .toBN(actualPositionCollateral)
        .add(web3Utils.toBN(collateralToAdd))
        .toString();
      truffleAssert.eventEmitted(
        increaseCollateralTx,
        'IncreaseCollateral',
        ev => {
          return (
            ev.lp == liquidityProvider &&
            ev.collateralAdded == collateralToAdd &&
            ev.newTotalCollateral == newTotalCollateral
          );
        },
      );
      assert.equal(
        (await collateralInstance.balanceOf.call(liquidityProvider)).toString(),
        web3Utils
          .toBN(actualUserBalance)
          .sub(web3Utils.toBN(collateralToTransfer))
          .toString(),
        'Wrong liquidity provider balance after increasing collateral',
      );
      assert.equal(
        (
          await collateralInstance.balanceOf.call(liquidityPoolAddress)
        ).toString(),
        web3Utils
          .toBN(actualPoolBalance)
          .add(web3Utils.toBN(collateralToTransfer))
          .toString(),
        'Wrong pool balance after increasing collateral',
      );
      assert.equal(
        (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
        web3Utils
          .toBN(unusedCollateral)
          .add(web3Utils.toBN(collateralToTransfer))
          .sub(web3Utils.toBN(collateralToAdd))
          .toString(),
        'Wrong liquidity after increasing collateral',
      );
      assert.equal(
        (await liquidityPoolInstance.totalCollateralAmount.call()).toString(),
        web3Utils
          .toBN(actualPositionCollateral)
          .add(web3Utils.toBN(collateralToAdd))
          .toString(),
        'Wrong increase collateral amount',
      );
    });
    it('Can revert if sender is not LP', async () => {
      const collateralToAdd = web3Utils.toWei('50', 'mwei');
      await truffleAssert.reverts(
        liquidityPoolInstance.increaseCollateral(0, collateralToAdd, {
          from: firstUser,
        }),
        'Sender must be the liquidity provider',
      );
    });
    it('Can revert if no collateral is requested to be increased', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.increaseCollateral(0, 0, {
          from: liquidityProvider,
        }),
        'No collateral to be increased',
      );
    });
    it('Can revert if trying to increase more than available liquidity', async () => {
      const collateralToTransfer = web3Utils.toWei('29', 'mwei');
      const collateralToAdd = web3Utils.toWei('1000', 'mwei');
      await collateralInstance.approve(
        liquidityPoolAddress,
        collateralToTransfer,
        { from: liquidityProvider },
      );
      await truffleAssert.reverts(
        liquidityPoolInstance.increaseCollateral(
          collateralToTransfer,
          collateralToAdd,
          {
            from: liquidityProvider,
          },
        ),
        'No enough liquidity for increasing collateral',
      );
    });
  });

  describe('Should decrease collateralization in the position', async () => {
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
    });
    it('Can decrease collateralization without withdraw by the LP', async () => {
      const collateralToRemove = web3Utils.toWei('23.5', 'mwei');
      const unusedCollateral = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const actualPositionCollateral = await liquidityPoolInstance.totalCollateralAmount.call();
      const decreaseCollateralTx = await liquidityPoolInstance.decreaseCollateral(
        collateralToRemove,
        0,
        { from: liquidityProvider },
      );
      const newTotalCollateral = web3Utils
        .toBN(actualPositionCollateral)
        .sub(web3Utils.toBN(collateralToRemove))
        .toString();
      truffleAssert.eventEmitted(
        decreaseCollateralTx,
        'DecreaseCollateral',
        ev => {
          return (
            ev.lp == liquidityProvider &&
            ev.collateralRemoved == collateralToRemove &&
            ev.newTotalCollateral == newTotalCollateral
          );
        },
      );
      assert.equal(
        (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
        web3Utils
          .toBN(unusedCollateral)
          .add(web3Utils.toBN(collateralToRemove))
          .toString(),
        'Wrong liquidity after decreasing collateral',
      );
      assert.equal(
        (await liquidityPoolInstance.totalCollateralAmount.call()).toString(),
        web3Utils
          .toBN(actualPositionCollateral)
          .sub(web3Utils.toBN(collateralToRemove))
          .toString(),
        'Wrong decrease collateral amount',
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can decrease collateralization with withdraw by the LP', async () => {
      const collateralToRemove = web3Utils.toWei('23.5', 'mwei');
      const collateralToWithdraw = web3Utils
        .toBN(collateralToRemove)
        .add(web3Utils.toBN(web3Utils.toWei('900', 'mwei')));
      const unusedCollateral = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const actualPositionCollateral = await liquidityPoolInstance.totalCollateralAmount.call();
      const actualUserBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const actualPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      const decreaseCollateralTx = await liquidityPoolInstance.decreaseCollateral(
        collateralToRemove,
        collateralToWithdraw,
        { from: liquidityProvider },
      );
      const newTotalCollateral = web3Utils
        .toBN(actualPositionCollateral)
        .sub(web3Utils.toBN(collateralToRemove))
        .toString();
      truffleAssert.eventEmitted(
        decreaseCollateralTx,
        'DecreaseCollateral',
        ev => {
          return (
            ev.lp == liquidityProvider &&
            ev.collateralRemoved == collateralToRemove &&
            ev.newTotalCollateral == newTotalCollateral
          );
        },
      );
      assert.equal(
        (await collateralInstance.balanceOf.call(liquidityProvider)).toString(),
        web3Utils.toBN(actualUserBalance).add(collateralToWithdraw).toString(),
        'Wrong liquidity provider balance after decreasing collateral',
      );
      assert.equal(
        (
          await collateralInstance.balanceOf.call(liquidityPoolAddress)
        ).toString(),
        web3Utils.toBN(actualPoolBalance).sub(collateralToWithdraw).toString(),
        'Wrong pool balance after decreasing collateral',
      );
      assert.equal(
        (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
        web3Utils
          .toBN(unusedCollateral)
          .add(web3Utils.toBN(collateralToRemove))
          .sub(collateralToWithdraw)
          .toString(),
        'Wrong liquidity after decreasing collateral',
      );
      assert.equal(
        (await liquidityPoolInstance.totalCollateralAmount.call()).toString(),
        web3Utils
          .toBN(actualPositionCollateral)
          .sub(web3Utils.toBN(collateralToRemove))
          .toString(),
        'Wrong increase collateral amount',
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can revert if sender is not LP', async () => {
      const collateralToRemove = web3Utils.toWei('23.5', 'mwei');
      await truffleAssert.reverts(
        liquidityPoolInstance.decreaseCollateral(collateralToRemove, 0, {
          from: firstUser,
        }),
        'Sender must be the liquidity provider',
      );
    });
    it('Can revert if no collateral is requested to be decreased', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.decreaseCollateral(0, 0, {
          from: liquidityProvider,
        }),
        'No collateral to be decreased',
      );
    });
    it('Can revert if trying to decrease more than liquidation limit', async () => {
      const collateralToRemove = web3Utils.toWei('24', 'mwei');
      await truffleAssert.reverts(
        liquidityPoolInstance.decreaseCollateral(collateralToRemove, 0, {
          from: liquidityProvider,
        }),
        'Position undercollateralized',
      );
    });
    it('Can revert if trying to withdraw more than available liquidity after decrease', async () => {
      const collateralToRemove = web3Utils.toWei('23.5', 'mwei');
      const collateralToWithdraw = initialPoolAllocation;
      await truffleAssert.reverts(
        liquidityPoolInstance.decreaseCollateral(
          collateralToRemove,
          collateralToWithdraw,
          {
            from: liquidityProvider,
          },
        ),
      );
    });
  });

  describe('Should claim fees', async () => {
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
    });
    it('Can claim fee', async () => {
      const actualLpBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const actualDaoBalance = await collateralInstance.balanceOf.call(DAO);
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const lpFee = await liquidityPoolInstance.userFee.call(liquidityProvider);
      const daoFee = await liquidityPoolInstance.userFee.call(DAO);
      const poolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      const claimLpFeeTx = await liquidityPoolInstance.claimFee({
        from: liquidityProvider,
      });
      truffleAssert.eventEmitted(claimLpFeeTx, 'ClaimFee', ev => {
        return (
          ev.claimer == liquidityProvider &&
          ev.feeAmount == lpFee.toString() &&
          ev.totalRemainingFees == daoFee.toString()
        );
      });
      assert.equal(
        (await collateralInstance.balanceOf.call(liquidityProvider)).toString(),
        web3Utils.toBN(actualLpBalance).add(web3Utils.toBN(lpFee)).toString(),
        'Wrong Lp balance after LP claim fee',
      );
      assert.equal(
        (
          await collateralInstance.balanceOf.call(liquidityPoolAddress)
        ).toString(),
        web3Utils.toBN(poolBalance).sub(web3Utils.toBN(lpFee)).toString(),
        'Wrong pool balance after Lp claim fee',
      );
      assert.equal(
        (await collateralInstance.balanceOf.call(DAO)).toString(),
        actualDaoBalance.toString(),
        'Wrong Dao balance after LP claim fee',
      );
      assert.equal(
        (
          await liquidityPoolInstance.userFee.call(liquidityProvider)
        ).toString(),
        '0',
        'Wrong Lp fee in the pool',
      );
      assert.equal(
        (await liquidityPoolInstance.userFee.call(DAO)).toString(),
        daoFee.toString(),
        'Wrong Dao fee in the pool',
      );
      assert.equal(
        (await liquidityPoolInstance.totalFeeAmount.call()).toString(),
        web3Utils.toBN(totalFeeAmount).sub(web3Utils.toBN(lpFee)).toString(),
        'Wrong total fee in the pool',
      );
      const claimDaoFeeTx = await liquidityPoolInstance.claimFee({
        from: DAO,
      });
      assert.equal(
        (await collateralInstance.balanceOf.call(DAO)).toString(),
        web3Utils.toBN(actualDaoBalance).add(web3Utils.toBN(daoFee)).toString(),
        'Wrong Dao balance after Dao claim fee',
      );
      assert.equal(
        (
          await collateralInstance.balanceOf.call(liquidityPoolAddress)
        ).toString(),
        web3Utils
          .toBN(poolBalance)
          .sub(web3Utils.toBN(lpFee))
          .sub(web3Utils.toBN(daoFee))
          .toString(),
        'Wrong pool balance after Dao claim fee',
      );
      assert.equal(
        (await liquidityPoolInstance.userFee.call(DAO)).toString(),
        '0',
        'Wrong Dao fee in the pool',
      );
      assert.equal(
        (await liquidityPoolInstance.totalFeeAmount.call()).toString(),
        '0',
        'Wrong total fee in the pool',
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can revert if no fee to claim', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.claimFee({ from: firstUser }),
        'No fee to claim',
      );
    });
  });

  describe('Should liquidate', async () => {
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
    });
    it('Can liquidate in case the position is capitalized', async () => {
      const emergencyPrice = web3Utils.toWei('148', 'mwei');
      const resultingPrice = web3Utils.toWei('1.48');
      await aggregatorInstance.updateAnswer(emergencyPrice);
      const availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const firstUserSynthTokens = web3Utils.toWei('79.8');
      const secondUserSynthTokens = web3Utils.toWei('20');
      await synthTokenInstance.transfer(secondUser, secondUserSynthTokens, {
        from: firstUser,
      });
      const firstUserCollateralAmount = web3Utils.toWei('118.104', 'mwei');
      const secondUserCollateralAmount = web3Utils.toWei('29.6', 'mwei');
      let totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      let totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      let collateralPortion = web3Utils
        .toBN(firstUserSynthTokens)
        .mul(web3Utils.toBN(Math.pow(10, 18)))
        .div(web3Utils.toBN(totalSynthTokensInPool))
        .mul(web3Utils.toBN(totalCollateralPosition))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const liquidationReward = await liquidityPoolInstance.liquidationReward.call();
      const firstUserReward = collateralPortion
        .sub(web3Utils.toBN(firstUserCollateralAmount))
        .mul(web3Utils.toBN(liquidationReward))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const actualFirstUserCollBalance = await collateralInstance.balanceOf.call(
        firstUser,
      );
      const actualFirstUserSynthBalance = await synthTokenInstance.balanceOf.call(
        firstUser,
      );
      const actualSecondUserCollBalance = await collateralInstance.balanceOf.call(
        secondUser,
      );
      const actualSecondUserSynthBalance = await synthTokenInstance.balanceOf.call(
        secondUser,
      );
      const totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      await synthTokenInstance.approve(
        liquidityPoolAddress,
        firstUserSynthTokens,
        { from: firstUser },
      );
      const firstLiquidationTx = await liquidityPoolInstance.liquidate(
        firstUserSynthTokens,
        { from: firstUser },
      );
      truffleAssert.eventEmitted(firstLiquidationTx, 'Liquidate', ev => {
        return (
          ev.liquidator == firstUser &&
          ev.tokensLiquidated == firstUserSynthTokens &&
          ev.price == resultingPrice &&
          ev.collateralExpected == firstUserCollateralAmount &&
          ev.collateralReceived == firstUserCollateralAmount &&
          ev.rewardReceived == firstUserReward.toString()
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        firstUser,
        web3Utils
          .toBN(actualFirstUserCollBalance)
          .add(web3Utils.toBN(firstUserCollateralAmount))
          .add(web3Utils.toBN(firstUserReward))
          .toString(),
        '0',
        availableLiquidity.toString(),
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .sub(web3Utils.toBN(firstUserReward))
          .toString(),
        web3Utils
          .toBN(totalSynthTokensInPool)
          .sub(web3Utils.toBN(firstUserSynthTokens))
          .toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .sub(web3Utils.toBN(firstUserReward))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
      totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      collateralPortion = web3Utils
        .toBN(secondUserSynthTokens)
        .mul(web3Utils.toBN(Math.pow(10, 18)))
        .div(web3Utils.toBN(totalSynthTokensInPool))
        .mul(web3Utils.toBN(totalCollateralPosition))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const secondUserReward = collateralPortion
        .sub(web3Utils.toBN(secondUserCollateralAmount))
        .mul(web3Utils.toBN(liquidationReward))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      await synthTokenInstance.approve(
        liquidityPoolAddress,
        secondUserSynthTokens,
        { from: secondUser },
      );
      const secondLiquidationTx = await liquidityPoolInstance.liquidate(
        secondUserSynthTokens,
        { from: secondUser },
      );
      truffleAssert.eventEmitted(secondLiquidationTx, 'Liquidate', ev => {
        return (
          ev.liquidator == secondUser &&
          ev.tokensLiquidated == secondUserSynthTokens &&
          ev.price == resultingPrice &&
          ev.collateralExpected == secondUserCollateralAmount &&
          ev.collateralReceived == secondUserCollateralAmount &&
          ev.rewardReceived == secondUserReward.toString()
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        secondUser,
        web3Utils
          .toBN(actualSecondUserCollBalance)
          .add(web3Utils.toBN(secondUserCollateralAmount))
          .add(web3Utils.toBN(secondUserReward))
          .toString(),
        '0',
        availableLiquidity.toString(),
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(secondUserCollateralAmount))
          .sub(web3Utils.toBN(secondUserReward))
          .toString(),
        '0',
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .sub(web3Utils.toBN(firstUserReward))
          .sub(web3Utils.toBN(secondUserCollateralAmount))
          .sub(web3Utils.toBN(secondUserReward))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
      const remainingCollateral = await liquidityPoolInstance.totalCollateralAmount.call();
      await liquidityPoolInstance.decreaseCollateral(
        remainingCollateral,
        remainingCollateral,
        { from: liquidityProvider },
      );
      assert.equal(
        (await liquidityPoolInstance.totalCollateralAmount.call()).toString(),
        '0',
        'Still remaining collateral',
      );
      assert.equal(
        (
          await collateralInstance.balanceOf.call(liquidityPoolAddress)
        ).toString(),
        web3Utils
          .toBN(availableLiquidity)
          .add(web3Utils.toBN(totalFeeAmount))
          .toString(),
        'Wrong pool collateral',
      );
    });
    it('Can liquidate in case the position is under-capitalized', async () => {
      let availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      await liquidityPoolInstance.withdrawLiquidity(availableLiquidity, {
        from: liquidityProvider,
      });
      const initialLiquidity = web3Utils.toWei('30', 'mwei');
      await collateralInstance.transfer(
        liquidityPoolAddress,
        initialLiquidity,
        { from: liquidityProvider },
      );
      let price = web3Utils.toWei('160', 'mwei');
      let resultingPrice = web3Utils.toWei('1.60');
      await aggregatorInstance.updateAnswer(price);
      const firstUserSynthTokens = web3Utils.toWei('79.8');
      const secondUserSynthTokens = web3Utils.toWei('15');
      const thirdUserSynthTokens = web3Utils.toWei('5');
      const thirdUserSynthTokensExceeding = web3Utils.toWei('6');
      await synthTokenInstance.transfer(secondUser, secondUserSynthTokens, {
        from: firstUser,
      });
      await synthTokenInstance.transfer(thirdUser, thirdUserSynthTokens, {
        from: firstUser,
      });
      const firstUserCollateralAmount = web3Utils.toWei('127.68', 'mwei');
      const secondUserCollateralAmount = web3Utils.toWei('24', 'mwei');
      const thirdUserCollateralAmount = web3Utils.toWei('8', 'mwei');
      let totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      let totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      let collateralPortion = web3Utils
        .toBN(firstUserSynthTokens)
        .mul(web3Utils.toBN(Math.pow(10, 18)))
        .div(web3Utils.toBN(totalSynthTokensInPool))
        .mul(web3Utils.toBN(totalCollateralPosition))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      let remainingCollateralPortion = web3Utils
        .toBN(totalCollateralPosition)
        .sub(collateralPortion);
      let targetCollateral = web3Utils
        .toBN(secondUserSynthTokens)
        .add(web3Utils.toBN(thirdUserSynthTokens))
        .mul(web3Utils.toBN(resultingPrice))
        .div(web3Utils.toBN(Math.pow(10, 18)))
        .mul(web3Utils.toBN(collateralRequirement))
        .div(web3Utils.toBN(Math.pow(10, 18)))
        .div(web3Utils.toBN(Math.pow(10, 12)));
      let liquidityUsed = web3Utils
        .toBN(firstUserCollateralAmount)
        .sub(collateralPortion);
      let rebalancingAmount = targetCollateral.sub(remainingCollateralPortion);
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const actualFirstUserCollBalance = await collateralInstance.balanceOf.call(
        firstUser,
      );
      const actualFirstUserSynthBalance = await synthTokenInstance.balanceOf.call(
        firstUser,
      );
      const actualSecondUserCollBalance = await collateralInstance.balanceOf.call(
        secondUser,
      );
      const actualSecondUserSynthBalance = await synthTokenInstance.balanceOf.call(
        secondUser,
      );
      let totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      await synthTokenInstance.approve(
        liquidityPoolAddress,
        firstUserSynthTokens,
        { from: firstUser },
      );
      const firstLiquidationTx = await liquidityPoolInstance.liquidate(
        firstUserSynthTokens,
        { from: firstUser },
      );
      truffleAssert.eventEmitted(firstLiquidationTx, 'Liquidate', ev => {
        return (
          ev.liquidator == firstUser &&
          ev.tokensLiquidated == firstUserSynthTokens &&
          ev.price == resultingPrice &&
          ev.collateralExpected == firstUserCollateralAmount &&
          ev.collateralReceived == firstUserCollateralAmount &&
          ev.rewardReceived == '0'
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        firstUser,
        web3Utils
          .toBN(actualFirstUserCollBalance)
          .add(web3Utils.toBN(firstUserCollateralAmount))
          .toString(),
        '0',
        web3Utils
          .toBN(initialLiquidity)
          .sub(liquidityUsed)
          .sub(rebalancingAmount)
          .toString(),
        targetCollateral.toString(),
        web3Utils
          .toBN(totalSynthTokensInPool)
          .sub(web3Utils.toBN(firstUserSynthTokens))
          .toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
      let overCollateralizationData = await liquidityPoolInstance.collateralCoverage.call();
      assert.equal(
        overCollateralizationData[0],
        true,
        'Wrong overcollateral after liquidation',
      );
      assert.equal(
        overCollateralizationData[1].toString(),
        collateralRequirement.toString(),
        'Wrong overcollateral amount after liquidation',
      );
      price = web3Utils.toWei('144', 'mwei');
      resultingPrice = web3Utils.toWei('1.44');
      await aggregatorInstance.updateAnswer(price);
      targetCollateral = web3Utils
        .toBN(secondUserSynthTokens)
        .add(web3Utils.toBN(thirdUserSynthTokens))
        .mul(web3Utils.toBN(resultingPrice))
        .div(web3Utils.toBN(Math.pow(10, 18)))
        .mul(web3Utils.toBN(collateralRequirement))
        .div(web3Utils.toBN(Math.pow(10, 18)))
        .div(web3Utils.toBN(Math.pow(10, 12)));
      totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      let collateralToDecrease = web3Utils
        .toBN(totalCollateralPosition)
        .sub(targetCollateral);
      availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      await liquidityPoolInstance.decreaseCollateral(
        collateralToDecrease,
        web3Utils.toBN(availableLiquidity).add(collateralToDecrease),
        { from: liquidityProvider },
      );
      price = web3Utils.toWei('160', 'mwei');
      resultingPrice = web3Utils.toWei('1.6');
      await aggregatorInstance.updateAnswer(price);
      await collateralInstance.transfer(
        liquidityPoolAddress,
        web3Utils.toBN(web3Utils.toWei('2', 'mwei')),
        { from: liquidityProvider },
      );
      availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      await synthTokenInstance.approve(
        liquidityPoolAddress,
        secondUserSynthTokens,
        { from: secondUser },
      );
      const secondLiquidationTx = await liquidityPoolInstance.liquidate(
        secondUserSynthTokens,
        { from: secondUser },
      );
      truffleAssert.eventEmitted(secondLiquidationTx, 'Liquidate', ev => {
        return (
          ev.liquidator == secondUser &&
          ev.tokensLiquidated == secondUserSynthTokens &&
          ev.price == resultingPrice &&
          ev.collateralExpected == secondUserCollateralAmount.toString() &&
          ev.collateralReceived == secondUserCollateralAmount.toString() &&
          ev.rewardReceived == '0'
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        secondUser,
        web3Utils
          .toBN(actualSecondUserCollBalance)
          .add(web3Utils.toBN(secondUserCollateralAmount))
          .toString(),
        '0',
        '0',
        web3Utils
          .toBN(totalCollateralPosition)
          .add(web3Utils.toBN(availableLiquidity))
          .sub(web3Utils.toBN(secondUserCollateralAmount))
          .toString(),
        web3Utils.toBN(thirdUserSynthTokens).toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(secondUserCollateralAmount))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
      overCollateralizationData = await liquidityPoolInstance.collateralCoverage.call();
      assert.equal(
        overCollateralizationData[0],
        false,
        'Wrong overcollateral after liquidation',
      );
      price = web3Utils.toWei('144', 'mwei');
      resultingPrice = web3Utils.toWei('1.44');
      await aggregatorInstance.updateAnswer(price);
      targetCollateral = web3Utils
        .toBN(thirdUserSynthTokens)
        .mul(web3Utils.toBN(resultingPrice))
        .div(web3Utils.toBN(Math.pow(10, 18)))
        .mul(web3Utils.toBN(collateralRequirement))
        .div(web3Utils.toBN(Math.pow(10, 18)))
        .div(web3Utils.toBN(Math.pow(10, 12)));
      totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      collateralToDecrease = web3Utils
        .toBN(totalCollateralPosition)
        .sub(targetCollateral);
      availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      await liquidityPoolInstance.decreaseCollateral(
        collateralToDecrease,
        collateralToDecrease,
        { from: liquidityProvider },
      );
      price = web3Utils.toWei('160', 'mwei');
      resultingPrice = web3Utils.toWei('1.6');
      await aggregatorInstance.updateAnswer(price);
      const addedLiquidity = web3Utils.toBN(web3Utils.toWei('0.1', 'mwei'));
      await collateralInstance.transfer(liquidityPoolAddress, addedLiquidity, {
        from: liquidityProvider,
      });
      availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      const actualThirdUserCollBalance = await collateralInstance.balanceOf.call(
        thirdUser,
      );
      const receivedAmount = web3Utils
        .toBN(totalCollateralPosition)
        .add(web3Utils.toBN(availableLiquidity));
      await synthTokenInstance.approve(
        liquidityPoolAddress,
        thirdUserSynthTokens,
        { from: thirdUser },
      );
      const thirdLiquidationTx = await liquidityPoolInstance.liquidate(
        thirdUserSynthTokensExceeding,
        { from: thirdUser },
      );
      truffleAssert.eventEmitted(thirdLiquidationTx, 'Liquidate', ev => {
        return (
          ev.liquidator == thirdUser &&
          ev.tokensLiquidated == thirdUserSynthTokens &&
          ev.price == resultingPrice &&
          ev.collateralExpected == thirdUserCollateralAmount.toString() &&
          ev.collateralReceived == receivedAmount.toString() &&
          ev.rewardReceived == '0'
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        thirdUser,
        web3Utils
          .toBN(actualThirdUserCollBalance)
          .add(receivedAmount)
          .toString(),
        '0',
        '0',
        '0',
        '0',
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can revert if the position is over-collateralized', async () => {
      const emergencyPrice = web3Utils.toWei('130', 'mwei');
      await aggregatorInstance.updateAnswer(emergencyPrice);
      const firstUserSynthTokens = web3Utils.toWei('79.8');
      const secondUserSynthTokens = web3Utils.toWei('20');
      await synthTokenInstance.transfer(secondUser, secondUserSynthTokens, {
        from: firstUser,
      });
      await synthTokenInstance.approve(
        liquidityPoolAddress,
        firstUserSynthTokens,
        { from: firstUser },
      );
      await truffleAssert.reverts(
        liquidityPoolInstance.liquidate(firstUserSynthTokens, {
          from: firstUser,
        }),
        'Position is overcollateralized',
      );
    });
  });

  describe('Should emergency shutdown', async () => {
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
    });
    it('Can emergency shutdown', async () => {
      const emergencyPrice = web3Utils.toWei('115', 'mwei');
      const emergencyPriceResult = web3Utils.toWei('1.15');
      await aggregatorInstance.updateAnswer(emergencyPrice);
      const availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const totalCollateralAmount = await liquidityPoolInstance.totalCollateralAmount.call();
      const finalCollateral = web3Utils
        .toBN(totalCollateralAmount)
        .add(web3Utils.toBN(availableLiquidity))
        .toString();
      const emergencyTx = await managerInstance.emergencyShutdown(
        [liquidityPoolAddress],
        { from: maintainer },
      );
      const blockNumber = emergencyTx.receipt.blockNumber;
      const emergencyTimestamp = (await web3.eth.getBlock(blockNumber))
        .timestamp;
      assert.equal(
        (
          await liquidityPoolInstance.emergencyShutdownTimestamp.call()
        ).toString(),
        emergencyTimestamp.toString(),
        'Wrong emergency timestamp',
      );
      assert.equal(
        (await liquidityPoolInstance.emergencyShutdownPrice.call()).toString(),
        emergencyPriceResult.toString(),
        'Wrong emergency price',
      );
      assert.equal(
        (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
        '0',
        'Still liquidity in the pool',
      );
      assert.equal(
        (await liquidityPoolInstance.totalCollateralAmount.call()).toString(),
        finalCollateral,
        'No collateral added',
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can revert is emergency shutdown is not called by the manager', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.emergencyShutdown({ from: maintainer }),
        'Caller must be the Synthereum manager',
      );
    });
    it('Can revert if mint is called after emergency shutdown', async () => {
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      const mintCollateralAmount = web3Utils.toWei('10', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: '0',
        collateralAmount: mintCollateralAmount,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await truffleAssert.reverts(
        liquidityPoolInstance.mint(mintOperation, { from: firstUser }),
        'Pool emergency shutdown',
      );
    });
    it('Can revert if redeem is called after emergency shutdown', async () => {
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      const synthTokens = web3Utils.toWei('10', 'mwei');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const redeemOperation = {
        numTokens: synthTokens,
        minCollateral: 0,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await truffleAssert.reverts(
        liquidityPoolInstance.redeem(redeemOperation, { from: firstUser }),
        'Pool emergency shutdown',
      );
    });
    it('Can revert if exchange is called after emergency shutdown', async () => {
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      const synthTokens = web3Utils.toWei('10');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const exchangeOperation = {
        destPool: DAO,
        numTokens: synthTokens,
        minDestNumTokens: 0,
        expiration: expirationTime,
        recipient: firstUser,
      };
      await truffleAssert.reverts(
        liquidityPoolInstance.exchange(exchangeOperation, { from: firstUser }),
        'Pool emergency shutdown',
      );
    });
    it('Can revert if exchange-mint is called after emergency shutdown', async () => {
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      const synthTokens = web3Utils.toWei('10');
      const collateralAmount = web3Utils.toWei('12', 'mwei');
      await truffleAssert.reverts(
        liquidityPoolInstance.exchangeMint(
          collateralAmount,
          synthTokens,
          firstUser,
          {
            from: firstUser,
          },
        ),
        'Pool emergency shutdown',
      );
    });
    it('Can revert if withdraw liquidity is called after emergency shutdown', async () => {
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      const collateralAmount = web3Utils.toWei('10', 'mwei');
      await truffleAssert.reverts(
        liquidityPoolInstance.withdrawLiquidity(collateralAmount, {
          from: liquidityProvider,
        }),
        'Pool emergency shutdown',
      );
    });
    it('Can revert if decrease collateral is called after emergency shutdown', async () => {
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      const collateralAmount = web3Utils.toWei('10', 'mwei');
      await truffleAssert.reverts(
        liquidityPoolInstance.decreaseCollateral(collateralAmount, '0', {
          from: liquidityProvider,
        }),
        'Pool emergency shutdown',
      );
    });
    it('Can revert if liquidation is called after emergency shutdown', async () => {
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      const synthTokens = web3Utils.toWei('10');
      await truffleAssert.reverts(
        liquidityPoolInstance.liquidate(synthTokens, {
          from: firstUser,
        }),
        'Pool emergency shutdown',
      );
    });
    it('Can revert if emergency shutdown is called again by the manager', async () => {
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      await truffleAssert.reverts(
        managerInstance.emergencyShutdown([liquidityPoolAddress], {
          from: maintainer,
        }),
        'Pool emergency shutdown',
      );
    });
    it('Can revert if settlement of emergency shutdown is called without the contract has not been shutdowned', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.settleEmergencyShutdown({
          from: firstUser,
        }),
        'Pool not emergency shutdown',
      );
    });
  });

  describe('Should settle after emergency shutdown', async () => {
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
    });
    it('Can settle in case the position is capitalized and LP is a not token holder', async () => {
      await aggregatorInstance.updateAnswer(web3Utils.toWei('115', 'mwei'));
      const synthTokens = web3Utils.toWei('99.8');
      const collateralAmount = web3Utils.toWei('114.77', 'mwei');
      const totalCollateralPosition = (
        await liquidityPoolInstance.totalCollateralAmount.call()
      ).add(await liquidityPoolInstance.totalAvailableLiquidity.call());
      const expectedLpAmount = web3Utils
        .toBN(totalCollateralPosition)
        .sub(web3Utils.toBN(collateralAmount));
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const actualUserCollBalance = await collateralInstance.balanceOf.call(
        firstUser,
      );
      const actualUserSynthBalance = await synthTokenInstance.balanceOf.call(
        firstUser,
      );
      const actualLpCollBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const actualLpSynthBalance = await synthTokenInstance.balanceOf.call(
        liquidityProvider,
      );
      const totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      const totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      const lpSettleTx = await liquidityPoolInstance.settleEmergencyShutdown({
        from: liquidityProvider,
      });
      truffleAssert.eventEmitted(lpSettleTx, 'Settle', ev => {
        return (
          ev.account == liquidityProvider &&
          ev.numTokensSettled == '0' &&
          ev.collateralExpected == expectedLpAmount.toString() &&
          ev.collateralSettled == expectedLpAmount.toString()
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        liquidityProvider,
        web3Utils
          .toBN(actualLpCollBalance)
          .add(web3Utils.toBN(expectedLpAmount))
          .toString(),
        '0',
        '0',
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(expectedLpAmount))
          .toString(),
        web3Utils.toBN(totalSynthTokensInPool).toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(expectedLpAmount))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
      const addedLiquidity = web3Utils.toWei('40', 'mwei');
      await collateralInstance.approve(liquidityPoolAddress, addedLiquidity, {
        from: liquidityProvider,
      });
      await liquidityPoolInstance.increaseCollateral(
        addedLiquidity,
        addedLiquidity,
        {
          from: liquidityProvider,
        },
      );
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      const settleTx = await liquidityPoolInstance.settleEmergencyShutdown({
        from: firstUser,
      });
      truffleAssert.eventEmitted(settleTx, 'Settle', ev => {
        return (
          ev.account == firstUser &&
          ev.numTokensSettled == synthTokens &&
          ev.collateralExpected == collateralAmount &&
          ev.collateralSettled == collateralAmount
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        firstUser,
        web3Utils
          .toBN(actualUserCollBalance)
          .add(web3Utils.toBN(collateralAmount))
          .toString(),
        '0',
        '0',
        web3Utils.toBN(addedLiquidity).toString(),
        '0',
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(addedLiquidity)
          .add(web3Utils.toBN(totalFeeAmount))
          .toString(),
      );
      assert.equal(
        await synthTokenInstance.totalSupply.call(),
        '0',
        'Wrong null total supply',
      );
      await checkBalances(liquidityPoolInstance);
      const finalLpSettleTx = await liquidityPoolInstance.settleEmergencyShutdown(
        {
          from: liquidityProvider,
        },
      );
      truffleAssert.eventEmitted(finalLpSettleTx, 'Settle', ev => {
        return (
          ev.account == liquidityProvider &&
          ev.numTokensSettled == '0' &&
          ev.collateralExpected == addedLiquidity.toString() &&
          ev.collateralSettled == addedLiquidity.toString()
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        liquidityProvider,
        web3Utils
          .toBN(actualLpCollBalance)
          .add(web3Utils.toBN(expectedLpAmount))
          .toString(),
        '0',
        '0',
        '0',
        '0',
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can settle in case the position is capitalized and LP is a token holder', async () => {
      await aggregatorInstance.updateAnswer(web3Utils.toWei('115', 'mwei'));
      const synthTokens = web3Utils.toWei('60');
      const lpSynthTokens = web3Utils.toWei('30');
      const depositedSynthTokens = web3Utils.toWei('9.8');
      const totalLpSynthTokens = web3Utils
        .toBN(lpSynthTokens)
        .add(web3Utils.toBN(depositedSynthTokens));
      await synthTokenInstance.transfer(liquidityProvider, lpSynthTokens, {
        from: firstUser,
      });
      await synthTokenInstance.transfer(
        liquidityPoolAddress,
        depositedSynthTokens,
        {
          from: firstUser,
        },
      );
      const collateralAmount = web3Utils.toWei('69', 'mwei');
      const totalCollateralPosition = (
        await liquidityPoolInstance.totalCollateralAmount.call()
      ).add(await liquidityPoolInstance.totalAvailableLiquidity.call());
      const expectedLpAmount = web3Utils
        .toBN(totalCollateralPosition)
        .sub(web3Utils.toBN(collateralAmount));
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const actualUserCollBalance = await collateralInstance.balanceOf.call(
        firstUser,
      );
      const actualUserSynthBalance = await synthTokenInstance.balanceOf.call(
        firstUser,
      );
      const actualLpCollBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const actualLpSynthBalance = await synthTokenInstance.balanceOf.call(
        liquidityProvider,
      );
      const totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      const totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      const settleTx = await liquidityPoolInstance.settleEmergencyShutdown({
        from: firstUser,
      });
      truffleAssert.eventEmitted(settleTx, 'Settle', ev => {
        return (
          ev.account == firstUser &&
          ev.numTokensSettled == synthTokens &&
          ev.collateralExpected == collateralAmount &&
          ev.collateralSettled == collateralAmount
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        firstUser,
        web3Utils
          .toBN(actualUserCollBalance)
          .add(web3Utils.toBN(collateralAmount))
          .toString(),
        '0',
        '0',
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(collateralAmount))
          .toString(),
        web3Utils
          .toBN(totalSynthTokensInPool)
          .sub(web3Utils.toBN(synthTokens))
          .toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(collateralAmount))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
      await synthTokenInstance.approve(liquidityPoolAddress, lpSynthTokens, {
        from: liquidityProvider,
      });
      const lpSettleTx = await liquidityPoolInstance.settleEmergencyShutdown({
        from: liquidityProvider,
      });
      truffleAssert.eventEmitted(lpSettleTx, 'Settle', ev => {
        return (
          ev.account == liquidityProvider &&
          ev.numTokensSettled == totalLpSynthTokens.toString() &&
          ev.collateralExpected == expectedLpAmount.toString() &&
          ev.collateralSettled == expectedLpAmount.toString()
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        liquidityProvider,
        web3Utils
          .toBN(actualLpCollBalance)
          .add(web3Utils.toBN(expectedLpAmount))
          .toString(),
        '0',
        '0',
        '0',
        '0',
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
      );
      assert.equal(
        await synthTokenInstance.totalSupply.call(),
        '0',
        'Wrong null total supply',
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can settle in case the position is under-capitalized and LP is not a token holder', async () => {
      const availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      await liquidityPoolInstance.withdrawLiquidity(availableLiquidity, {
        from: liquidityProvider,
      });
      await aggregatorInstance.updateAnswer(web3Utils.toWei('170', 'mwei'));
      const firstUserSynthTokens = web3Utils.toWei('79.8');
      const secondUserSynthTokens = web3Utils.toWei('20');
      await synthTokenInstance.transfer(secondUser, secondUserSynthTokens, {
        from: firstUser,
      });
      const firstUserCollateralAmount = web3Utils.toWei('135.66', 'mwei');
      const secondUserCollateralAmount = web3Utils.toWei('34', 'mwei');
      const totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      const netSecondUserCollateralAmount = web3Utils
        .toBN(totalCollateralPosition)
        .sub(web3Utils.toBN(firstUserCollateralAmount));
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const actualFirstUserCollBalance = await collateralInstance.balanceOf.call(
        firstUser,
      );
      const actualFirstUserSynthBalance = await synthTokenInstance.balanceOf.call(
        firstUser,
      );
      const actualSecondUserCollBalance = await collateralInstance.balanceOf.call(
        secondUser,
      );
      const actualSecondUserSynthBalance = await synthTokenInstance.balanceOf.call(
        secondUser,
      );
      const actualLpCollBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const actualLpSynthBalance = await synthTokenInstance.balanceOf.call(
        liquidityProvider,
      );
      const totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      const totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      await synthTokenInstance.approve(
        liquidityPoolAddress,
        firstUserSynthTokens,
        {
          from: firstUser,
        },
      );
      const settleTx = await liquidityPoolInstance.settleEmergencyShutdown({
        from: firstUser,
      });
      truffleAssert.eventEmitted(settleTx, 'Settle', ev => {
        return (
          ev.account == firstUser &&
          ev.numTokensSettled == firstUserSynthTokens &&
          ev.collateralExpected == firstUserCollateralAmount &&
          ev.collateralSettled == firstUserCollateralAmount
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        firstUser,
        web3Utils
          .toBN(actualFirstUserCollBalance)
          .add(web3Utils.toBN(firstUserCollateralAmount))
          .toString(),
        '0',
        '0',
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .toString(),
        web3Utils
          .toBN(totalSynthTokensInPool)
          .sub(web3Utils.toBN(firstUserSynthTokens))
          .toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
      const lpSettleTx = await liquidityPoolInstance.settleEmergencyShutdown({
        from: liquidityProvider,
      });
      truffleAssert.eventEmitted(lpSettleTx, 'Settle', ev => {
        return (
          ev.account == liquidityProvider &&
          ev.numTokensSettled == '0' &&
          ev.collateralExpected == '0' &&
          ev.collateralSettled == '0'
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        liquidityProvider,
        web3Utils.toBN(actualLpCollBalance).toString(),
        '0',
        '0',
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .toString(),
        web3Utils
          .toBN(totalSynthTokensInPool)
          .sub(web3Utils.toBN(firstUserSynthTokens))
          .toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
      await synthTokenInstance.approve(
        liquidityPoolAddress,
        secondUserSynthTokens,
        {
          from: secondUser,
        },
      );
      const secondSettleTx = await liquidityPoolInstance.settleEmergencyShutdown(
        {
          from: secondUser,
        },
      );
      truffleAssert.eventEmitted(secondSettleTx, 'Settle', ev => {
        return (
          ev.account == secondUser &&
          ev.numTokensSettled == secondUserSynthTokens &&
          ev.collateralExpected == secondUserCollateralAmount &&
          ev.collateralSettled == netSecondUserCollateralAmount.toString()
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        secondUser,
        web3Utils
          .toBN(actualSecondUserCollBalance)
          .add(netSecondUserCollateralAmount)
          .toString(),
        '0',
        '0',
        '0',
        '0',
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can settle in case the position is under-capitalized and LP is a token holder', async () => {
      const availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      await liquidityPoolInstance.withdrawLiquidity(availableLiquidity, {
        from: liquidityProvider,
      });
      await aggregatorInstance.updateAnswer(web3Utils.toWei('170', 'mwei'));
      const synthTokens = web3Utils.toWei('60');
      const lpSynthTokens = web3Utils.toWei('30');
      const depositedSynthTokens = web3Utils.toWei('9.8');
      const totalLpSynthTokens = web3Utils
        .toBN(lpSynthTokens)
        .add(web3Utils.toBN(depositedSynthTokens));
      const expectedLpAmount = web3Utils.toWei('67.66', 'mwei');
      const totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      const collateralAmount = web3Utils
        .toBN(totalCollateralPosition)
        .sub(web3Utils.toBN(expectedLpAmount));
      const expectedCollateralAmount = web3Utils.toWei('102', 'mwei');
      await synthTokenInstance.transfer(liquidityProvider, lpSynthTokens, {
        from: firstUser,
      });
      await synthTokenInstance.transfer(
        liquidityPoolAddress,
        depositedSynthTokens,
        {
          from: firstUser,
        },
      );
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const actualUserCollBalance = await collateralInstance.balanceOf.call(
        firstUser,
      );
      const actualUserSynthBalance = await synthTokenInstance.balanceOf.call(
        firstUser,
      );
      const actualLpCollBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const actualLpSynthBalance = await synthTokenInstance.balanceOf.call(
        liquidityProvider,
      );
      const totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      const totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      await synthTokenInstance.approve(liquidityPoolAddress, lpSynthTokens, {
        from: liquidityProvider,
      });
      const lpSettleTx = await liquidityPoolInstance.settleEmergencyShutdown({
        from: liquidityProvider,
      });
      truffleAssert.eventEmitted(lpSettleTx, 'Settle', ev => {
        return (
          ev.account == liquidityProvider &&
          ev.numTokensSettled == totalLpSynthTokens.toString() &&
          ev.collateralExpected == expectedLpAmount &&
          ev.collateralSettled == expectedLpAmount
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        liquidityProvider,
        web3Utils
          .toBN(actualLpCollBalance)
          .add(web3Utils.toBN(expectedLpAmount))
          .toString(),
        '0',
        '0',
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(expectedLpAmount))
          .toString(),
        web3Utils
          .toBN(totalSynthTokensInPool)
          .sub(web3Utils.toBN(totalLpSynthTokens))
          .toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(expectedLpAmount))
          .toString(),
      );
      await checkBalances(liquidityPoolInstance);
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      const settleTx = await liquidityPoolInstance.settleEmergencyShutdown({
        from: firstUser,
      });
      truffleAssert.eventEmitted(settleTx, 'Settle', ev => {
        return (
          ev.account == firstUser &&
          ev.numTokensSettled == synthTokens &&
          ev.collateralExpected == expectedCollateralAmount &&
          ev.collateralSettled == collateralAmount.toString()
        );
      });
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        firstUser,
        web3Utils
          .toBN(actualUserCollBalance)
          .add(web3Utils.toBN(collateralAmount))
          .toString(),
        '0',
        '0',
        '0',
        '0',
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
      );
      assert.equal(
        await synthTokenInstance.totalSupply.call(),
        '0',
        'Wrong null total supply',
      );
      await checkBalances(liquidityPoolInstance);
    });
    it('Can revert if the sender is not a token holder or the liquidity provider', async () => {
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.settleEmergencyShutdown({
          from: thirdUser,
        }),
        'Sender has nothing to settle',
      );
    });
  });

  describe('Should set fee', async () => {
    it('Can set fee percentage', async () => {
      const newFeePerc = web3Utils.toWei('0.1');
      const feeDataTx = await liquidityPoolInstance.setFeePercentage(
        newFeePerc,
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(feeDataTx, 'SetFeePercentage', ev => {
        return ev.feePercentage == newFeePerc;
      });
      const feeDataOutput = await liquidityPoolInstance.feePercentage.call();
      assert.equal(
        web3Utils.toBN(feeDataOutput).toString(),
        web3Utils.toBN(newFeePerc),
        'Wrong feeData percentage',
      );
    });
    it('Can set fee recipients', async () => {
      const feeDataTx = await liquidityPoolInstance.setFeeRecipients(
        [firstUser, secondUser],
        [40, 80],
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(feeDataTx, 'SetFeeRecipients', ev => {
        return (
          ev.feeRecipients[0] == firstUser &&
          ev.feeRecipients[1] == secondUser &&
          ev.feeProportions[0] == 40 &&
          ev.feeProportions[1] == 80
        );
      });
      const feeDataOutput = await liquidityPoolInstance.feeRecipientsInfo.call();
      assert.equal(feeDataOutput[0][0], firstUser, 'Wrong first user address');
      assert.equal(
        feeDataOutput[0][1],
        secondUser,
        'Wrong second user address',
      );
      assert.equal(feeDataOutput[1][0], 40, 'Wrong first proportion');
      assert.equal(feeDataOutput[1][1], 80, 'Wrong second proportion');
      assert.equal(feeDataOutput[2], 120, 'Wrong total feeData proportion');
    });
    it('Can set fee', async () => {
      const newFeePerc = web3Utils.toWei('0.1');
      const newFee = {
        feePercentage: {
          rawValue: newFeePerc,
        },
        feeRecipients: [firstUser, secondUser],
        feeProportions: [30, 70],
      };
      await liquidityPoolInstance.setFee(newFee, { from: maintainer });
      const feeDataPercentageOutput = await liquidityPoolInstance.feePercentage.call();
      assert.equal(
        web3Utils.toBN(feeDataPercentageOutput).toString(),
        web3Utils.toBN(newFeePerc),
        'Wrong feeData percentage',
      );
      const feeDataRecipientsOutput = await liquidityPoolInstance.feeRecipientsInfo.call();
      assert.equal(
        feeDataRecipientsOutput[0][0],
        firstUser,
        'Wrong first user address',
      );
      assert.equal(
        feeDataRecipientsOutput[0][1],
        secondUser,
        'Wrong second user address',
      );
      assert.equal(feeDataRecipientsOutput[1][0], 30, 'Wrong first proportion');
      assert.equal(
        feeDataRecipientsOutput[1][1],
        70,
        'Wrong second proportion',
      );
      assert.equal(
        feeDataRecipientsOutput[2],
        100,
        'Wrong total feeData proportion',
      );
    });
    it('Can revert if sender is not the maintainer', async () => {
      const newFeePerc = web3Utils.toWei('0.1');
      await truffleAssert.reverts(
        liquidityPoolInstance.setFeePercentage(newFeePerc, { from: firstUser }),
        'Sender must be the maintainer',
      );
      await truffleAssert.reverts(
        liquidityPoolInstance.setFeeRecipients(
          [firstUser, secondUser],
          [40, 80],
          {
            from: firstUser,
          },
        ),
        'Sender must be the maintainer',
      );
      const newFee = {
        feePercentage: {
          rawValue: newFeePerc,
        },
        feeRecipients: [firstUser, secondUser],
        feeProportions: [30, 70],
      };
      await truffleAssert.reverts(
        liquidityPoolInstance.setFee(newFee, { from: firstUser }),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if fee percentage is more than 100%', async () => {
      const newFeePerc = web3Utils.toWei('1.01');
      await truffleAssert.reverts(
        liquidityPoolInstance.setFeePercentage(newFeePerc, {
          from: maintainer,
        }),
        'Fee Percentage must be less than 100%',
      );
    });
    it('Can revert if number of recipients and proportions is different', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.setFeeRecipients([firstUser, secondUser], [40], {
          from: maintainer,
        }),
        'Fee recipients and fee proportions do not match',
      );
    });
  });

  describe('Should set overcollateralization', async () => {
    it('Can set overcollateralization parameter', async () => {
      const overCollateralizationParam = web3Utils.toWei('0.4');
      const overColllatTx = await liquidityPoolInstance.setOverCollateralization(
        overCollateralizationParam,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(
        overColllatTx,
        'SetOverCollateralization',
        ev => {
          return ev.overCollateralization == overCollateralizationParam;
        },
      );
      assert.equal(
        (await liquidityPoolInstance.overCollateralization.call()).toString(),
        web3Utils.toBN(overCollateralizationParam).toString(),
        'Wrong over-collateralization',
      );
    });
    it('Can revert if sender is not the maintainer ', async () => {
      const overCollateralizationParam = web3Utils.toWei('0.4');
      await truffleAssert.reverts(
        liquidityPoolInstance.setOverCollateralization(
          overCollateralizationParam,
          { from: firstUser },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if overcollateralization is less then collateral requirement', async () => {
      const overCollateralizationParam = web3Utils.toWei('0.049');
      await truffleAssert.reverts(
        liquidityPoolInstance.setOverCollateralization(
          overCollateralizationParam,
          { from: maintainer },
        ),
        'Overcollateralization must be bigger than the Lp part of the collateral requirement',
      );
    });
  });

  describe('Should set liquidation reward', async () => {
    it('Can set liquidation reward parameter', async () => {
      const liquidationRewardParam = web3Utils.toWei('0.4');
      const liquidationRewardTx = await liquidityPoolInstance.setLiquidationReward(
        liquidationRewardParam,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(
        liquidationRewardTx,
        'SetLiquidationReward',
        ev => {
          return ev.liquidationReward == liquidationRewardParam;
        },
      );
      assert.equal(
        (await liquidityPoolInstance.liquidationReward.call()).toString(),
        web3Utils.toBN(liquidationRewardParam).toString(),
        'Wrong liquidation reward',
      );
    });
    it('Can revert if sender is not the maintainer ', async () => {
      const liquidationRewardParam = web3Utils.toWei('0.4');
      await truffleAssert.reverts(
        liquidityPoolInstance.setLiquidationReward(liquidationRewardParam, {
          from: firstUser,
        }),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if liquidation reward is more than 100%', async () => {
      const liquidationRewardParam = web3Utils.toWei('1.01');
      await truffleAssert.reverts(
        liquidityPoolInstance.setLiquidationReward(liquidationRewardParam, {
          from: maintainer,
        }),
        'Liquidation reward must be between 0 and 100%',
      );
    });
    it('Can revert if liquidation reward is 0%', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.setLiquidationReward('0', {
          from: maintainer,
        }),
        'Liquidation reward must be between 0 and 100%',
      );
    });
  });

  describe('Should return liquidation info', async () => {
    beforeEach(async () => {
      await liquidityPoolInstance.setFeePercentage(0, { from: maintainer });
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('100');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
    });
    it('Can return if is overCollateralized', async () => {
      let liquidationInfo = await liquidityPoolInstance.collateralCoverage.call();
      assert.equal(
        liquidationInfo[0],
        true,
        'Position is not overcollateralized',
      );
      await aggregatorInstance.updateAnswer(web3Utils.toWei('143', 'mwei'));
      liquidationInfo = await liquidityPoolInstance.collateralCoverage.call();
      assert.equal(liquidationInfo[0], false, 'Position is overcollateralized');
    });
    it('Can return percentage of collateral coverage ', async () => {
      await liquidityPoolInstance.increaseCollateral(
        0,
        web3Utils.toWei('60', 'mwei'),
        { from: liquidityProvider },
      );
      await aggregatorInstance.updateAnswer(web3Utils.toWei('125', 'mwei'));
      let liquidationInfo = await liquidityPoolInstance.collateralCoverage.call();
      let expectedRatio = web3Utils.toWei('1.68');
      assert.equal(
        liquidationInfo[1].toString(),
        web3Utils.toBN(expectedRatio).toString(),
        'Wrong collateral ratio in overcollateralization',
      );
      await aggregatorInstance.updateAnswer(web3Utils.toWei('200', 'mwei')),
        (liquidationInfo = await liquidityPoolInstance.collateralCoverage.call());
      assert.equal(
        liquidationInfo[1].toString(),
        web3Utils.toBN(collateralRequirement).toString(),
        'Wrong collateral ratio in undercollateralization',
      );
      assert.equal(liquidationInfo[0], true, 'Wrong collateralization status');
    });
  });

  describe('Should return trading info in mint operation', async () => {
    it('Can get mint info', async () => {
      const inputCollateral = web3Utils.toWei('120', 'mwei');
      const mintResult = await liquidityPoolInstance.getMintTradeInfo.call(
        inputCollateral,
      );
      assert.equal(
        web3Utils.toBN(mintResult.synthTokensReceived).toString(),
        web3Utils.toBN(web3Utils.toWei('99.8')).toString(),
        'Wrong synthetic tokens',
      );
      assert.equal(
        web3Utils.toBN(mintResult.feePaid).toString(),
        web3Utils.toBN(web3Utils.toWei('0.24', 'mwei')).toString(),
        'Wrong feeData paid',
      );
    });
    it('Can revert is no collateral amount passed', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.getMintTradeInfo.call('0'),
        'Sending collateral amount is equal to 0',
      );
    });
    it('Can revert is no enough liquidity available', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.getMintTradeInfo.call(web3Utils.toWei('4009')),
        'No enough liquidity for covering mint operation',
      );
    });
  });

  describe('Should return trading info in redeem operation', async () => {
    beforeEach(async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
    });
    it('Can get redeem info', async () => {
      const inputTokens = web3Utils.toWei('15');
      const redeemResult = await liquidityPoolInstance.getRedeemTradeInfo.call(
        inputTokens,
      );
      assert.equal(
        web3Utils.toBN(redeemResult.collateralAmountReceived).toString(),
        web3Utils.toBN(web3Utils.toWei('17.964', 'mwei')).toString(),
        'Wrong collateral amount',
      );
      assert.equal(
        web3Utils.toBN(redeemResult.feePaid).toString(),
        web3Utils.toBN(web3Utils.toWei('0.036', 'mwei')).toString(),
        'Wrong feeData paid',
      );
    });
    it('Can revert is no tokens  passed', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.getRedeemTradeInfo.call('0'),
        'Sending tokens amount is equal to 0',
      );
    });
    it('Can revert is more tokens than ones in positions are passed', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.getRedeemTradeInfo.call(web3Utils.toWei('99.9')),
        'Sending tokens amount bigger than amount in the position',
      );
    });
    it('Can revert is position is undercapitalized', async () => {
      await aggregatorInstance.updateAnswer(web3Utils.toWei('150.01', 'mwei'));
      await truffleAssert.reverts(
        liquidityPoolInstance.getRedeemTradeInfo.call(web3Utils.toWei('10')),
        'Position undercapitalized',
      );
    });
  });

  describe('Should return trading info in exchange operation', async () => {
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
      destSynthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
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
      const wrongParams = {
        finder,
        version,
        collateralToken,
        syntheticToken: destSynthTokenAddress,
        roles,
        overCollateralization: destOverCollateralization,
        feeData,
        priceIdentifier: destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      };
      destLiquidityPoolInstance = await SynthereumLiquidityPool.new(
        wrongParams,
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
        collateralToken,
        version,
        destLiquidityPoolAddress,
      );
      await aggregatorInstance.updateAnswer(sourceRate);
    });
    it('Can get exchange info', async () => {
      const inputTokens = web3Utils.toWei('100');
      const exchangeResult = await liquidityPoolInstance.getExchangeTradeInfo.call(
        inputTokens,
        destLiquidityPoolAddress,
      );
      assert.equal(
        web3Utils.toBN(exchangeResult.destSyntheticTokensReceived).toString(),
        web3Utils.toBN(web3Utils.toWei('81.0875')).toString(),
        'Wrong dest synthetic tokens amount',
      );
      assert.equal(
        web3Utils.toBN(exchangeResult.feePaid).toString(),
        web3Utils.toBN(web3Utils.toWei('0.26', 'mwei')).toString(),
        'Wrong feeData paid',
      );
    });
    it('Can revert if source and destination pools are the same', async () => {
      const inputTokens = web3Utils.toWei('100');
      await truffleAssert.reverts(
        liquidityPoolInstance.getExchangeTradeInfo.call(
          inputTokens,
          liquidityPoolAddress,
        ),
        'Same source and destination pool',
      );
    });
    it('Can revert is no tokens  passed', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.getExchangeTradeInfo.call(
          '0',
          destLiquidityPoolAddress,
        ),
        'Sending tokens amount is equal to 0',
      );
    });
    it('Can revert is more tokens than ones in positions are passed', async () => {
      await truffleAssert.reverts(
        liquidityPoolInstance.getExchangeTradeInfo.call(
          web3Utils.toWei('200'),
          destLiquidityPoolAddress,
        ),
        'Sending tokens amount bigger than amount in the position',
      );
    });
    it('Can revert is position is undercapitalized', async () => {
      const inputTokens = web3Utils.toWei('100');
      await aggregatorInstance.updateAnswer(web3Utils.toWei('150.01', 'mwei'));
      await truffleAssert.reverts(
        liquidityPoolInstance.getExchangeTradeInfo.call(
          inputTokens,
          destLiquidityPoolAddress,
        ),
        'Position undercapitalized',
      );
    });
    it('Can revert if no collateral is sent to the destination pool', async () => {
      const inputTokens = web3Utils.toWei('100');
      await aggregatorInstance.updateAnswer('0');
      await truffleAssert.reverts(
        liquidityPoolInstance.getExchangeTradeInfo.call(
          inputTokens,
          destLiquidityPoolAddress,
        ),
        'Sending collateral amount is equal to 0',
      );
    });
    it('Can revert if not enough liquidity to cover mint operation in the destination pool', async () => {
      const inputTokens = web3Utils.toWei('100');
      const destAvailableLiquidity = await destLiquidityPoolInstance.totalAvailableLiquidity.call();
      const withdrawLiquidity = web3Utils
        .toBN(destAvailableLiquidity)
        .sub(web3Utils.toBN(web3Utils.toWei('19', 'mwei')));
      await destLiquidityPoolInstance.withdrawLiquidity(withdrawLiquidity, {
        from: liquidityProvider,
      });
      await truffleAssert.reverts(
        liquidityPoolInstance.getExchangeTradeInfo.call(
          inputTokens,
          destLiquidityPoolAddress,
        ),
        'No enough liquidity for covering mint operation',
      );
    });
  });

  describe('Should trigger transaction using forwarder for meta-tx', async () => {
    let forwarderIntstance;
    let forwarderAddress;
    let networkId;
    let nonce;
    before(async () => {
      forwarderIntstance = await SynthereumTrustedForwarder.deployed();
      forwarderAddress = forwarderIntstance.address;
      networkId = await web3.eth.net.getId();
    });
    it('Can mint with meta-tx', async () => {
      const collateralAmount = web3Utils.toWei('120', 'mwei');
      const feeDataAmount = web3Utils.toWei('0.24048', 'mwei');
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
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      const mintOperation = {
        minNumTokens: synthTokens,
        collateralAmount: totalCollateralAmount,
        expiration: expirationTime,
        recipient: firstUser,
      };
      const mintData = mintV5Encoding(
        synthTokens,
        totalCollateralAmount,
        expirationTime,
        firstUser,
      );
      nonce = (await forwarderIntstance.getNonce.call(firstUser)).toString();
      const mintMetaTxSignature = generateForwarderSignature(
        firstUser,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        mintData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/4"),
      );
      const forwarderRequest = {
        from: firstUser,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: mintData,
      };
      const mintTx = await forwarderIntstance.safeExecute(
        forwarderRequest,
        mintMetaTxSignature,
        {
          from: relayer,
        },
      );
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
        feeDataAmount,
        lpAmount,
        daoAmount,
        web3Utils
          .toBN(initialPoolAllocation)
          .add(web3Utils.toBN(totalCollateralAmount))
          .toString(),
      );
    });
    it('Can redeem with meta-tx', async () => {
      const totalMintCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const mintExpirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalMintCollateralAmount,
        expiration: mintExpirationTime,
        recipient: firstUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalMintCollateralAmount,
        { from: firstUser },
      );
      await liquidityPoolInstance.mint(mintOperation, {
        from: firstUser,
      });
      await synthTokenInstance.transfer(secondUser, totSynthTokens, {
        from: firstUser,
      });
      await aggregatorInstance.updateAnswer(web3Utils.toWei('115', 'mwei'));
      const synthTokens = web3Utils.toWei('50');
      const totalCollateralAmount = web3Utils.toWei('57.5', 'mwei');
      const collateralAmount = web3Utils.toWei('57.385', 'mwei');
      const feeDataAmount = web3Utils.toWei('0.115', 'mwei');
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

      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: secondUser,
      });
      const redeemData = redeemV5Encoding(
        synthTokens,
        collateralAmount,
        expirationTime,
        secondUser,
      );
      nonce = (await forwarderIntstance.getNonce.call(secondUser)).toString();
      const redeemMetaTxSignature = generateForwarderSignature(
        secondUser,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        redeemData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/5"),
      );
      const forwarderRequest = {
        from: secondUser,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: redeemData,
      };
      const redeemTx = await forwarderIntstance.safeExecute(
        forwarderRequest,
        redeemMetaTxSignature,
        {
          from: relayer,
        },
      );
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
          .add(web3Utils.toBN(feeDataAmount))
          .toString(),
        web3Utils.toBN(totalLpAmount).add(web3Utils.toBN(lpFee)).toString(),
        web3Utils.toBN(totalDaoAmount).add(web3Utils.toBN(daoFee)).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(collateralAmount))
          .toString(),
      );
    });
    it('Can exchange with meta-tx', async () => {
      const destSynthTokenSymbol = 'jGBP';
      const destPriceFeedIdentifier = web3Utils.padRight(
        web3Utils.toHex('GBP/USD'),
        64,
      );
      const destOverCollateralization = web3Utils.toWei('0.15');
      const sourceRate = web3Utils.toWei('130', 'mwei');
      const destRate = web3Utils.toWei('160', 'mwei');
      const totalMintCollateralAmount = web3Utils.toWei('240', 'mwei');
      const totSynthTokens = web3Utils.toWei('199.6');
      const mintExpirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalMintCollateralAmount,
        expiration: mintExpirationTime,
        recipient: firstUser,
      };
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalMintCollateralAmount,
        { from: firstUser },
      );
      await liquidityPoolInstance.mint(mintOperation, {
        from: firstUser,
      });
      destSynthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Sterlin',
        destSynthTokenSymbol,
        18,
        { from: admin },
      );
      const destSynthTokenAddress = destSynthTokenInstance.address;
      const destAggregatorInstance = await MockAggregator.new(8, destRate);
      const destAggregatorAddress = destAggregatorInstance.address;
      await priceFeedInstance.setAggregator(
        destPriceFeedIdentifier,
        destAggregatorAddress,
        { from: maintainer },
      );
      const destParams = {
        finder,
        version,
        collateralToken,
        syntheticToken: destSynthTokenAddress,
        roles,
        overCollateralization: destOverCollateralization,
        feeData,
        priceIdentifier: destPriceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      };
      destLiquidityPoolInstance = await SynthereumLiquidityPool.new(destParams);
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
        collateralToken,
        version,
        destLiquidityPoolAddress,
      );
      await aggregatorInstance.updateAnswer(sourceRate);
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
      const exchangeData = exchangeV5Encoding(
        destLiquidityPoolAddress,
        synthTokens,
        destNumTokens.toString(),
        expirationTime,
        firstUser,
      );
      await synthTokenInstance.approve(liquidityPoolAddress, synthTokens, {
        from: firstUser,
      });
      nonce = (await forwarderIntstance.getNonce.call(firstUser)).toString();
      const exchangeMetaTxSignature = generateForwarderSignature(
        firstUser,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        exchangeData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/4"),
      );
      const forwarderRequest = {
        from: firstUser,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: exchangeData,
      };
      const exchangeTx = await forwarderIntstance.safeExecute(
        forwarderRequest,
        exchangeMetaTxSignature,
        {
          from: relayer,
        },
      );
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
    });
    it('Can withdraw liquidity from the pool with meta-tx', async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
      const unusedCollateral = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const lpBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const withdrawAmount = web3Utils.toWei('150', 'mwei');
      const remainingLiquidity = web3Utils
        .toBN(unusedCollateral)
        .sub(web3Utils.toBN(withdrawAmount))
        .toString();
      const withdrawLiquidityData = withdrawLiquidityV5Encoding(withdrawAmount);
      nonce = (
        await forwarderIntstance.getNonce.call(liquidityProvider)
      ).toString();
      const withdrawLiquidityMetaTxSignature = generateForwarderSignature(
        liquidityProvider,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        withdrawLiquidityData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/2"),
      );
      const forwarderRequest = {
        from: liquidityProvider,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: withdrawLiquidityData,
      };
      const withdrawTx = await forwarderIntstance.safeExecute(
        forwarderRequest,
        withdrawLiquidityMetaTxSignature,
        {
          from: relayer,
        },
      );
      assert.equal(
        (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
        web3Utils
          .toBN(unusedCollateral)
          .sub(web3Utils.toBN(withdrawAmount))
          .toString(),
        'Wrong withdraw amount',
      );
      assert.equal(
        (await collateralInstance.balanceOf.call(liquidityProvider)).toString(),
        web3Utils
          .toBN(lpBalance)
          .add(web3Utils.toBN(withdrawAmount))
          .toString(),
        'Wrong LP balance after withdraw',
      );
    });
    it('Can increase collateral in the position with meta-tx', async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
      const collateralToAdd = web3Utils.toWei('50', 'mwei');
      const unusedCollateral = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const actualPositionCollateral = await liquidityPoolInstance.totalCollateralAmount.call();
      const increaseCollateralData = increaseCollateralV5Encoding(
        0,
        collateralToAdd,
      );
      nonce = (
        await forwarderIntstance.getNonce.call(liquidityProvider)
      ).toString();
      const increaseCollateralMetaTxSignature = generateForwarderSignature(
        liquidityProvider,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        increaseCollateralData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/2"),
      );
      const forwarderRequest = {
        from: liquidityProvider,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: increaseCollateralData,
      };
      const increaseCollateralTx = await forwarderIntstance.safeExecute(
        forwarderRequest,
        increaseCollateralMetaTxSignature,
        {
          from: relayer,
        },
      );
      const newTotalCollateral = web3Utils
        .toBN(actualPositionCollateral)
        .add(web3Utils.toBN(collateralToAdd))
        .toString();
      assert.equal(
        (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
        web3Utils
          .toBN(unusedCollateral)
          .sub(web3Utils.toBN(collateralToAdd))
          .toString(),
        'Wrong liquidity after increasing collateral',
      );
      assert.equal(
        (await liquidityPoolInstance.totalCollateralAmount.call()).toString(),
        web3Utils
          .toBN(actualPositionCollateral)
          .add(web3Utils.toBN(collateralToAdd))
          .toString(),
        'Wrong increase collateral amount',
      );
    });
    it('Can decrease collateral from the position with meta-tx', async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
      const collateralToRemove = web3Utils.toWei('23.5', 'mwei');
      const unusedCollateral = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const actualPositionCollateral = await liquidityPoolInstance.totalCollateralAmount.call();
      const decreaseCollateralData = decreaseCollateralV5Encoding(
        collateralToRemove,
        0,
      );
      nonce = (
        await forwarderIntstance.getNonce.call(liquidityProvider)
      ).toString();
      const decreaseCollateralMetaTxSignature = generateForwarderSignature(
        liquidityProvider,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        decreaseCollateralData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/2"),
      );
      const forwarderRequest = {
        from: liquidityProvider,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: decreaseCollateralData,
      };
      const decreaseCollateralTx = await forwarderIntstance.safeExecute(
        forwarderRequest,
        decreaseCollateralMetaTxSignature,
        {
          from: relayer,
        },
      );
      const newTotalCollateral = web3Utils
        .toBN(actualPositionCollateral)
        .sub(web3Utils.toBN(collateralToRemove))
        .toString();
      assert.equal(
        (await liquidityPoolInstance.totalAvailableLiquidity.call()).toString(),
        web3Utils
          .toBN(unusedCollateral)
          .add(web3Utils.toBN(collateralToRemove))
          .toString(),
        'Wrong liquidity after decreasing collateral',
      );
      assert.equal(
        (await liquidityPoolInstance.totalCollateralAmount.call()).toString(),
        web3Utils
          .toBN(actualPositionCollateral)
          .sub(web3Utils.toBN(collateralToRemove))
          .toString(),
        'Wrong decrease collateral amount',
      );
    });
    it('Can claim fees with meta-tx', async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
      const actualLpBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const actualDaoBalance = await collateralInstance.balanceOf.call(DAO);
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const lpFee = await liquidityPoolInstance.userFee.call(liquidityProvider);
      const daoFee = await liquidityPoolInstance.userFee.call(DAO);
      const poolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      const claimeFeeData = claimFeeV5Encoding();
      nonce = (
        await forwarderIntstance.getNonce.call(liquidityProvider)
      ).toString();
      const claimeFeeMetaTxSignature = generateForwarderSignature(
        liquidityProvider,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        claimeFeeData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/2"),
      );
      const forwarderRequest = {
        from: liquidityProvider,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: claimeFeeData,
      };
      const decreaseCollateralTx = await forwarderIntstance.safeExecute(
        forwarderRequest,
        claimeFeeMetaTxSignature,
        {
          from: relayer,
        },
      );
      assert.equal(
        (await collateralInstance.balanceOf.call(liquidityProvider)).toString(),
        web3Utils.toBN(actualLpBalance).add(web3Utils.toBN(lpFee)).toString(),
        'Wrong Lp balance after LP claim fee',
      );
      assert.equal(
        (
          await collateralInstance.balanceOf.call(liquidityPoolAddress)
        ).toString(),
        web3Utils.toBN(poolBalance).sub(web3Utils.toBN(lpFee)).toString(),
        'Wrong pool balance after Lp claim fee',
      );
      assert.equal(
        (await collateralInstance.balanceOf.call(DAO)).toString(),
        actualDaoBalance.toString(),
        'Wrong Dao balance after LP claim fee',
      );
      assert.equal(
        (
          await liquidityPoolInstance.userFee.call(liquidityProvider)
        ).toString(),
        '0',
        'Wrong Lp fee in the pool',
      );
      assert.equal(
        (await liquidityPoolInstance.userFee.call(DAO)).toString(),
        daoFee.toString(),
        'Wrong Dao fee in the pool',
      );
      assert.equal(
        (await liquidityPoolInstance.totalFeeAmount.call()).toString(),
        web3Utils.toBN(totalFeeAmount).sub(web3Utils.toBN(lpFee)).toString(),
        'Wrong total fee in the pool',
      );
    });
    it('Can liquidate with meta-tx', async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
      const emergencyPrice = web3Utils.toWei('148', 'mwei');
      const resultingPrice = web3Utils.toWei('1.48');
      await aggregatorInstance.updateAnswer(emergencyPrice);
      const availableLiquidity = await liquidityPoolInstance.totalAvailableLiquidity.call();
      const firstUserSynthTokens = web3Utils.toWei('79.8');
      const secondUserSynthTokens = web3Utils.toWei('20');
      await synthTokenInstance.transfer(secondUser, secondUserSynthTokens, {
        from: firstUser,
      });
      const firstUserCollateralAmount = web3Utils.toWei('118.104', 'mwei');
      let totalCollateralPosition = await liquidityPoolInstance.totalCollateralAmount.call();
      let totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      let collateralPortion = web3Utils
        .toBN(firstUserSynthTokens)
        .mul(web3Utils.toBN(Math.pow(10, 18)))
        .div(web3Utils.toBN(totalSynthTokensInPool))
        .mul(web3Utils.toBN(totalCollateralPosition))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const liquidationReward = await liquidityPoolInstance.liquidationReward.call();
      const firstUserReward = collateralPortion
        .sub(web3Utils.toBN(firstUserCollateralAmount))
        .mul(web3Utils.toBN(liquidationReward))
        .div(web3Utils.toBN(Math.pow(10, 18)));
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const actualFirstUserCollBalance = await collateralInstance.balanceOf.call(
        firstUser,
      );
      const actualFirstUserSynthBalance = await synthTokenInstance.balanceOf.call(
        firstUser,
      );
      const totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      await synthTokenInstance.approve(
        liquidityPoolAddress,
        firstUserSynthTokens,
        { from: firstUser },
      );
      const liquidateData = liquidateV5Encoding(firstUserSynthTokens);
      nonce = (await forwarderIntstance.getNonce.call(firstUser)).toString();
      const liquidationMetaTxSignature = generateForwarderSignature(
        firstUser,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        liquidateData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/4"),
      );
      const forwarderRequest = {
        from: firstUser,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: liquidateData,
      };
      const liquidationTx = await forwarderIntstance.safeExecute(
        forwarderRequest,
        liquidationMetaTxSignature,
        {
          from: relayer,
        },
      );
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        firstUser,
        web3Utils
          .toBN(actualFirstUserCollBalance)
          .add(web3Utils.toBN(firstUserCollateralAmount))
          .add(web3Utils.toBN(firstUserReward))
          .toString(),
        '0',
        availableLiquidity.toString(),
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .sub(web3Utils.toBN(firstUserReward))
          .toString(),
        web3Utils
          .toBN(totalSynthTokensInPool)
          .sub(web3Utils.toBN(firstUserSynthTokens))
          .toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(firstUserCollateralAmount))
          .sub(web3Utils.toBN(firstUserReward))
          .toString(),
      );
    });
    it('Can settle after emergency shutdown with meta-tx', async () => {
      const totalCollateralAmount = web3Utils.toWei('120', 'mwei');
      const totSynthTokens = web3Utils.toWei('99.8');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      const mintOperation = {
        minNumTokens: totSynthTokens,
        collateralAmount: totalCollateralAmount,
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
      await aggregatorInstance.updateAnswer(web3Utils.toWei('115', 'mwei'));
      const collateralAmount = web3Utils.toWei('114.77', 'mwei');
      const totalCollateralPosition = (
        await liquidityPoolInstance.totalCollateralAmount.call()
      ).add(await liquidityPoolInstance.totalAvailableLiquidity.call());
      const expectedLpAmount = web3Utils
        .toBN(totalCollateralPosition)
        .sub(web3Utils.toBN(collateralAmount));
      const totalFeeAmount = await liquidityPoolInstance.totalFeeAmount.call();
      const actualLpCollBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const actualLpSynthBalance = await synthTokenInstance.balanceOf.call(
        liquidityProvider,
      );
      const totalSynthTokensInPool = await liquidityPoolInstance.totalSyntheticTokens.call();
      const totalPoolBalance = await collateralInstance.balanceOf.call(
        liquidityPoolAddress,
      );
      await managerInstance.emergencyShutdown([liquidityPoolAddress], {
        from: maintainer,
      });
      const settleData = settleEmergencyShutdownV5Encoding();
      nonce = (
        await forwarderIntstance.getNonce.call(liquidityProvider)
      ).toString();
      const settleMetaTxSignature = generateForwarderSignature(
        liquidityProvider,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        settleData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/2"),
      );
      const forwarderRequest = {
        from: liquidityProvider,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: settleData,
      };
      const settleTx = await forwarderIntstance.safeExecute(
        forwarderRequest,
        settleMetaTxSignature,
        {
          from: relayer,
        },
      );
      await checkResult(
        liquidityPoolInstance,
        synthTokenInstance,
        liquidityProvider,
        web3Utils
          .toBN(actualLpCollBalance)
          .add(web3Utils.toBN(expectedLpAmount))
          .toString(),
        '0',
        '0',
        web3Utils
          .toBN(totalCollateralPosition)
          .sub(web3Utils.toBN(expectedLpAmount))
          .toString(),
        web3Utils.toBN(totalSynthTokensInPool).toString(),
        web3Utils.toBN(totalFeeAmount).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils.toBN(totalFeeAmount).div(web3Utils.toBN('2')).toString(),
        web3Utils
          .toBN(totalPoolBalance)
          .sub(web3Utils.toBN(expectedLpAmount))
          .toString(),
      );
    });
    it('Can revert if wrong nonce in the meta-tx', async () => {
      const totalCollateralAmount = web3Utils.toWei('120.24048', 'mwei');
      const synthTokens = web3Utils.toWei('100');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      const mintOperation = {
        minNumTokens: synthTokens,
        collateralAmount: totalCollateralAmount,
        expiration: expirationTime,
        recipient: firstUser,
      };
      const mintData = mintV5Encoding(
        synthTokens,
        totalCollateralAmount,
        expirationTime,
        firstUser,
      );
      nonce = (
        (await forwarderIntstance.getNonce.call(firstUser)) - 1
      ).toString();
      const mintMetaTxSignature = generateForwarderSignature(
        firstUser,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        mintData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/4"),
      );
      const forwarderRequest = {
        from: firstUser,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: mintData,
      };
      await truffleAssert.reverts(
        forwarderIntstance.safeExecute(forwarderRequest, mintMetaTxSignature, {
          from: relayer,
        }),
        'MinimalForwarder: signature does not match request',
      );
    });
    it('Can revert if wrong signature in the meta-tx', async () => {
      const totalCollateralAmount = web3Utils.toWei('120.24048', 'mwei');
      const synthTokens = web3Utils.toWei('100');
      const expirationTime = (expiration =
        (await web3.eth.getBlock('latest')).timestamp + 60);
      await collateralInstance.approve(
        liquidityPoolAddress,
        totalCollateralAmount,
        { from: firstUser },
      );
      const mintOperation = {
        minNumTokens: synthTokens,
        collateralAmount: totalCollateralAmount,
        expiration: expirationTime,
        recipient: firstUser,
      };
      const mintData = mintV5Encoding(
        synthTokens,
        totalCollateralAmount,
        expirationTime,
        firstUser,
      );
      nonce = (await forwarderIntstance.getNonce.call(firstUser)).toString();
      const mintMetaTxSignature = generateForwarderSignature(
        firstUser,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        mintData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/1"),
      );
      const forwarderRequest = {
        from: firstUser,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: mintData,
      };
      await truffleAssert.reverts(
        forwarderIntstance.safeExecute(forwarderRequest, mintMetaTxSignature, {
          from: relayer,
        }),
        'MinimalForwarder: signature does not match request',
      );
    });
    it('Can revert if wrong call to the liquidity pool in the meta-tx', async () => {
      const wrongData = '0xaabbccdd';
      nonce = (await forwarderIntstance.getNonce.call(firstUser)).toString();
      const wrongMetaTxSignature = generateForwarderSignature(
        firstUser,
        liquidityPoolAddress,
        0,
        MAX_GAS,
        nonce,
        wrongData,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/4"),
      );
      const forwarderRequest = {
        from: firstUser,
        to: liquidityPoolAddress,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: wrongData,
      };
      await truffleAssert.reverts(
        forwarderIntstance.safeExecute(forwarderRequest, wrongMetaTxSignature, {
          from: relayer,
        }),
        'Error in the TrustedForwarder call',
      );
    });
    it('Can use pool with standard transactions if no forwarder is set in the finder', async () => {
      const forwarderInterface = await web3.utils.stringToHex(
        'TrustedForwarder',
      );
      await finderInstance.changeImplementationAddress(
        forwarderInterface,
        ZERO_ADDRESS,
        { from: maintainer },
      );
      const collateralAmount = web3Utils.toWei('120', 'mwei');
      const feeDataAmount = web3Utils.toWei('0.24048', 'mwei');
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
        feeDataAmount,
        lpAmount,
        daoAmount,
        web3Utils
          .toBN(initialPoolAllocation)
          .add(web3Utils.toBN(totalCollateralAmount))
          .toString(),
      );
      await finderInstance.changeImplementationAddress(
        forwarderInterface,
        forwarderAddress,
        { from: maintainer },
      );
    });
    it('Can test msgData with meta-tx', async () => {
      await MockContext.link(liquidityPoolLibInstance);
      const context = await MockContext.new(params);
      const data = Web3EthAbi.encodeFunctionSignature('test()');
      const userResult = await context.test.call({ from: firstUser });
      assert.equal(userResult[1], data, 'Wrong user data');
      nonce = (await forwarderIntstance.getNonce.call(firstUser)).toString();
      const dataMetaTxSignature = generateForwarderSignature(
        firstUser,
        context.address,
        0,
        MAX_GAS,
        nonce,
        data,
        networkId,
        forwarderAddress,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/4"),
      );
      const forwarderRequest = {
        from: firstUser,
        to: context.address,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: data,
      };
      const metaCallResult = await forwarderIntstance.safeExecute.call(
        forwarderRequest,
        dataMetaTxSignature,
        {
          from: relayer,
        },
      );
      const metaResult = Web3EthAbi.decodeParameters(
        ['address', 'bytes'],
        metaCallResult,
      );
      assert.equal(metaResult[1], data, 'Wrong meta-data');
    });
  });
});
