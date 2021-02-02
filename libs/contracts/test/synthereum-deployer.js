//helper scripts
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { encodeDerivative, encodePool } = require('../utils/encoding.js');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const TestnetERC20 = artifacts.require('TestnetERC20');
const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');

contract('Synthereum Deployer', function (accounts) {
  let derivativeVersion = 1;

  // Derivative params
  let collateralAddress;
  let priceFeedIdentifier = 'EUR/USD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let syntheticSymbol = 'jEUR';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let collateralRequirement = web3Utils.toWei('1.1');
  let disputeBondPct = web3Utils.toWei('1.5');
  let sponsorDisputeRewardPct = web3Utils.toWei('0.5');
  let disputerDisputeRewardPct = web3Utils.toWei('0.4');
  let minSponsorTokens = web3Utils.toWei('1');
  let withdrawalLiveness = 3600;
  let liquidationLiveness = 3600;
  let excessBeneficiary = accounts[4];
  let derivativeAdmins;
  let derivativePools;

  //Pool params
  let derivativeAddress = ZERO_ADDRESS;
  let synthereumFinderAddress;
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let validator = accounts[3];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
    validator,
  };
  let isContractAllowed = false;
  let startingCollateralization = '1586700';
  let feePercentage = 0.02;
  let DAO = accounts[5];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };

  //Other params
  let firstWrongAddress = accounts[6];
  let secondWrongAddress = accounts[7];
  let derivativePayload;
  let poolPayload;
  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 2;
    synthereumFinderAddress = (await SynthereumFinder.deployed()).address;
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
    poolPayload = encodePool(
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      roles,
      isContractAllowed,
      startingCollateralization,
      fee,
    );
  });

  describe('Deploy derivative and pool', () => {
    it('Can deploy', async () => {
      const {
        derivative,
        pool,
      } = await deployerInstance.deployPoolAndDerivative.call(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      const deploymentTx = await deployerInstance.deployPoolAndDerivative(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(deploymentTx, 'PoolDeployed', ev => {
        return (
          ev.poolVersion == 2 &&
          ev.derivative == derivative &&
          ev.newPool == pool
        );
      });
      truffleAssert.eventEmitted(deploymentTx, 'DerivativeDeployed', ev => {
        return (
          ev.derivativeVersion == 1 &&
          ev.pool == pool &&
          ev.newDerivative == derivative
        );
      });
    });
    it('Revert if the caller of deploy is not the maintainer of the deployer', async () => {
      await truffleAssert.reverts(
        deployerInstance.deployPoolAndDerivative(
          derivativeVersion,
          poolVersion,
          derivativePayload,
          poolPayload,
          { from: firstWrongAddress },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Revert if more than one temp admin in the derivative', async () => {
      derivativeAdmins = [firstWrongAddress, secondWrongAddress];
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
      await truffleAssert.reverts(
        deployerInstance.deployPoolAndDerivative(
          derivativeVersion,
          poolVersion,
          derivativePayload,
          poolPayload,
          { from: maintainer },
        ),
        'The derivative must have one admin',
      );
    });
    it('Revert if temp admin in the derivative different from deployer', async () => {
      derivativeAdmins = [firstWrongAddress];
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
      await truffleAssert.reverts(
        deployerInstance.deployPoolAndDerivative(
          derivativeVersion,
          poolVersion,
          derivativePayload,
          poolPayload,
          { from: maintainer },
        ),
        'The derivative admin must be the deployer',
      );
    });
    it('Revert if temp admin in the derivative different from deployer', async () => {
      derivativeAdmins = [firstWrongAddress];
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
      await truffleAssert.reverts(
        deployerInstance.deployPoolAndDerivative(
          derivativeVersion,
          poolVersion,
          derivativePayload,
          poolPayload,
          { from: maintainer },
        ),
        'The derivative admin must be the deployer',
      );
    });
    it('Revert if temp pools exist in the derivative', async () => {
      derivativePools = [firstWrongAddress];
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
      await truffleAssert.reverts(
        deployerInstance.deployPoolAndDerivative(
          derivativeVersion,
          poolVersion,
          derivativePayload,
          poolPayload,
          { from: maintainer },
        ),
        'The derivative must have no pools',
      );
    });
    it('Revert if Synthereum finder of pool is different from the deployer one', async () => {
      synthereumFinderAddress = firstWrongAddress;
      poolPayload = encodePool(
        derivativeAddress,
        synthereumFinderAddress,
        poolVersion,
        roles,
        isContractAllowed,
        startingCollateralization,
        fee,
      );
      await truffleAssert.reverts(
        deployerInstance.deployPoolAndDerivative(
          derivativeVersion,
          poolVersion,
          derivativePayload,
          poolPayload,
          { from: maintainer },
        ),
        'Wrong finder in pool deployment',
      );
    });
    it('Revert if pool version is different from the one using in the deployemnt', async () => {
      const wrongPoolVersion = 3;
      poolPayload = encodePool(
        derivativeAddress,
        synthereumFinderAddress,
        wrongPoolVersion,
        roles,
        isContractAllowed,
        startingCollateralization,
        fee,
      );
      await truffleAssert.reverts(
        deployerInstance.deployPoolAndDerivative(
          derivativeVersion,
          poolVersion,
          derivativePayload,
          poolPayload,
          { from: maintainer },
        ),
        'Wrong version in pool deployment',
      );
    });
  });
  it('Can deploy only pool', async () => {
    const {
      derivative,
      firstPool,
    } = await deployerInstance.deployPoolAndDerivative.call(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    await deployerInstance.deployPoolAndDerivative(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    const secondPool = await deployerInstance.deployOnlyPool.call(
      poolVersion,
      poolPayload,
      derivative,
      { from: maintainer },
    );
    const deploymentTx = await deployerInstance.deployOnlyPool(
      poolVersion,
      poolPayload,
      derivative,
      { from: maintainer },
    );
    truffleAssert.eventEmitted(deploymentTx, 'PoolDeployed', ev => {
      return (
        ev.poolVersion == 2 &&
        ev.derivative == derivative &&
        ev.newPool == secondPool
      );
    });
  });
  describe('Deploy only derivative', async () => {
    let derivative;
    let pool;
    let syntheticTokenDeployed;
    beforeEach(async () => {
      const deploymentAddresses = await deployerInstance.deployPoolAndDerivative.call(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      derivative = deploymentAddresses.derivative;
      pool = deploymentAddresses.pool;
      await deployerInstance.deployPoolAndDerivative(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      const derivativeInstance = await PerpetualPoolParty.at(derivative);
      syntheticTokenDeployed = (
        await derivativeInstance.positionManagerData.call()
      ).tokenCurrency;
    });
    it('Can deploy', async () => {
      derivativePayload = encodeDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        syntheticTokenDeployed,
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
      const newDerivative = await deployerInstance.deployOnlyDerivative.call(
        derivativeVersion,
        derivativePayload,
        pool,
        { from: maintainer },
      );
      const deploymentTx = await deployerInstance.deployOnlyDerivative(
        derivativeVersion,
        derivativePayload,
        pool,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(deploymentTx, 'DerivativeDeployed', ev => {
        return (
          ev.derivativeVersion == 1 &&
          ev.pool == pool &&
          ev.newDerivative == newDerivative
        );
      });
    });
    it('Revert if new synthetic token deployed with new derivative', async () => {
      await truffleAssert.reverts(
        deployerInstance.deployOnlyDerivative(
          derivativeVersion,
          derivativePayload,
          pool,
          { from: maintainer },
        ),
        'Wrong synthetic token matching',
      );
    });
    it('Revert if new synthetic token deployed with new derivative', async () => {
      const newCollateralInstance = await TestnetERC20.new(
        'USD Coin',
        'USDC',
        6,
      );
      const collateralWhitelistInstance = await AddressWhitelist.deployed();
      await collateralWhitelistInstance.addToWhitelist(
        newCollateralInstance.address,
      );
      derivativePayload = encodeDerivative(
        newCollateralInstance.address,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        syntheticTokenDeployed,
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
      await truffleAssert.reverts(
        deployerInstance.deployOnlyDerivative(
          derivativeVersion,
          derivativePayload,
          pool,
          { from: maintainer },
        ),
        'Wrong collateral matching',
      );
    });
  });
});
