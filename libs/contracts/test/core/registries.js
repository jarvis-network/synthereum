//helper scripts
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeLiquidityPool,
  encodeCreditLineDerivative,
  encodeFixedRate,
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
const SynthereumFixedRateWrapper = artifacts.require(
  'SynthereumFixedRateWrapper',
);
const MockAggregator = artifacts.require('MockAggregator');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const SynthereumSyntheticTokenPermitFactory = artifacts.require(
  'SynthereumSyntheticTokenPermitFactory',
);
const SynthereumPoolRegistry = artifacts.require('SynthereumPoolRegistry');
const SelfMintingRegistry = artifacts.require('SelfMintingRegistry');
const SynthereumFixedRateRegistry = artifacts.require(
  'SynthereumFixedRateRegistry',
);

contract('Registries', function (accounts) {
  let collateralAddress;
  let priceFeedIdentifier = 'EURUSD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let syntheticSymbol = 'jEUR';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let collateralRequirement = web3Utils.toWei('1.1');
  let minSponsorTokens = web3Utils.toWei('1');
  let excessBeneficiary = accounts[4];
  let finder;
  let synthereumFinderAddress;
  let manager;
  let poolVersion;
  let selfMintingVersion;
  let fixedRateVersion;
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
  let minterRole;
  let burnerRole;

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
    finder = await SynthereumFinder.deployed();
    const synthereumLiquidityPoolLib = await SynthereumLiquidityPoolLib.new();
    await SynthereumLiquidityPoolFactory.link(synthereumLiquidityPoolLib);
    poolFactoryInstance = await SynthereumLiquidityPoolFactory.new(
      finder.address,
    );
    await factoryVersioningInstance.setFactory(
      web3.utils.stringToHex('PoolFactory'),
      5,
      poolFactoryInstance.address,
      { from: maintainer },
    );
    selfMintingFactoryInstance = await CreditLineFactory.deployed();
    poolRegistryInstance = await SynthereumPoolRegistry.deployed();
    minterRole = web3Utils.soliditySha3('Minter');
    burnerRole = web3Utils.soliditySha3('Burner');
  });
  beforeEach(async () => {
    deployerInstance = await SynthereumDeployer.deployed();
    poolVersion = 5;
    selfMintingVersion = 2;
    fixedRateVersion = 1;
    synthereumFinderAddress = finder.address;
    manager = await SynthereumManager.deployed();
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

  describe('Should register pool', async () => {
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
      assert.equal(versions[0], poolVersion, 'Wrong version');
    });
    it('Can revert if writing by an address different from deployer', async () => {
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
    it('Can migrate pools in the new deployed registry', async () => {
      const actualPools = await poolRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        poolVersion,
      );
      const newRegistry = await SynthereumPoolRegistry.new(
        synthereumFinderAddress,
      );
      pools = await newRegistry.getElements.call(
        syntheticSymbol,
        collateralAddress,
        poolVersion,
      );
      assert.equal(pools.length, actualPools.length, 'Pools number wrong');
      assert.deepEqual(pools, actualPools, 'Wrong pool addresses');
      collaterals = await newRegistry.getCollaterals.call();
      assert.equal(collaterals.length, 1, 'Collateral number wrong');
      assert.equal(
        collaterals[0],
        collateralAddress,
        'Collateral address wrong',
      );
      synthTokens = await newRegistry.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 1, 'Wrong synthetic tokens number');
      assert.equal(synthTokens[0], 'jEUR', 'Wrong synthetic token symbol');
      versions = await newRegistry.getVersions.call();
      assert.equal(versions.length, 1, 'Wrong versions number');
      assert.equal(versions[0], poolVersion, 'Wrong version');
    });
    it('Can revert if adding an already registered pool', async () => {
      const pool = await deployerInstance.deployPool.call(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        maintainer,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        poolRegistryInstance.register(
          syntheticSymbol,
          collateralAddress,
          poolVersion,
          pool,
          { from: maintainer },
        ),
        'Element already supported',
      );
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        deployerInstance.address,
        {
          from: maintainer,
        },
      );
    });
  });

  describe('Should unregister pool', async () => {
    let pool;
    let synthTokenAddress;

    beforeEach(async () => {
      pool = await deployerInstance.deployPool.call(poolVersion, poolPayload, {
        from: maintainer,
      });
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      const poolContract = await SynthereumLiquidityPool.at(pool);
      synthTokenAddress = await poolContract.syntheticToken.call();
    });
    it('Can unregister in the registry', async () => {
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
      await manager.revokeSynthereumRole(
        [synthTokenAddress, synthTokenAddress],
        [minterRole, burnerRole],
        [pool, pool],
        { from: maintainer },
      );
      await deployerInstance.removePool(pool, {
        from: maintainer,
      });
      const newPools = await poolRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        poolVersion,
      );
      assert.equal(
        parseInt(newPools.length) + 1,
        parseInt(pools.length),
        'Wrong pools number',
      );
      isDeployed = await poolRegistryInstance.isDeployed.call(
        syntheticSymbol,
        collateralAddress,
        poolVersion,
        pool,
      );
      assert.equal(isDeployed, false, 'Wrong deployment status');
    });
    it('Can revert if unregistering by an address different from deployer', async () => {
      const pool = await deployerInstance.deployPool.call(
        poolVersion,
        poolPayload,
        {
          from: maintainer,
        },
      );
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        poolRegistryInstance.unregister(
          syntheticSymbol,
          collateralAddress,
          poolVersion,
          pool,
          { from: sender },
        ),
        'Sender must be Synthereum deployer',
      );
    });
    it('Can revert if removing a not registered pool', async () => {
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        maintainer,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        poolRegistryInstance.unregister(
          syntheticSymbol,
          collateralAddress,
          poolVersion,
          wrongAddressPool,
          { from: maintainer },
        ),
        'Element not supported',
      );
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        deployerInstance.address,
        {
          from: maintainer,
        },
      );
    });
  });

  describe('Should register self-minting', async () => {
    let selfMintingPayload;
    let selfMintingRegistryInstance;
    let selfMintingFee;
    let selfMintingDerivatives;
    let synthTokenAddress;
    let synthTokenInstance;
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
      synthTokenAddress = await liquidityPool.syntheticToken.call();
      synthTokenInstance = await MintableBurnableSyntheticToken.at(
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
    it('Can revert if an address different from deployer write', async () => {
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
    it('Can migrate selfMinting in the new deployed registry', async () => {
      const actualDerivatives = await selfMintingRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        selfMintingVersion,
      );
      const newRegistry = await SelfMintingRegistry.new(
        synthereumFinderAddress,
      );
      derivatives = await newRegistry.getElements.call(
        syntheticSymbol,
        collateralAddress,
        selfMintingVersion,
      );
      assert.equal(
        derivatives.length,
        actualDerivatives.length,
        'Derivatives number wrong',
      );
      assert.deepEqual(
        derivatives,
        actualDerivatives,
        'Wrong derivative addresses',
      );
      collaterals = await newRegistry.getCollaterals.call();
      assert.equal(collaterals.length, 1, 'Collateral number wrong');
      assert.equal(
        collaterals[0],
        collateralAddress,
        'Collateral address wrong',
      );
      synthTokens = await newRegistry.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 1, 'Wrong synthetic tokens number');
      assert.equal(synthTokens[0], 'jEUR', 'Wrong synthetic token symbol');
      versions = await newRegistry.getVersions.call();
      assert.equal(versions.length, 1, 'Wrong versions number');
      assert.equal(versions[0], selfMintingVersion, 'Wrong version');
    });
    it('Can revert if adding an already registered selfMinting', async () => {
      const derivative = await deployerInstance.deploySelfMintingDerivative.call(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await deployerInstance.deploySelfMintingDerivative(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        maintainer,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        selfMintingRegistryInstance.register(
          syntheticSymbol,
          collateralAddress,
          selfMintingVersion,
          derivative,
          { from: maintainer },
        ),
        'Element already supported',
      );
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        deployerInstance.address,
        {
          from: maintainer,
        },
      );
    });
  });

  describe('Should unregister self-minting', async () => {
    let derivative;
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
      synthTokenAddress = await liquidityPool.syntheticToken.call();
      synthTokenInstance = await MintableBurnableSyntheticToken.at(
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
      derivative = await deployerInstance.deploySelfMintingDerivative.call(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await deployerInstance.deploySelfMintingDerivative(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
    });
    it('Can unregister in the registry', async () => {
      let isDeployed = await selfMintingRegistryInstance.isDeployed.call(
        syntheticSymbol,
        collateralAddress,
        selfMintingVersion,
        derivative,
      );
      assert.equal(isDeployed, true, 'Wrong deployment status');
      derivatives = await selfMintingRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        selfMintingVersion,
      );
      await manager.revokeSynthereumRole(
        [synthTokenAddress, synthTokenAddress],
        [minterRole, burnerRole],
        [derivative, derivative],
        { from: maintainer },
      );
      await deployerInstance.removeSelfMintingDerivative(derivative, {
        from: maintainer,
      });
      const newDerivatives = await selfMintingRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        selfMintingVersion,
      );
      assert.equal(
        parseInt(newDerivatives.length) + 1,
        parseInt(derivatives.length),
        'Wrong derivatives number',
      );
      isDeployed = await selfMintingRegistryInstance.isDeployed.call(
        syntheticSymbol,
        collateralAddress,
        selfMintingVersion,
        derivative,
      );
      assert.equal(isDeployed, false, 'Wrong deployment status');
    });
    it('Can revert if unregistering by an address different from deployer', async () => {
      const derivative = await deployerInstance.deploySelfMintingDerivative.call(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await deployerInstance.deploySelfMintingDerivative(
        selfMintingVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        selfMintingRegistryInstance.unregister(
          syntheticSymbol,
          collateralAddress,
          selfMintingVersion,
          derivative,
          { from: sender },
        ),
        'Sender must be Synthereum deployer',
      );
    });
    it('Can revert if removing a not registered derivative', async () => {
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        maintainer,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        selfMintingRegistryInstance.unregister(
          syntheticSymbol,
          collateralAddress,
          selfMintingVersion,
          wrongAddressPool,
          { from: maintainer },
        ),
        'Element not supported',
      );
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        deployerInstance.address,
        {
          from: maintainer,
        },
      );
    });
  });

  describe('Should register fixed-rate', async () => {
    let synthTokenAddress;
    let fixedRate = web3.utils.toWei('1');
    let fixedRatePayload;
    beforeEach(async () => {
      fixedRateRegistryInstance = await SynthereumFixedRateRegistry.deployed();
      fixedRatePayload = encodeFixedRate(
        collateralAddress,
        syntheticName,
        syntheticSymbol,
        ZERO_ADDRESS,
        {
          admin: admin,
          maintainer: maintainer,
        },
        fixedRateVersion,
        fixedRate,
      );
    });
    it('Can write in the registry', async () => {
      let wrappers = await fixedRateRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        fixedRateVersion,
      );
      assert.equal(wrappers.length, 0, 'Pools not void');
      let collaterals = await fixedRateRegistryInstance.getCollaterals.call();
      assert.equal(collaterals.length, 0, 'Collaterals not void');
      let synthTokens = await fixedRateRegistryInstance.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 0, 'Synthetic tokens not void');
      let versions = await fixedRateRegistryInstance.getVersions.call();
      assert.equal(versions.length, 0, 'Versions not void');
      const fixedRateWrapper = await deployerInstance.deployFixedRate.call(
        fixedRateVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      await deployerInstance.deployFixedRate(
        fixedRateVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      const isDeployed = await fixedRateRegistryInstance.isDeployed.call(
        syntheticSymbol,
        collateralAddress,
        fixedRateVersion,
        fixedRateWrapper,
      );
      assert.equal(isDeployed, true, 'Wrong deployment status');
      wrappers = await fixedRateRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        fixedRateVersion,
      );
      assert.equal(wrappers.length, 1, 'Wrappers number wrong');
      assert.equal(wrappers[0], fixedRateWrapper, 'Wrong wrappers address');
      collaterals = await fixedRateRegistryInstance.getCollaterals.call();
      assert.equal(collaterals.length, 1, 'Collateral number wrong');
      assert.equal(
        collaterals[0],
        collateralAddress,
        'Collateral address wrong',
      );
      synthTokens = await fixedRateRegistryInstance.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 1, 'Wrong synthetic tokens number');
      assert.equal(synthTokens[0], 'jEUR', 'Wrong synthetic token symbol');
      versions = await fixedRateRegistryInstance.getVersions.call();
      assert.equal(versions.length, 1, 'Wrong versions number');
      assert.equal(versions[0], fixedRateVersion, 'Wrong version');
    });
    it('Can revert if writing by an address different from deployer', async () => {
      await truffleAssert.reverts(
        fixedRateRegistryInstance.register(
          syntheticSymbol,
          collateralAddress,
          fixedRateVersion,
          wrongAddressPool,
          { from: sender },
        ),
        'Sender must be Synthereum deployer',
      );
    });
    it('Can migrate fixed-rate in the new deployed registry', async () => {
      const actualWrappers = await fixedRateRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        fixedRateVersion,
      );
      const newRegistry = await SynthereumFixedRateRegistry.new(
        synthereumFinderAddress,
      );
      const wrappers = await newRegistry.getElements.call(
        syntheticSymbol,
        collateralAddress,
        fixedRateVersion,
      );
      assert.equal(
        wrappers.length,
        actualWrappers.length,
        'Pools number wrong',
      );
      assert.deepEqual(wrappers, actualWrappers, 'Wrong fixed-rate addresses');
      collaterals = await newRegistry.getCollaterals.call();
      assert.equal(collaterals.length, 1, 'Collateral number wrong');
      assert.equal(
        collaterals[0],
        collateralAddress,
        'Collateral address wrong',
      );
      synthTokens = await newRegistry.getSyntheticTokens.call();
      assert.equal(synthTokens.length, 1, 'Wrong synthetic tokens number');
      assert.equal(synthTokens[0], 'jEUR', 'Wrong synthetic token symbol');
      versions = await newRegistry.getVersions.call();
      assert.equal(versions.length, 1, 'Wrong versions number');
      assert.equal(versions[0], fixedRateVersion, 'Wrong version');
    });
    it('Can revert if adding an already registered fixed-rate', async () => {
      const fixedRateWrapper = await deployerInstance.deployFixedRate.call(
        fixedRateVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      await deployerInstance.deployFixedRate(
        fixedRateVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        maintainer,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        fixedRateRegistryInstance.register(
          syntheticSymbol,
          collateralAddress,
          fixedRateVersion,
          fixedRateWrapper,
          { from: maintainer },
        ),
        'Element already supported',
      );
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        deployerInstance.address,
        {
          from: maintainer,
        },
      );
    });
  });

  describe('Should unregister fixed-rate', async () => {
    let wrapper;
    let fixedRatePayload;
    let fixedRate = web3.utils.toWei('1');
    beforeEach(async () => {
      fixedRateRegistryInstance = await SynthereumFixedRateRegistry.deployed();
      fixedRatePayload = encodeFixedRate(
        collateralAddress,
        syntheticName,
        syntheticSymbol,
        ZERO_ADDRESS,
        {
          admin: admin,
          maintainer: maintainer,
        },
        fixedRateVersion,
        fixedRate,
      );
      wrapper = await deployerInstance.deployFixedRate.call(
        fixedRateVersion,
        fixedRatePayload,
        {
          from: maintainer,
        },
      );
      await deployerInstance.deployFixedRate(
        fixedRateVersion,
        fixedRatePayload,
        {
          from: maintainer,
        },
      );
      const wrapperContract = await SynthereumFixedRateWrapper.at(wrapper);
      synthTokenAddress = await wrapperContract.syntheticToken.call();
    });
    it('Can unregister in the registry', async () => {
      let isDeployed = await fixedRateRegistryInstance.isDeployed.call(
        syntheticSymbol,
        collateralAddress,
        fixedRateVersion,
        wrapper,
      );
      assert.equal(isDeployed, true, 'Wrong deployment status');
      const wrappers = await fixedRateRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        fixedRateVersion,
      );
      await manager.revokeSynthereumRole(
        [synthTokenAddress, synthTokenAddress],
        [minterRole, burnerRole],
        [wrapper, wrapper],
        { from: maintainer },
      );
      await deployerInstance.removeFixedRate(wrapper, {
        from: maintainer,
      });
      const newWrappers = await fixedRateRegistryInstance.getElements.call(
        syntheticSymbol,
        collateralAddress,
        fixedRateVersion,
      );
      assert.equal(
        parseInt(newWrappers.length) + 1,
        parseInt(wrappers.length),
        'Wrong wrappers number',
      );
      isDeployed = await fixedRateRegistryInstance.isDeployed.call(
        syntheticSymbol,
        collateralAddress,
        fixedRateVersion,
        wrapper,
      );
      assert.equal(isDeployed, false, 'Wrong deployment status');
    });
    it('Can revert if unregistering by an address different from deployer', async () => {
      await truffleAssert.reverts(
        fixedRateRegistryInstance.unregister(
          syntheticSymbol,
          collateralAddress,
          fixedRateVersion,
          wrapper,
          { from: sender },
        ),
        'Sender must be Synthereum deployer',
      );
    });
    it('Can revert if removing a not registered fixed-rate', async () => {
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        maintainer,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        fixedRateRegistryInstance.unregister(
          syntheticSymbol,
          collateralAddress,
          fixedRateVersion,
          wrongAddressPool,
          { from: maintainer },
        ),
        'Element not supported',
      );
      await finder.changeImplementationAddress(
        web3.utils.stringToHex('Deployer'),
        deployerInstance.address,
        {
          from: maintainer,
        },
      );
    });
  });
});
