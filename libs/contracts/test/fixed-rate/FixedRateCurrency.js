/* eslint-disable */
const { artifacts, contract, Web3 } = require('hardhat');
const Web3Utils = require('web3-utils');
const Web3EthAbi = require('web3-eth-abi');

const truffleAssert = require('truffle-assertions');
const { assert } = require('chai');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');

const Derivative = artifacts.require('PerpetualPoolParty');
const FixedRateCurrency = artifacts.require('FixedRateCurrency');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
} = require('../../utils/encoding.js');
const {
  collapseTextChangeRangesAcrossMultipleVersions,
} = require('typescript');

const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumManager = artifacts.require('SynthereumManager');

const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumPoolOnChainPriceFeed = artifacts.require(
  'SynthereumPoolOnChainPriceFeed',
);
const MintableBurnableERC20 = artifacts.require('MintableBurnableERC20');

contract('Fixed Rate Currency', accounts => {
  let derivativeVersion = 2;

  // Derivative params
  let collateralAddress;
  let collateralInstance;
  let priceFeedIdentifier = 'EUR/USD';
  let secondPriceFeedIdentifier = 'GBP/USD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let secondSyntheticName = 'Jarvis Synthetic British Pound';
  let syntheticSymbol = 'jEUR';
  let secondSyntheticSymbol = 'jGBP';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let collateralRequirement = Web3Utils.toWei('1.1');
  let disputeBondPct = Web3Utils.toWei('0.05');
  let sponsorDisputeRewardPct = Web3Utils.toWei('0.5');
  let disputerDisputeRewardPct = Web3Utils.toWei('0.2');
  let minSponsorTokens = Web3Utils.toWei('0');
  let withdrawalLiveness = 7200;
  let liquidationLiveness = 7200;
  let excessBeneficiary = accounts[4];
  let derivativeAdmins;
  let derivativePools;

  // pool params
  let poolInstance;
  let derivativeAddress = ZERO_ADDRESS;
  let synthereumFinderAddress;
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
  };
  let startingCollateralization = '1500000';
  let secondStartingCollateralization = '1700000';
  let feePercentage = '0.002';
  let feePercentageWei;
  let feeAmount = Web3Utils.toWei((120 * feePercentage).toString(), 'mwei');

  let DAO = accounts[5];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  let poolStartingDeposit = Web3Utils.toWei('1000', 'mwei');

  // Fixed rate params
  let fixedRateCurrencyInstance;
  let fixedRateAddr;
  let derivativeInstance;
  let pegTokenAddr;
  let pegRate = 2;
  let bnPegRate = Web3Utils.toBN(pegRate);
  let name = 'Jarvis Bulgarian Lev';
  let symbol = 'jBGN';
  let PRECISION = 1e18;
  let bnPRECISION = Web3Utils.toBN(PRECISION);

  //mint jEur params
  let numTokens = Web3Utils.toWei('99.8');
  let collateralAmount = Web3Utils.toWei('120', 'mwei');
  let expiration;

  let user = accounts[6];
  beforeEach(async () => {
    // deploy derivatives and synthereum pool
    collateralInstance = await TestnetERC20.deployed();
    collateralAddress = collateralInstance.address; //USDC
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 4;
    feePercentageWei = Web3Utils.toWei(feePercentage);

    synthereumFinderAddress = (await SynthereumFinder.deployed()).address;
    expiration = (await web3.eth.getBlock('latest')).timestamp + 60;

    derivativePayload = encodeDerivative(
      collateralAddress,
      priceFeedIdentifier,
      syntheticName,
      syntheticSymbol,
      syntheticTokenAddress,
      collateralRequirement,
      disputeBondPct,
      sponsorDisputeRewardPct,
      disputerDisputeRewardPct,
      minSponsorTokens,
      withdrawalLiveness,
      liquidationLiveness,
      excessBeneficiary,
      derivativeAdmins,
      derivativePools,
    );

    poolPayload = encodePoolOnChainPriceFeed(
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      roles,
      startingCollateralization,
      fee,
    );

    const addresses = await deployerInstance.deployPoolAndDerivative.call(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    poolAddress = addresses.pool;
    derivativeAddress = addresses.derivative;
    await deployerInstance.deployPoolAndDerivative(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );

    poolInstance = await SynthereumPoolOnChainPriceFeed.at(poolAddress);

    // deploy fixed rate currency contract
    derivativeInstance = await Derivative.at(derivativeAddress);
    pegTokenAddr = await derivativeInstance.tokenCurrency.call();
    pegTokenInstance = await MintableBurnableERC20.at(pegTokenAddr);
    atomicSwapAddrMock = accounts[10];
    fixedRateCurrencyInstance = await FixedRateCurrency.new(
      pegTokenAddr,
      collateralAddress,
      poolAddress,
      synthereumFinderAddress,
      atomicSwapAddrMock,
      admin,
      pegRate,
      name,
      symbol,
    );
    fixedRateAddr = fixedRateCurrencyInstance.address;
  });

  describe('Deployment', () => {
    it('correctly deploys a new instance', () => {
      assert.isDefined(fixedRateCurrencyInstance.address);
    });
    it('correctly initialises the contract', async () => {
      assert.strictEqual(await fixedRateCurrencyInstance.name.call(), name);
      assert.strictEqual(await fixedRateCurrencyInstance.symbol.call(), symbol);
      assert.strictEqual(
        await fixedRateCurrencyInstance.synthereumFinder.call(),
        synthereumFinderAddress,
      );
      assert.strictEqual(
        await fixedRateCurrencyInstance.synthereumPool.call(),
        poolAddress,
      );

      actualRate = await fixedRateCurrencyInstance.rate.call();
      assert.strictEqual(actualRate.eq(bnPegRate), true);
      assert.strictEqual(
        await fixedRateCurrencyInstance.synth.call(),
        pegTokenAddr,
      );
    });
  });

  describe('Mint with Peg Synth', () => {
    let pegBalance;

    beforeEach(async () => {
      let MintParams = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
        recipient: user,
      };

      // deposit some collateral in the pool
      await collateralInstance.allocateTo(poolAddress, poolStartingDeposit);

      // allocate collateral to user and approve pool
      await collateralInstance.allocateTo(user, collateralAmount);
      await collateralInstance.approve(poolAddress, collateralAmount, {
        from: user,
      });

      // mint pegSynth and approve fixedRateCurrency
      await poolInstance.mint(MintParams, { from: user });
      pegBalance = await pegTokenInstance.balanceOf.call(user);
      await pegTokenInstance.approve(fixedRateAddr, pegBalance, { from: user });
    });

    it('Correctly mints fixed rate token against its peg synth', async () => {
      const tx = await fixedRateCurrencyInstance.mintFromPegSynth(pegBalance, {
        from: user,
      });

      const userBalance = await fixedRateCurrencyInstance.balanceOf.call(user);
      const pegTokenBalanceAfter = await pegTokenInstance.balanceOf.call(user);
      const totalDeposit = await fixedRateCurrencyInstance.total_deposited.call();

      truffleAssert.eventEmitted(tx, 'Mint', ev => {
        return (
          ev.account == user &&
          ev.tokenCollateral == pegTokenAddr &&
          ev.numTokens == parseInt(userBalance) &&
          ev.tokenAddress == fixedRateAddr
        );
      });

      assert.equal(totalDeposit.eq(pegBalance), true);
      assert.equal(pegTokenBalanceAfter.eq(Web3Utils.toBN(0)), true);
      assert.equal(
        userBalance.eq(pegBalance.mul(bnPegRate).div(bnPRECISION)),
        true,
      );
    });

    it('Rejects if peg token balance is insufficient', async () => {
      bigAmount = pegBalance.add(Web3Utils.toBN(10));

      const userBalanceBefore = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const pegTokenBalanceBefore = await pegTokenInstance.balanceOf.call(user);
      const totalDepositBefore = await fixedRateCurrencyInstance.total_deposited.call();
      await truffleAssert.reverts(
        fixedRateCurrencyInstance.mintFromPegSynth(bigAmount, { from: user }),
        'ERC20: transfer amount exceeds balance',
      );

      const userBalanceAfter = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const pegTokenBalanceAfter = await pegTokenInstance.balanceOf.call(user);
      const totalDepositAfter = await fixedRateCurrencyInstance.total_deposited.call();

      assert.equal(userBalanceAfter.eq(userBalanceBefore), true);
      assert.equal(pegTokenBalanceAfter.eq(pegTokenBalanceBefore), true);
      assert.equal(totalDepositBefore.eq(totalDepositAfter), true);
    });

    it('Rejects if contract has been paused by admin', async () => {
      await fixedRateCurrencyInstance.pauseContract({ from: admin });

      await truffleAssert.reverts(
        fixedRateCurrencyInstance.mintFromPegSynth(pegBalance, { from: user }),
        'Contract has been paused',
      );
    });
  });

  describe('Redeem to Peg Synth', () => {
    let pegBalance;
    beforeEach(async () => {
      let MintParams = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
        recipient: user,
      };

      // deposit some collateral in the pool
      await collateralInstance.allocateTo(poolAddress, poolStartingDeposit);

      // allocate collateral to user and approve pool
      await collateralInstance.allocateTo(user, collateralAmount);
      await collateralInstance.approve(poolAddress, collateralAmount, {
        from: user,
      });

      // mint pegSynth and approve fixedRateCurrency
      await poolInstance.mint(MintParams, { from: user });
      pegBalance = await pegTokenInstance.balanceOf.call(user);
      await pegTokenInstance.approve(fixedRateAddr, pegBalance, { from: user });

      // mint fixed rate synth using all the pegSynth balance
      await fixedRateCurrencyInstance.mintFromPegSynth(pegBalance, {
        from: user,
      });
    });

    it('Correctly burns and redeem underlying synth', async () => {
      const redeemRatio = Web3Utils.toBN(2);
      const bnFixedCurrencyTotSupply = Web3Utils.toBN(
        await fixedRateCurrencyInstance.totalSupply.call(),
      );
      const totalDepositBefore = await fixedRateCurrencyInstance.total_deposited.call();
      const userBalanceBefore = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const redeemAmount = userBalanceBefore.div(redeemRatio);

      // redeem tx
      const tx = await fixedRateCurrencyInstance.redeemToPegSynth(
        redeemAmount,
        {
          from: user,
        },
      );

      const userBalanceAfter = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const pegTokenBalanceAfter = await pegTokenInstance.balanceOf.call(user);
      const totalDepositAfter = await fixedRateCurrencyInstance.total_deposited.call();
      const pegTokensRedeemed = redeemAmount
        .mul(totalDepositBefore)
        .div(bnFixedCurrencyTotSupply);

      truffleAssert.eventEmitted(tx, 'Redeem', ev => {
        return (
          ev.account == user &&
          ev.tokenBurned == fixedRateAddr &&
          ev.tokenRedeemed == pegTokenAddr &&
          ev.numTokensRedeemed == parseInt(pegTokenBalanceAfter)
        );
      });

      assert.equal(
        totalDepositAfter.eq(totalDepositBefore.sub(pegTokensRedeemed)),
        true,
      );
      assert.equal(pegTokenBalanceAfter.eq(pegTokensRedeemed), true);
      assert.equal(
        userBalanceAfter.eq(userBalanceBefore.sub(redeemAmount)),
        true,
      );
    });

    it('Reverts if fixed rate token balance is insufficient', async () => {
      const totalDepositBefore = await fixedRateCurrencyInstance.total_deposited.call();
      const userBalanceBefore = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const userPegBalanceBefore = await pegTokenInstance.balanceOf.call(user);

      const excessRedeemAmount = userBalanceBefore.mul(Web3Utils.toBN(2));
      await truffleAssert.reverts(
        fixedRateCurrencyInstance.redeemToPegSynth(excessRedeemAmount, {
          from: user,
        }),
        'VM Exception while processing transaction: revert Not enought tokens to unwrap',
      );

      const totalDepositAfter = await fixedRateCurrencyInstance.total_deposited.call();
      const userBalanceAfter = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const userPegBalanceAfter = await pegTokenInstance.balanceOf.call(user);

      assert.equal(userBalanceAfter.eq(userBalanceBefore), true);
      assert.equal(userPegBalanceAfter.eq(userPegBalanceBefore), true);
      assert.equal(totalDepositBefore.eq(totalDepositAfter), true);
    });

    it('Allows to redeem with contract paused', async () => {
      const userBalanceBefore = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const redeemRatio = Web3Utils.toBN(2);
      const redeemAmount = userBalanceBefore.div(redeemRatio);

      await fixedRateCurrencyInstance.pauseContract({ from: admin });

      // redeem tx
      const tx = await fixedRateCurrencyInstance.redeemToPegSynth(
        redeemAmount,
        {
          from: user,
        },
      );

      const pegTokenBalanceAfter = await pegTokenInstance.balanceOf.call(user);

      truffleAssert.eventEmitted(tx, 'Redeem', ev => {
        return (
          ev.account == user &&
          ev.tokenBurned == fixedRateAddr &&
          ev.tokenRedeemed == pegTokenAddr &&
          ev.numTokensRedeemed == parseInt(pegTokenBalanceAfter)
        );
      });
    });
  });

  describe('Mint with Synthereum Collateral (USDC)', () => {
    beforeEach(async () => {
      // deposit some collateral in the pool
      await collateralInstance.allocateTo(poolAddress, poolStartingDeposit);

      // allocate collateral to user and approve pool to spend collateral
      await collateralInstance.allocateTo(user, collateralAmount);
      await collateralInstance.approve(fixedRateAddr, collateralAmount, {
        from: user,
      });

      // approve fixed rate contract to spend peg token (jEur)
      await pegTokenInstance.approve(fixedRateAddr, numTokens, { from: user });
    });

    it('Correctly mints fixed rate token with synthereum collateral (USDC)', async () => {
      let MintParams = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
        recipient: user,
      };

      const pegTokenBalanceBefore = await pegTokenInstance.balanceOf.call(user);
      const fixedRateBalanceBefore = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );

      const tx = await fixedRateCurrencyInstance.mintFromUSDC(MintParams, {
        from: user,
      });

      const pegTokenBalanceAfter = await pegTokenInstance.balanceOf.call(user);
      const collateralBalanceAfter = await collateralInstance.balanceOf.call(
        user,
      );
      const fixedRateBalanceAfter = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );

      truffleAssert.eventEmitted(tx, 'Mint', ev => {
        return (
          ev.account == user &&
          ev.tokenCollateral == pegTokenAddr &&
          ev.numTokens == parseInt(fixedRateBalanceAfter) &&
          ev.tokenAddress == fixedRateAddr
        );
      });

      // user shouldnt have any jEur
      assert.equal(pegTokenBalanceBefore.eq(Web3Utils.toBN(0)), true);
      assert.equal(pegTokenBalanceAfter.eq(Web3Utils.toBN(0)), true);

      assert.equal(
        fixedRateBalanceAfter.eq(
          fixedRateBalanceBefore.add(
            Web3Utils.toBN(numTokens).mul(bnPegRate).div(bnPRECISION),
          ),
        ),
        true,
      );

      // user shouldn't have any USDC
      assert.equal(collateralBalanceAfter.eq(Web3Utils.toBN(0)), true);
    });

    it('Rejects if USDC balance is insufficient', async () => {
      let MintParams = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount + 3,
        feePercentage: feePercentageWei,
        expiration: expiration,
        recipient: user,
      };

      await truffleAssert.reverts(
        fixedRateCurrencyInstance.mintFromUSDC(MintParams, { from: user }),
        'ERC20: transfer amount exceeds balance',
      );
    });

    it('Rejects if contract has been paused by admin', async () => {
      let MintParams = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
        recipient: user,
      };

      await fixedRateCurrencyInstance.pauseContract({ from: admin });

      await truffleAssert.reverts(
        fixedRateCurrencyInstance.mintFromUSDC(MintParams, { from: user }),
        'Contract has been paused',
      );
    });
  });

  describe('Redeem to Synthereum Collateral (USDC)', () => {
    beforeEach(async () => {
      let MintParams = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
        recipient: user,
      };

      // deposit some collateral in the pool
      await collateralInstance.allocateTo(poolAddress, poolStartingDeposit);

      // allocate collateral to user and approve pool
      await collateralInstance.allocateTo(user, collateralAmount);
      await collateralInstance.approve(poolAddress, collateralAmount, {
        from: user,
      });

      // mint pegSynth and approve fixedRateCurrency
      await poolInstance.mint(MintParams, { from: user });
      pegBalance = await pegTokenInstance.balanceOf.call(user);

      await pegTokenInstance.approve(fixedRateAddr, pegBalance, { from: user });

      // mint fixed rate synth using all the pegSynth balance
      await fixedRateCurrencyInstance.mintFromPegSynth(pegBalance, {
        from: user,
      });
    });

    it('Correctly burns fixed rate and peg synths and redeem synthereum collateral', async () => {
      const redeemRatio = Web3Utils.toBN(2);
      const bnFixedCurrencyTotSupply = Web3Utils.toBN(
        await fixedRateCurrencyInstance.totalSupply.call(),
      );
      const totalDepositBefore = await fixedRateCurrencyInstance.total_deposited.call();
      const userBalanceBefore = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const userCollateralBalanceBefore = await collateralInstance.balanceOf.call(
        user,
      );
      const pegTokenBalanceBefore = await pegTokenInstance.balanceOf.call(user);

      const redeemAmount = userBalanceBefore.div(redeemRatio);
      let RedeemParams = {
        derivative: derivativeAddress,
        numTokens: redeemAmount.toString(),
        minCollateral: 0,
        feePercentage: feePercentageWei,
        expiration: expiration,
        recipient: user,
      };

      // approve
      await pegTokenInstance.approve(fixedRateAddr, pegBalance, { from: user });

      // redeem tx
      const tx = await fixedRateCurrencyInstance.redeemUSDC(RedeemParams, {
        from: user,
      });

      const userBalanceAfter = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const pegTokenBalanceAfter = await pegTokenInstance.balanceOf.call(user);
      const userCollateralBalanceAfter = await collateralInstance.balanceOf.call(
        user,
      );
      const totalDepositAfter = await fixedRateCurrencyInstance.total_deposited.call();

      const pegTokensRedeemed = redeemAmount
        .mul(totalDepositBefore)
        .div(bnFixedCurrencyTotSupply);

      let collateralReceived;
      truffleAssert.eventEmitted(tx, 'Redeem', ev => {
        collateralReceived = ev.numTokensRedeemed;
        return (
          ev.account == user &&
          ev.tokenBurned == pegTokenAddr &&
          ev.tokenRedeemed == collateralAddress
        );
      });

      assert.equal(
        totalDepositAfter.eq(totalDepositBefore.sub(pegTokensRedeemed)),
        true,
      );
      assert.equal(pegTokenBalanceAfter.eq(pegTokenBalanceBefore), true);
      assert.equal(
        userBalanceAfter.eq(userBalanceBefore.sub(redeemAmount)),
        true,
      );

      assert.equal(
        userCollateralBalanceAfter.eq(
          userCollateralBalanceBefore.add(Web3Utils.toBN(collateralReceived)),
        ),
        true,
      );
    });

    it('Allows to redeem with contract paused', async () => {
      const redeemRatio = Web3Utils.toBN(2);
      const bnFixedCurrencyTotSupply = Web3Utils.toBN(
        await fixedRateCurrencyInstance.totalSupply.call(),
      );
      const totalDepositBefore = await fixedRateCurrencyInstance.total_deposited.call();
      const userBalanceBefore = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const userCollateralBalanceBefore = await collateralInstance.balanceOf.call(
        user,
      );
      const pegTokenBalanceBefore = await pegTokenInstance.balanceOf.call(user);
      const redeemAmount = userBalanceBefore.div(redeemRatio);
      let RedeemParams = {
        derivative: derivativeAddress,
        numTokens: redeemAmount.toString(),
        minCollateral: 0,
        feePercentage: feePercentageWei,
        expiration: expiration,
        recipient: user,
      };

      await fixedRateCurrencyInstance.pauseContract({ from: admin });

      // approve
      await pegTokenInstance.approve(fixedRateAddr, pegBalance, { from: user });
      // redeem tx
      const tx = await fixedRateCurrencyInstance.redeemUSDC(RedeemParams, {
        from: user,
      });

      const userBalanceAfter = await fixedRateCurrencyInstance.balanceOf.call(
        user,
      );
      const pegTokenBalanceAfter = await pegTokenInstance.balanceOf.call(user);
      const userCollateralBalanceAfter = await collateralInstance.balanceOf.call(
        user,
      );
      const totalDepositAfter = await fixedRateCurrencyInstance.total_deposited.call();

      const pegTokensRedeemed = redeemAmount
        .mul(totalDepositBefore)
        .div(bnFixedCurrencyTotSupply);

      let collateralReceived;
      truffleAssert.eventEmitted(tx, 'Redeem', ev => {
        collateralReceived = ev.numTokensRedeemed;
        return (
          ev.account == user &&
          ev.tokenBurned == pegTokenAddr &&
          ev.tokenRedeemed == collateralAddress
        );
      });

      assert.equal(
        totalDepositAfter.eq(totalDepositBefore.sub(pegTokensRedeemed)),
        true,
      );
      assert.equal(pegTokenBalanceAfter.eq(pegTokenBalanceBefore), true);
      assert.equal(
        userBalanceAfter.eq(userBalanceBefore.sub(redeemAmount)),
        true,
      );

      assert.equal(
        userCollateralBalanceAfter.eq(
          userCollateralBalanceBefore.add(Web3Utils.toBN(collateralReceived)),
        ),
        true,
      );
    });
  });

  describe('Mint/Redeem with any other Synth (jGBP) ', () => {});
});
