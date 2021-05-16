//helper scripts
const {
  ZERO_ADDRESS,
  RegistryRolesEnum,
} = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
  encodeSelfMintingDerivative,
} = require('../../utils/encoding.js');
const Finder = artifacts.require('Finder');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const Registry = artifacts.require('Registry');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumManager = artifacts.require('SynthereumManager');
const SelfMintingController = artifacts.require('SelfMintingController');
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const TestnetERC20 = artifacts.require('TestnetERC20');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');
const MintableBurnableSyntheticToken = artifacts.require(
  'MintableBurnableSyntheticToken',
);
const SelfMintingPerpetualMultiPartyLib = artifacts.require(
  'SelfMintingPerpetualMultiPartyLib',
);
const SelfMintingDerivativeFactory = artifacts.require(
  'SelfMintingDerivativeFactory',
);
const SynthereumPoolOnChainPriceFeedFactory = artifacts.require(
  'SynthereumPoolOnChainPriceFeedFactory',
);
const SynthereumPoolOnChainPriceFeedLib = artifacts.require(
  'SynthereumPoolOnChainPriceFeedLib',
);
const PoolMock = artifacts.require('PoolMock');
const SelfMintingDerivativeFactoryMock = artifacts.require(
  'SelfMintingDerivativeFactoryMock',
);
const PoolFactoryMock = artifacts.require('PoolFactoryMock');
const DerivativeMock = artifacts.require('DerivativeMock');

contract('Synthereum Deployer', function (accounts) {
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
  let derivativeAdmins;
  let derivativePools;

  //Pool params
  let derivativeAddress = ZERO_ADDRESS;
  let synthereumFinderAddress;
  let manager;
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
  let feeRecipient = DAO;
  let daoFee = {
    feePercentage,
    feeRecipient,
  };
  let capMintAmount = web3Utils.toWei('1000000');
  let capDepositRatio = 700;
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
    poolVersion = 3;
    synthereumFinderAddress = (await SynthereumFinder.deployed()).address;
    manager = (await SynthereumManager.deployed()).address;
    selfMintingControllerInstanceAddr = (await SelfMintingController.deployed())
      .address;
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
      isContractAllowed,
      startingCollateralization,
      fee,
    );
  });

  describe('Deploy derivative and pool', () => {
    it('Can deploy with new synthetic token', async () => {
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
          ev.poolVersion == 3 &&
          ev.derivative == derivative &&
          ev.newPool == pool
        );
      });
      truffleAssert.eventEmitted(deploymentTx, 'DerivativeDeployed', ev => {
        return (
          ev.derivativeVersion == 2 &&
          ev.pool == pool &&
          ev.newDerivative == derivative
        );
      });
      //Check roles of the derivative
      const derivativeInstance = await PerpetualPoolParty.at(derivative);
      const derivatAdmins = await derivativeInstance.getAdminMembers.call();
      assert.equal(
        derivatAdmins.length,
        1,
        'Wrong number of admins for the derivative',
      );
      assert.equal(
        derivatAdmins[0],
        manager,
        'Manager is not the derivative admin',
      );
      const pools = await derivativeInstance.getPoolMembers.call();
      assert.equal(pools.length, 1, 'Wrong number of pools for the derivative');
      assert.equal(pools[0], pool, 'Pool has not pool role');
      //Check roles of synth token
      const synthTokenAddress = await derivativeInstance.tokenCurrency.call();
      const synthTokenInstance = await MintableBurnableSyntheticToken.at(
        synthTokenAddress,
      );
      const tokenAdmins = await synthTokenInstance.getAdminMembers.call();
      assert.equal(
        tokenAdmins.length,
        1,
        'Wrong number of admins for the synthetic token',
      );
      assert.equal(tokenAdmins[0], manager, 'Manager is not the token admin');
      const minters = await synthTokenInstance.getMinterMembers.call();
      assert.equal(
        minters.length,
        1,
        'Wrong number of minters for the synthetic token',
      );
      assert.equal(
        minters[0],
        derivative,
        'Derivative is not the token minter',
      );
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        1,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(
        burners[0],
        derivative,
        'Derivative is not the token burner',
      );
    });
    it('Can deploy with already existing synthetic token', async () => {
      const {
        derivative: tempDerivative,
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
      const tempDerivativeInstance = await PerpetualPoolParty.at(
        tempDerivative,
      );
      const synthTokenAddress = await tempDerivativeInstance.tokenCurrency.call();
      const synthTokenInstance = await MintableBurnableSyntheticToken.at(
        synthTokenAddress,
      );
      derivativePayload = encodeDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
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
      //Check roles of the derivative
      const derivativeInstance = await PerpetualPoolParty.at(derivative);
      const derivatAdmins = await derivativeInstance.getAdminMembers.call();
      assert.equal(
        derivatAdmins.length,
        1,
        'Wrong number of admins for the derivative',
      );
      assert.equal(
        derivatAdmins[0],
        manager,
        'Manager is not the derivative admin',
      );
      const pools = await derivativeInstance.getPoolMembers.call();
      assert.equal(pools.length, 1, 'Wrong number of pools for the derivative');
      assert.equal(pools[0], pool, 'Pool has not pool role');
      //Check roles of synth token
      const tokenAdmins = await synthTokenInstance.getAdminMembers.call();
      assert.equal(
        tokenAdmins.length,
        1,
        'Wrong number of admins for the synthetic token',
      );
      assert.equal(tokenAdmins[0], manager, 'Manager is not the token admin');
      const minters = await synthTokenInstance.getMinterMembers.call();
      assert.equal(
        minters.length,
        2,
        'Wrong number of minters for the synthetic token',
      );
      assert.equal(
        minters[0],
        tempDerivative,
        'First derivative is not the token minter',
      );
      assert.equal(
        minters[1],
        derivative,
        'Second derivative is not the token minter',
      );
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        2,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(
        burners[0],
        tempDerivative,
        'First derivative is not the token burner',
      );
      assert.equal(
        burners[1],
        derivative,
        'Second derivative is not the token burner',
      );
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
      poolPayload = encodePoolOnChainPriceFeed(
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
      const wrongPoolVersion = 4;
      poolPayload = encodePoolOnChainPriceFeed(
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
    it('Revert if pool derivative is different from the deployed one', async () => {
      const {
        derivative: tempDerivative,
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
      const tempDerivativeInstance = await PerpetualPoolParty.at(
        tempDerivative,
      );
      const syntheticTokenDeployed = await tempDerivativeInstance.tokenCurrency.call();
      const poolLibInstance = await SynthereumPoolOnChainPriceFeedLib.deployed();
      await PoolFactoryMock.link(poolLibInstance);
      const wrongDerivativeInstance = await DerivativeMock.new(
        collateralAddress,
        syntheticTokenDeployed,
        web3Utils.utf8ToHex(priceFeedIdentifier),
      );
      const wrongPoolFactory = await PoolFactoryMock.new(
        synthereumFinderAddress,
        wrongDerivativeInstance.address,
      );
      const factoryVersioninginstance = await SynthereumFactoryVersioning.deployed();
      await factoryVersioninginstance.setPoolFactory(
        3,
        wrongPoolFactory.address,
        { from: maintainer },
      );
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
      await truffleAssert.reverts(
        deployerInstance.deployPoolAndDerivative(
          derivativeVersion,
          poolVersion,
          derivativePayload,
          poolPayload,
          { from: maintainer },
        ),
        'Pool doesnt support derivative',
      );
      await factoryVersioninginstance.setPoolFactory(
        3,
        (await SynthereumPoolOnChainPriceFeedFactory.deployed()).address,
        { from: maintainer },
      );
    });
  });
  describe('Deploy only pool', async () => {
    it('Can deploy', async () => {
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
          ev.poolVersion == 3 &&
          ev.derivative == derivative &&
          ev.newPool == secondPool
        );
      });
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
    it('Can deploy with already existing pool', async () => {
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
          ev.derivativeVersion == 2 &&
          ev.pool == pool &&
          ev.newDerivative == newDerivative
        );
      });
      const derivativeInstance = await PerpetualPoolParty.at(newDerivative);
      const derivatAdmins = await derivativeInstance.getAdminMembers.call();
      assert.equal(
        derivatAdmins.length,
        1,
        'Wrong number of admins for the derivative',
      );
      assert.equal(
        derivatAdmins[0],
        manager,
        'Manager is not the derivative admin',
      );
      const pools = await derivativeInstance.getPoolMembers.call();
      assert.equal(pools.length, 1, 'Wrong number of pools for the derivative');
      assert.equal(pools[0], pool, 'Pool has not pool role');
      //Check roles of synth token
      const synthTokenAddress = await derivativeInstance.tokenCurrency.call();
      assert.equal(
        synthTokenAddress,
        syntheticTokenDeployed,
        'Wrong synthetic token during deployment',
      );
      const synthTokenInstance = await MintableBurnableSyntheticToken.at(
        synthTokenAddress,
      );
      const tokenAdmins = await synthTokenInstance.getAdminMembers.call();
      assert.equal(
        tokenAdmins.length,
        1,
        'Wrong number of admins for the synthetic token',
      );
      assert.equal(tokenAdmins[0], manager, 'Manager is not the token admin');
      const minters = await synthTokenInstance.getMinterMembers.call();
      assert.equal(
        minters.length,
        2,
        'Wrong number of minters for the synthetic token',
      );
      assert.equal(
        minters[1],
        newDerivative,
        'Derivative is not the token minter',
      );
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        2,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(
        burners[1],
        newDerivative,
        'Derivative is not the token burner',
      );
    });
    it('Can deploy without pool with an existing synthetic token', async () => {
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
      const deploymentTx = await deployerInstance.deployOnlyDerivative(
        derivativeVersion,
        derivativePayload,
        ZERO_ADDRESS,
        { from: maintainer },
      );
    });
    it('Can deploy without pool with a new synthetic token', async () => {
      const newDerivative = await deployerInstance.deployOnlyDerivative.call(
        derivativeVersion,
        derivativePayload,
        ZERO_ADDRESS,
        { from: maintainer },
      );
      const deploymentTx = await deployerInstance.deployOnlyDerivative(
        derivativeVersion,
        derivativePayload,
        ZERO_ADDRESS,
        { from: maintainer },
      );
      const derivativeInstance = await PerpetualPoolParty.at(newDerivative);
      const derivatAdmins = await derivativeInstance.getAdminMembers.call();
      assert.equal(
        derivatAdmins.length,
        1,
        'Wrong number of admins for the derivative',
      );
      assert.equal(
        derivatAdmins[0],
        manager,
        'Manager is not the derivative admin',
      );
      const pools = await derivativeInstance.getPoolMembers.call();
      assert.equal(pools.length, 0, 'Wrong number of pools for the derivative');
      //Check roles of synth token
      const synthTokenAddress = await derivativeInstance.tokenCurrency.call();
      const synthTokenInstance = await MintableBurnableSyntheticToken.at(
        synthTokenAddress,
      );
      const tokenAdmins = await synthTokenInstance.getAdminMembers.call();
      assert.equal(
        tokenAdmins.length,
        1,
        'Wrong number of admins for the synthetic token',
      );
      assert.equal(tokenAdmins[0], manager, 'Manager is not the token admin');
      const minters = await synthTokenInstance.getMinterMembers.call();
      assert.equal(
        minters.length,
        1,
        'Wrong number of minters for the synthetic token',
      );
      assert.equal(
        minters[0],
        newDerivative,
        'Derivative is not the token minter',
      );
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        1,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(
        burners[0],
        newDerivative,
        'Derivative is not the token burner',
      );
    });
    it('Revert if token currency of pool and derivative are different', async () => {
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
    it('Revert if collateral of pool and derivative are different', async () => {
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
    it('Revert if pool is not registred', async () => {
      const mockPool = await PoolMock.new(
        poolVersion,
        collateralAddress,
        syntheticSymbol,
        syntheticTokenDeployed,
      );
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
      await truffleAssert.reverts(
        deployerInstance.deployOnlyDerivative(
          derivativeVersion,
          derivativePayload,
          mockPool.address,
          { from: maintainer },
        ),
        'Pool not registred',
      );
    });
  });
  describe('Deploy self-minting derivative', async () => {
    let stdDerivativeAddr;
    let synthTokenInstance;
    let selfMintingDerivativeVersion;
    let selfMintingPayload;
    let selfMintingCollateralAddress;
    let selfMintingPriceFeedIdentifier;
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
      stdDerivativeAddr = derivative;
      const deploymentTx = await deployerInstance.deployPoolAndDerivative(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      const stdDerivativeInstance = await PerpetualPoolParty.at(
        stdDerivativeAddr,
      );
      const synthTokenAddress = await stdDerivativeInstance.tokenCurrency.call();
      synthTokenInstance = await MintableBurnableSyntheticToken.at(
        synthTokenAddress,
      );
      selfMintingDerivativeVersion = 1;
      selfMintingCollateralAddress = (await TestnetSelfMintingERC20.deployed())
        .address;
      selfMintingPriceFeedIdentifier = 'EUR/JRT';

      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenInstance.address,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
    });
    it('Can deploy', async () => {
      const selfMintingDerivative = await deployerInstance.deployOnlySelfMintingDerivative.call(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      const deploymentTx = await deployerInstance.deployOnlySelfMintingDerivative(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(
        deploymentTx,
        'SelfMintingDerivativeDeployed',
        ev => {
          return (
            ev.selfMintingDerivativeVersion == 1 &&
            ev.selfMintingDerivative == selfMintingDerivative
          );
        },
      );
      //Check synth token roles
      const tokenAdmins = await synthTokenInstance.getAdminMembers.call();
      assert.equal(
        tokenAdmins.length,
        1,
        'Wrong number of admins for the synthetic token',
      );
      assert.equal(tokenAdmins[0], manager, 'Manager is not the token admin');
      const minters = await synthTokenInstance.getMinterMembers.call();
      assert.equal(
        minters.length,
        2,
        'Wrong number of minters for the synthetic token',
      );
      assert.equal(
        minters[0],
        stdDerivativeAddr,
        'First derivative is not the token minter',
      );
      assert.equal(
        minters[1],
        selfMintingDerivative,
        'Second derivative is not the token minter',
      );
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        2,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(
        burners[0],
        stdDerivativeAddr,
        'First derivative is not the token burner',
      );
      assert.equal(
        burners[1],
        selfMintingDerivative,
        'Second derivative is not the token burner',
      );
    });
    it('Revert if synthereum finder of self-minting derivative is different from the deployer one', async () => {
      const selfMintingPerpetualMultiPartyLibInstance = await SelfMintingPerpetualMultiPartyLib.deployed();
      await SelfMintingDerivativeFactoryMock.link(
        selfMintingPerpetualMultiPartyLibInstance,
      );
      const umaFinderInstance = await Finder.deployed();
      const wrongSelfMintingFactory = await SelfMintingDerivativeFactoryMock.new(
        umaFinderInstance.address,
        synthereumFinderAddress,
        ZERO_ADDRESS,
      );
      const registryInstance = await Registry.deployed();
      await registryInstance.addMember(
        RegistryRolesEnum.CONTRACT_CREATOR,
        wrongSelfMintingFactory.address,
      );
      const factoryVersioningInstance = await SynthereumFactoryVersioning.deployed();

      await factoryVersioningInstance.setSelfMintingFactory(
        1,
        wrongSelfMintingFactory.address,
        { from: maintainer },
      );
      const newFinder = await SynthereumFinder.new({
        admin: admin,
        maintainer: maintainer,
      });
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('Deployer'),
        deployerInstance.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('SelfMintingController'),
        selfMintingControllerInstanceAddr,
        { from: maintainer },
      );
      await wrongSelfMintingFactory.setSynthereumFinder(newFinder.address);
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Wrong finder in self-minting deployment',
      );
      await factoryVersioningInstance.setSelfMintingFactory(
        1,
        (await SelfMintingDerivativeFactory.deployed()).address,
        { from: maintainer },
      );
    });
    it('Revert if self-minting version is different from the one using in the deployemnt', async () => {
      wrongSelfMintingDerivativeVersion = 2;
      selfMintingPayload = encodeSelfMintingDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenInstance.address,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        wrongSelfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Wrong version in self-minting deployment',
      );
    });
  });
});
