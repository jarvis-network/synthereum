//helper scripts
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
  encodeSelfMintingDerivative,
} = require('../../utils/encoding.js');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const TestnetERC20 = artifacts.require('TestnetERC20');
const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');
const SynthereumPoolRegistry = artifacts.require('SynthereumPoolRegistry');
const SelfMintingRegistry = artifacts.require('SelfMintingRegistry');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');

contract('Synthereum Pool Register', function (accounts) {
  let derivativeVersion = 2;

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

  //Pool params
  let derivativeAddress = ZERO_ADDRESS;
  let synthereumFinderAddress;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let validator = accounts[3];
  let DAO = accounts[5];
  let wrongAddressPool = accounts[6];
  let wrongSelfMintingDerivative = accounts[7];
  let sender = accounts[8];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
    validator,
  };
  let startingCollateralization = '1586700';
  let feePercentage = 0.02;
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  let derivativeAdmins;
  let derivativePools;
  let poolVersion;
  let derivativePayload;
  let poolPayload;
  let poolRegistryInstance;
  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    synthereumFinderAddress = (await SynthereumFinder.deployed()).address;
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 4;
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
    poolRegistryInstance = await SynthereumPoolRegistry.deployed();
  });
  describe('Pool registry', async () => {
    it('Can write in the registry', async () => {
      let pools = await poolRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        poolVersion,
      );
      assert.equal(pools.length, 0, 'Pools not void');
      let collaterals = await poolRegistryInstance.getCollaterals.call();
      assert.equal(collaterals.length, 0, 'Collaterals not void');
      let synthTokens = await poolRegistryInstance.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 0, 'Synthetic tokens not void');
      let versions = await poolRegistryInstance.getVersions.call();
      assert.equal(versions.length, 0, 'Versions not void');
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
      await deployerInstance.deployPoolAndDerivative(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      let isDeployed = await poolRegistryInstance.isDeployed.call(
        syntheticSymbol,
        collateralAddress,
        poolVersion,
        pool,
      );
      assert.equal(isDeployed, true, 'Wrong deployment status');
      pools = await poolRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        poolVersion,
      );
      assert.equal(pools.length, 1, 'Pools number wrong');
      assert.equal(pools[0], pool, 'Wrong pool address');
      collaterals = await poolRegistryInstance.getCollaterals.call();
      assert.equal(collaterals.length, 1, 'Collateral number wrong');
      assert.equal(
        collaterals[0],
        collateralAddress,
        'Collateral address wrong',
      );
      synthTokens = await poolRegistryInstance.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 1, 'Wrong synthetic tokens number');
      assert.equal(synthTokens[0], 'jEUR', 'Wrong synthetic token symbol');
      versions = await poolRegistryInstance.getVersions.call();
      assert.equal(versions.length, 1, 'Wrong versions number');
      assert.equal(versions[0], 4, 'Wrong version');
    });
    it('Revert if an address different from deployer write', async () => {
      await truffleAssert.reverts(
        poolRegistryInstance.register(
          syntheticSymbol,
          collateralAddress,
          poolVersion,
          wrongAddressPool,
          { from: sender },
        ),
        'Sender must be Synthereum deployer',
      );
    });
  });
  describe('Self-minting registry', async () => {
    let selfMintingPayload;
    let selfMintingRegistryInstance;
    let selfMintingVersion;
    let selfMintingCollateralAddress;
    let selfMintingPriceFeedIdentifier;
    let tokenCurrencyAddress;
    let daoFee;
    let capDepositRatio;
    let capMintAmount;
    beforeEach(async () => {
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
      await deployerInstance.deployPoolAndDerivative(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      const derivativeInstance = await PerpetualPoolParty.at(derivative);
      tokenCurrencyAddress = await derivativeInstance.tokenCurrency.call();
      selfMintingVersion = 1;
      selfMintingCollateralAddress = (await TestnetSelfMintingERC20.deployed())
        .address;
      selfMintingPriceFeedIdentifier = 'EUR/JRT';
      capMintAmount = web3Utils.toWei('1000000');
      capDepositRatio = 700000000;
      const feePercentage = 0.02;
      const feeRecipient = DAO;
      daoFee = {
        feePercentage,
        feeRecipient,
      };
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        tokenCurrencyAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      selfMintingRegistryInstance = await SelfMintingRegistry.deployed();
    });
    it('Can write in the registry', async () => {
      let selfMintingDerivatives = await selfMintingRegistryInstance.getElements.call(
        syntheticSymbol,
        selfMintingCollateralAddress,
        selfMintingVersion,
      );
      assert.equal(
        selfMintingDerivatives.length,
        0,
        'Self-minting derivatives not void',
      );
      let collaterals = await selfMintingRegistryInstance.getCollaterals.call();
      assert.equal(collaterals.length, 0, 'Collaterals not void');
      let synthTokens = await selfMintingRegistryInstance.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 0, 'Synthetic tokens not void');
      let versions = await selfMintingRegistryInstance.getVersions.call();
      assert.equal(versions.length, 0, 'Versions not void');
      const selfMintingDerivative = await deployerInstance.deployOnlySelfMintingDerivative.call(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await deployerInstance.deployOnlySelfMintingDerivative(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      let isDeployed = await selfMintingRegistryInstance.isDeployed.call(
        syntheticSymbol,
        selfMintingCollateralAddress,
        selfMintingVersion,
        selfMintingDerivative,
      );
      assert.equal(isDeployed, true, 'Wrong deployment status');
      selfMintingDerivatives = await selfMintingRegistryInstance.getElements.call(
        syntheticSymbol,
        selfMintingCollateralAddress,
        selfMintingVersion,
      );
      assert.equal(
        selfMintingDerivatives.length,
        1,
        'Self-minting derivatives number wrong',
      );
      assert.equal(
        selfMintingDerivatives[0],
        selfMintingDerivative,
        'Wrong self-minting derivative address',
      );
      collaterals = await selfMintingRegistryInstance.getCollaterals.call();
      assert.equal(collaterals.length, 1, 'Collateral number wrong');
      assert.equal(
        collaterals[0],
        selfMintingCollateralAddress,
        'Collateral address wrong',
      );
      synthTokens = await selfMintingRegistryInstance.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 1, 'Wrong synthetic tokens number');
      assert.equal(synthTokens[0], 'jEUR', 'Wrong synthetic token symbol');
      versions = await selfMintingRegistryInstance.getVersions.call();
      assert.equal(versions.length, 1, 'Wrong versions number');
      assert.equal(versions[0], 1, 'Wrong version');
    });
    it('Revert if an address different from deployer write', async () => {
      await truffleAssert.reverts(
        selfMintingRegistryInstance.register(
          syntheticSymbol,
          selfMintingCollateralAddress,
          selfMintingVersion,
          wrongSelfMintingDerivative,
          { from: sender },
        ),
        'Sender must be Synthereum deployer',
      );
    });
  });
});
