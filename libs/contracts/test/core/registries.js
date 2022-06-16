//helper scripts
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeLiquidityPool,
  encodeCreditLineDerivative,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumManager = artifacts.require('SynthereumManager');
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const TestnetERC20 = artifacts.require('TestnetERC20');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const MintableBurnableSyntheticToken = artifacts.require(
  'MintableBurnableSyntheticToken',
);
const SynthereumCollateralWhitelist = artifacts.require(
  'SynthereumCollateralWhitelist',
);
const SynthereumIdentifierWhitelist = artifacts.require(
  'SynthereumIdentifierWhitelist',
);
const SynthereumLiquidityPoolLib = artifacts.require(
  'SynthereumLiquidityPoolLib',
);
const SynthereumLiquidityPoolFactory = artifacts.require(
  'SynthereumLiquidityPoolFactory',
);
const SynthereumSyntheticTokenFactory = artifacts.require(
  'SynthereumSyntheticTokenFactory',
);
const CreditLineLib = artifacts.require('CreditLineLib');
const CreditLineFactory = artifacts.require('CreditLineFactory');
const CreditLineController = artifacts.require('CreditLineController');
const SynthereumLiquidityPool = artifacts.require('SynthereumLiquidityPool');
const MockAggregator = artifacts.require('MockAggregator');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const SynthereumSyntheticTokenPermitFactory = artifacts.require(
  'SynthereumSyntheticTokenPermitFactory',
);
const SynthereumPoolRegistry = artifacts.require('SynthereumPoolRegistry');
const SelfMintingRegistry = artifacts.require('SelfMintingRegistry');

contract('Registries', function (accounts) {
  let collateralAddress;
  let priceFeedIdentifier = 'EURUSD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let syntheticSymbol = 'jEUR';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let collateralRequirement = web3Utils.toWei('1.1');
  let minSponsorTokens = web3Utils.toWei('1');
  let excessBeneficiary = accounts[4];
  let synthereumFinderAddress;
  let manager;
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
  };
  let overCollateralization = web3Utils.toWei('0.2');
  let liquidationReward = web3Utils.toWei('0.5');
  let feePercentage = 0.02;
  let DAO = accounts[5];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  let capMintAmount = web3Utils.toWei('1000000');
  let sender = accounts[6];
  let wrongAddressPool = accounts[7];
  let wrongSelfMintingDerivative = accounts[8];
  let poolPayload;
  let collateralWhitelistInstance;
  let identifierWhitelistInstance;
  let factoryVersioningInstance;
  let mockAggregator;
  let synthereumChainlinkPriceFeed;
  let tokenFactory;
  let poolFactoryInstance;
  let selfMintingFactoryInstance;
  let poolRegistryInstance;

  before(async () => {
    collateralAddress = (await TestnetERC20.new('Testnet token', 'USDC', 6))
      .address;
    mockAggregator = await MockAggregator.new(8, 120000000);
    synthereumChainlinkPriceFeed = await SynthereumChainlinkPriceFeed.deployed();
    await synthereumChainlinkPriceFeed.setPair(
      0,
      web3.utils.utf8ToHex(priceFeedIdentifier),
      mockAggregator.address,
      [],
      { from: maintainer },
    );
    collateralWhitelistInstance = await SynthereumCollateralWhitelist.deployed();
    await collateralWhitelistInstance.addToWhitelist(collateralAddress, {
      from: maintainer,
    });
    identifierWhitelistInstance = await SynthereumIdentifierWhitelist.deployed();
    await identifierWhitelistInstance.addToWhitelist(
      web3.utils.utf8ToHex(priceFeedIdentifier),
      {
        from: maintainer,
      },
    );
    factoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
    tokenFactory = await SynthereumSyntheticTokenPermitFactory.deployed();
    poolFactoryInstance = await SynthereumLiquidityPoolFactory.deployed();
    selfMintingFactoryInstance = await CreditLineFactory.deployed();
    poolRegistryInstance = await SynthereumPoolRegistry.deployed();
  });
  beforeEach(async () => {
    deployerInstance = await SynthereumDeployer.deployed();
    poolVersion = 5;
    synthereumFinderAddress = (await SynthereumFinder.deployed()).address;
    manager = (await SynthereumManager.deployed()).address;
    poolPayload = encodeLiquidityPool(
      collateralAddress,
      syntheticName,
      syntheticSymbol,
      syntheticTokenAddress,
      roles,
      overCollateralization,
      fee,
      priceFeedIdentifier,
      collateralRequirement,
      liquidationReward,
      poolVersion,
    );
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
      const pool = await deployerInstance.deployPool.call(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      const isDeployed = await poolRegistryInstance.isDeployed.call(
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
      assert.equal(versions[0], 5, 'Wrong version');
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
    let selfMintingVersion = 2;
    let selfMintingFee;
    let selfMintingDerivatives;
    beforeEach(async () => {
      const pool = await deployerInstance.deployPool.call(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      const liquidityPool = await SynthereumLiquidityPool.at(pool);
      const synthTokenAddress = await liquidityPool.syntheticToken.call();
      const synthTokenInstance = await MintableBurnableSyntheticToken.at(
        synthTokenAddress,
      );
      selfMintingFee = {
        feePercentage,
        feeRecipients,
        feeProportions,
      };
      selfMintingPayload = encodeCreditLineDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        minSponsorTokens,
        excessBeneficiary,
        selfMintingVersion,
        selfMintingFee,
        liquidationReward,
        capMintAmount,
      );
      selfMintingRegistryInstance = await SelfMintingRegistry.deployed();
    });
    it('Can write in the registry', async () => {
      selfMintingDerivatives = await selfMintingRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
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
      const selfMintingDerivative = await deployerInstance.deploySelfMintingDerivative.call(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await deployerInstance.deploySelfMintingDerivative(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      const isDeployed = await selfMintingRegistryInstance.isDeployed.call(
        syntheticSymbol,
        collateralAddress,
        selfMintingVersion,
        selfMintingDerivative,
      );
      assert.equal(isDeployed, true, 'Wrong deployment status');
      selfMintingDerivatives = await selfMintingRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
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
        collateralAddress,
        'Collateral address wrong',
      );
      synthTokens = await selfMintingRegistryInstance.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 1, 'Wrong synthetic tokens number');
      assert.equal(
        synthTokens[0],
        syntheticSymbol,
        'Wrong synthetic token symbol',
      );
      versions = await selfMintingRegistryInstance.getVersions.call();
      assert.equal(versions.length, 1, 'Wrong versions number');
      assert.equal(versions[0], selfMintingVersion, 'Wrong version');
    });
    it('Revert if an address different from deployer write', async () => {
      await truffleAssert.reverts(
        selfMintingRegistryInstance.register(
          syntheticSymbol,
          collateralAddress,
          selfMintingVersion,
          wrongSelfMintingDerivative,
          { from: sender },
        ),
        'Sender must be Synthereum deployer',
      );
    });
  });
});
