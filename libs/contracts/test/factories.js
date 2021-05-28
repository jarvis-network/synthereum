//helper scripts
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePool,
  encodePoolOnChainPriceFeed,
} = require('../utils/encoding.js');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumSyntheticTokenFactory = artifacts.require(
  'SynthereumSyntheticTokenFactory',
);
const SynthereumDerivativeFactory = artifacts.require(
  'SynthereumDerivativeFactory',
);
const SynthereumPoolFactory = artifacts.require('SynthereumPoolFactory');
const SynthereumPoolOnChainPriceFeedFactory = artifacts.require(
  'SynthereumPoolOnChainPriceFeedFactory',
);

contract('Factories', function (accounts) {
  let derivativeVersion = 1;

  // Derivative params
  let collateralAddress;
  let priceFeedIdentifier = 'EUR/USD';
  let secondPriceFeedIdentifier = 'GBP/USD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let secondSyntheticName = 'Jarvis Synthetic British Pound';
  let syntheticSymbol = 'jEUR';
  let secondSyntheticSymbol = 'jGBP';
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
  let poolOnChainVersion;
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
  let startingCollateralization = '1500000';
  let secondStartingCollateralization = '1700000';
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
  //Other params
  let sender = accounts[6];
  let derivativePayload;
  let poolPayload;
  let poolOnChainPayload;

  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 2;
    poolOnChainVersion = 3;
    feePercentageWei = web3Utils.toWei(feePercentage);
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
    poolOnChainPayload = encodePoolOnChainPriceFeed(
      derivativeAddress,
      synthereumFinderAddress,
      poolOnChainVersion,
      roles,
      isContractAllowed,
      startingCollateralization,
      fee,
    );
  });

  it('Can deploy derivative and pool', async () => {
    await deployerInstance.deployPoolAndDerivative(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
  });
  it('Can deploy derivative and on-chain-price pool', async () => {
    await deployerInstance.deployPoolAndDerivative(
      derivativeVersion,
      poolOnChainVersion,
      derivativePayload,
      poolOnChainPayload,
      { from: maintainer },
    );
  });
  describe('Revert if not deployer', async () => {
    it('Revert in derivative factory', async () => {
      const derivativeFactoryInstance = await SynthereumDerivativeFactory.deployed();
      const funcSignature = await derivativeFactoryInstance.deploymentSignature();
      const dataPayload = funcSignature + derivativePayload.replace('0x', '');
      await truffleAssert.reverts(
        web3.eth.sendTransaction({
          from: sender,
          to: derivativeFactoryInstance.address,
          data: dataPayload,
        }),
        'Sender must be Synthereum deployer',
      );
    });
    it('Revert in synthetic token factory', async () => {
      const synthereumSyntheticTokenFactoryInstance = await SynthereumSyntheticTokenFactory.deployed();
      await truffleAssert.reverts(
        synthereumSyntheticTokenFactoryInstance.createToken(
          'jTest',
          'Test Coin',
          18,
          { from: sender },
        ),
        'Sender must be a Derivative Factory',
      );
    });
    it('Revert in pool factory', async () => {
      const poolFactoryInstance = await SynthereumPoolFactory.deployed();
      const funcSignature = await poolFactoryInstance.deploymentSignature();
      const dataPayload =
        funcSignature +
        web3Utils.padRight(ZERO_ADDRESS.replace('0x', ''), '64') +
        poolPayload.replace('0x', '');
      await truffleAssert.reverts(
        web3.eth.sendTransaction({
          from: sender,
          to: poolFactoryInstance.address,
          data: dataPayload,
        }),
        'Sender must be Synthereum deployer',
      );
    });
    it('Revert in on-chain-price pool factory', async () => {
      const poolOnChainFactoryInstance = await SynthereumPoolOnChainPriceFeedFactory.deployed();
      const funcSignature = await poolOnChainFactoryInstance.deploymentSignature();
      const dataPayload =
        funcSignature +
        web3Utils.padRight(ZERO_ADDRESS.replace('0x', ''), '64') +
        poolOnChainPayload.replace('0x', '');
      await truffleAssert.reverts(
        web3.eth.sendTransaction({
          from: sender,
          to: poolOnChainFactoryInstance.address,
          data: dataPayload,
        }),
        'Sender must be Synthereum deployer',
      );
    });
  });
});
