/* eslint-disable */
const { artifacts, contract } = require('hardhat');
const Web3Utils = require('web3-utils');
const Web3EthAbi = require('web3-eth-abi');

const { truffleAssert } = require('truffle-assertions');
const { assert } = require('chai');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');

const Derivative = artifacts.require('PerpetualPoolParty');
const FixedRateCurrency = artifacts.require('FixedRateCurrency');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
} = require('../../utils/encoding.js');

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
  let name = 'Jarvis Bulgarian Lev';
  let symbol = 'jBGN';

  //mint jEur params
  let numTokens = Web3Utils.toWei('99.8');
  let collateralAmount = Web3Utils.toWei('120', 'mwei');
  let expiration;

  let user = accounts[6];
  before(async () => {
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

    fixedRateCurrencyInstance = await FixedRateCurrency.new(
      pegTokenAddr,
      poolAddress,
      synthereumFinderAddress,
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
      assert.strictEqual(actualRate.eq(Web3Utils.toBN(pegRate)), true);
      assert.strictEqual(
        await fixedRateCurrencyInstance.synth.call(),
        pegTokenAddr,
      );
    });
  });

  describe('Mint/Redeem with Peg Synth', () => {
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
      await fixedRateCurrencyInstance.mintFromPegSynth(pegBalance, {
        from: user,
      });

      userBalance = await fixedRateCurrencyInstance.balanceOf.call(user);
      assert.equal(
        userBalance.eq(pegBalance.mul(Web3Utils.toBN(pegRate))),
        true,
      );
    });
  });

  describe('Mint/Redeem with Synthereum Collateral (USDC)', () => {});

  describe('Mint/Redeem with any other Synth (jGBP) ', () => {});
});
