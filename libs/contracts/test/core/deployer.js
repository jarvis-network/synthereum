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
const SynthereumMultiLpLiquidityPool = artifacts.require(
  'SynthereumMultiLpLiquidityPool',
);
const SynthereumLiquidityPoolFactory = artifacts.require(
  'SynthereumLiquidityPoolFactory',
);
const CreditLine = artifacts.require('CreditLine');
const CreditLineFactory = artifacts.require('CreditLineFactory');
const CreditLineController = artifacts.require('CreditLineController');
const SynthereumFixedRateWrapper = artifacts.require(
  'SynthereumFixedRateWrapper',
);
const SynthereumFixedRateFactory = artifacts.require(
  'SynthereumFixedRateFactory',
);
const SynthereumLiquidityPool = artifacts.require('SynthereumLiquidityPool');
const MockAggregator = artifacts.require('MockAggregator');
const SynthereumPriceFeed = artifacts.require('SynthereumPriceFeed');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const SynthereumSyntheticTokenPermitFactory = artifacts.require(
  'SynthereumSyntheticTokenPermitFactory',
);
const SynthereumTrustedForwarder = artifacts.require(
  'SynthereumTrustedForwarder',
);
const {
  encodeMultiLpLiquidityPool,
  encodeMultiLpLiquidityPoolMigration,
  encodeFixedRate,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const PoolV6Data = require('../../data/test/poolV6.json');

contract('Deployer', function (accounts) {
  let collateralAddress;
  let priceIdentifier = 'EURUSD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let synthSymbol = 'jEUR';
  let lendingId = 'AaveV3';
  let daoInterestShare = web3.utils.toWei('0.1');
  let jrtBuybackShare = web3.utils.toWei('0.6');
  let collateralRequirement = web3Utils.toWei('1.1');
  let minSponsorTokens = web3Utils.toWei('1');
  let excessBeneficiary = accounts[4];
  let synthereumFinderAddress;
  let manager;
  let managerContract;
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
  let overCollateralRequirement = web3.utils.toWei('0.05');
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
  let selfMintingFee;
  let capMintAmount = web3Utils.toWei('1000000');
  let firstWrongAddress = accounts[6];
  let poolPayload;
  let collateralWhitelistInstance;
  let identifierWhitelistInstance;
  let factoryVersioningInstance;
  let mockAggregator;
  let priceFeed;
  let synthereumChainlinkPriceFeed;
  let tokenFactory;
  let forwarderInstance;
  let minterRole;
  let burnerRole;
  let maxSpread;

  before(async () => {
    const networkId = await web3.eth.net.getId();
    collateralAddress = PoolV6Data[networkId].collateral;
    mockAggregator = await MockAggregator.new(8, 120000000);
    priceFeed = await SynthereumPriceFeed.deployed();
    synthereumChainlinkPriceFeed =
      await SynthereumChainlinkPriceFeed.deployed();
    await priceFeed.addOracle(
      'chainlink',
      synthereumChainlinkPriceFeed.address,
      { from: maintainer },
    );
    maxSpread = web3.utils.toWei('0.001');
    await synthereumChainlinkPriceFeed.setPair(
      priceIdentifier,
      1,
      mockAggregator.address,
      0,
      '0x',
      maxSpread,
      { from: maintainer },
    );
    await priceFeed.setPair(priceIdentifier, 1, 'chainlink', [], {
      from: maintainer,
    });
    collateralWhitelistInstance =
      await SynthereumCollateralWhitelist.deployed();
    await collateralWhitelistInstance.addToWhitelist(collateralAddress, {
      from: maintainer,
    });
    identifierWhitelistInstance =
      await SynthereumIdentifierWhitelist.deployed();
    await identifierWhitelistInstance.addToWhitelist(
      web3.utils.utf8ToHex(priceIdentifier),
      {
        from: maintainer,
      },
    );
    factoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
    tokenFactory = await SynthereumSyntheticTokenPermitFactory.deployed();
    forwarderInstance = await SynthereumTrustedForwarder.deployed();
    minterRole = web3Utils.soliditySha3('Minter');
    burnerRole = web3Utils.soliditySha3('Burner');
  });
  beforeEach(async () => {
    deployerInstance = await SynthereumDeployer.deployed();
    poolVersion = 6;
    finderInstance = await SynthereumFinder.deployed();
    synthereumFinderAddress = finderInstance.address;
    managerContract = await SynthereumManager.deployed();
    manager = managerContract.address;
    poolPayload = encodeMultiLpLiquidityPool(
      poolVersion,
      collateralAddress,
      syntheticName,
      synthSymbol,
      ZERO_ADDRESS,
      roles,
      feePercentage,
      priceIdentifier,
      overCollateralRequirement,
      liquidationReward,
      lendingId,
      ZERO_ADDRESS,
      daoInterestShare,
      jrtBuybackShare,
    );
  });

  describe('Should deploy pool', () => {
    before(async () => {
      const synthereumLiquidityPoolLib = await SynthereumLiquidityPoolLib.new();
      await SynthereumLiquidityPoolFactory.link(synthereumLiquidityPoolLib);
    });

    it('Can deploy with new synthetic token', async () => {
      const pool = await deployerInstance.deployPool.call(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      const deploymentTx = await deployerInstance.deployPool(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(deploymentTx, 'PoolDeployed', ev => {
        return ev.poolVersion == 6 && ev.newPool == pool;
      });
      //Check roles of synth token
      const liquidityPool = await SynthereumLiquidityPool.at(pool);
      const synthTokenAddress = await liquidityPool.syntheticToken.call();
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
      assert.equal(minters[0], pool, 'Pool is not the token minter');
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        1,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(burners[0], pool, 'Pool is not the token burner');
    });
    it('Can deploy with already existing synthetic token', async () => {
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
      const secondPoolPayload = encodeMultiLpLiquidityPool(
        poolVersion,
        collateralAddress,
        syntheticName,
        synthSymbol,
        synthTokenAddress,
        roles,
        feePercentage,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingId,
        ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      );
      const secondPool = await deployerInstance.deployPool.call(
        poolVersion,
        secondPoolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPool(poolVersion, secondPoolPayload, {
        from: maintainer,
      });
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
      assert.equal(minters[0], pool, 'First pool is not the token minter');
      assert.equal(
        minters[1],
        secondPool,
        'Second pool is not the token minter',
      );
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        2,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(burners[0], pool, 'First pool is not the token burner');
      assert.equal(
        burners[1],
        secondPool,
        'Second pool is not the token burner',
      );
    });
    it('Can revert if the caller of deploy is not the maintainer of the deployer', async () => {
      await truffleAssert.reverts(
        deployerInstance.deployPool(poolVersion, poolPayload, {
          from: firstWrongAddress,
        }),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if Synthereum finder of pool is different from the deployer one', async () => {
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
        web3Utils.stringToHex('CollateralWhitelist'),
        collateralWhitelistInstance.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('IdentifierWhitelist'),
        identifierWhitelistInstance.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('TokenFactory'),
        tokenFactory.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('Manager'),
        manager,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('PriceFeed'),
        synthereumChainlinkPriceFeed.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('TrustedForwarder'),
        forwarderInstance.address,
        { from: maintainer },
      );

      const wrongFactory = await SynthereumLiquidityPoolFactory.new(
        newFinder.address,
      );
      await factoryVersioningInstance.setFactory(
        web3.utils.stringToHex('PoolFactory'),
        5,
        wrongFactory.address,
        { from: maintainer },
      );
      const revertingPoolPayload = encodeLiquidityPool(
        collateralAddress,
        syntheticName,
        synthSymbol,
        ZERO_ADDRESS,
        roles,
        overCollateralization,
        fee,
        priceIdentifier,
        collateralRequirement,
        liquidationReward,
        5,
      );
      await truffleAssert.reverts(
        deployerInstance.deployPool(5, revertingPoolPayload, {
          from: maintainer,
        }),
        'Wrong finder in deployment',
      );
      await factoryVersioningInstance.removeFactory(
        web3.utils.stringToHex('PoolFactory'),
        5,
        { from: maintainer },
      );
    });
    it('Can revert if pool version is different from the one using in the deployemnt', async () => {
      const newFactory = await SynthereumLiquidityPoolFactory.new(
        finderInstance.address,
      );
      await factoryVersioningInstance.setFactory(
        web3.utils.stringToHex('PoolFactory'),
        5,
        newFactory.address,
        { from: maintainer },
      );
      const wrongPoolVersion = 6;
      const revertingPoolPayload = encodeLiquidityPool(
        collateralAddress,
        syntheticName,
        synthSymbol,
        ZERO_ADDRESS,
        roles,
        overCollateralization,
        fee,
        priceIdentifier,
        collateralRequirement,
        liquidationReward,
        wrongPoolVersion,
      );

      await truffleAssert.reverts(
        deployerInstance.deployPool(5, revertingPoolPayload, {
          from: maintainer,
        }),
        'Wrong version in deployment',
      );
    });
  });

  describe('Should migrate pool', () => {
    let poolDataPayload;
    const migratePoolVersion = 6;
    beforeEach(async () => {
      const multiLpRoles = {
        admin,
        maintainer,
      };
      const overCollateralRequirement = web3.utils.toWei('0.05');
      const daoInterestShare = web3.utils.toWei('0.1');
      const jrtBuybackShare = web3.utils.toWei('0.6');
      poolDataPayload = encodeMultiLpLiquidityPool(
        migratePoolVersion,
        collateralAddress,
        syntheticName,
        synthSymbol,
        ZERO_ADDRESS,
        multiLpRoles,
        feePercentage,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingId,
        ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      );
    });
    it('Can migrate pool', async () => {
      const pool = await deployerInstance.deployPool.call(
        migratePoolVersion,
        poolDataPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPool(migratePoolVersion, poolDataPayload, {
        from: maintainer,
      });
      const migrationPayload = encodeMultiLpLiquidityPoolMigration(
        pool,
        migratePoolVersion,
        '0x',
      );
      const newPool = await deployerInstance.migratePool.call(
        pool,
        migratePoolVersion,
        migrationPayload,
        {
          from: maintainer,
        },
      );
      const migrationTx = await deployerInstance.migratePool(
        pool,
        migratePoolVersion,
        migrationPayload,
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(migrationTx, 'PoolMigrated', ev => {
        return (
          ev.migratedPool == pool &&
          ev.poolVersion == migratePoolVersion &&
          ev.newPool == newPool
        );
      });
      //Check roles of synth token
      const liquidityPool = await SynthereumMultiLpLiquidityPool.at(pool);
      const synthTokenAddress = await liquidityPool.syntheticToken.call();
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
      assert.equal(minters[0], newPool, 'Pool is not the token minter');
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        1,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(burners[0], newPool, 'Pool is not the token burner');
    });
    it('Can revert if the caller of the migration is not the maintainer', async () => {
      const pool = await deployerInstance.deployPool.call(
        migratePoolVersion,
        poolDataPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPool(migratePoolVersion, poolDataPayload, {
        from: maintainer,
      });
      const migrationPayload = encodeMultiLpLiquidityPoolMigration(
        pool,
        migratePoolVersion,
        '0x',
      );
      await truffleAssert.reverts(
        deployerInstance.migratePool(
          pool,
          migratePoolVersion,
          migrationPayload,
          {
            from: firstWrongAddress,
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if the pool migrating from is not correct', async () => {
      const pool = await deployerInstance.deployPool.call(
        migratePoolVersion,
        poolDataPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPool(migratePoolVersion, poolDataPayload, {
        from: maintainer,
      });
      const migrationPayload = encodeMultiLpLiquidityPoolMigration(
        pool,
        migratePoolVersion,
        '0x',
      );
      await truffleAssert.reverts(
        deployerInstance.migratePool(
          firstWrongAddress,
          migratePoolVersion,
          migrationPayload,
          {
            from: maintainer,
          },
        ),
        'Wrong migration pool',
      );
    });
  });

  describe('Should remove pool', () => {
    it('Can remove pool', async () => {
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
      await managerContract.revokeSynthereumRole(
        [synthTokenAddress, synthTokenAddress],
        [minterRole, burnerRole],
        [pool, pool],
        { from: maintainer },
      );
      const poolRemovedTx = await deployerInstance.removePool(pool, {
        from: maintainer,
      });
      truffleAssert.eventEmitted(poolRemovedTx, 'PoolRemoved', ev => {
        return ev.pool == pool;
      });
    });
    it('Can revert if the pool has minter role of the synth token', async () => {
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
      await managerContract.revokeSynthereumRole(
        [synthTokenAddress],
        [burnerRole],
        [pool],
        { from: maintainer },
      );
      await truffleAssert.reverts(
        deployerInstance.removePool(pool, {
          from: maintainer,
        }),
        'Contract has minter role',
      );
    });
    it('Can revert if the pool has burner role of the synth token', async () => {
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
      await managerContract.revokeSynthereumRole(
        [synthTokenAddress],
        [minterRole],
        [pool],
        { from: maintainer },
      );
      await truffleAssert.reverts(
        deployerInstance.removePool(pool, {
          from: maintainer,
        }),
        'Contract has burner role',
      );
    });
  });

  describe('Should Deploy self-minting derivative', async () => {
    let stdDerivativeAddr;
    let synthTokenInstance;
    let selfMintingDerivativeVersion = 2;
    let selfMintingPayload;
    let selfMintingCollateralAddress;
    let selfMintingPriceFeedIdentifier = 'EURJRT';
    let creditLineController;
    before(async () => {
      selfMintingCollateralAddress = (
        await TestnetSelfMintingERC20.new('Self-minting Testnet', 'jrt', 18)
      ).address;
      mockAggregator = await MockAggregator.new(8, 140000000);
      await synthereumChainlinkPriceFeed.setPair(
        selfMintingPriceFeedIdentifier,
        1,
        mockAggregator.address,
        0,
        '0x',
        maxSpread,
        { from: maintainer },
      );
      await priceFeed.setPair(
        selfMintingPriceFeedIdentifier,
        1,
        'chainlink',
        [],
        {
          from: maintainer,
        },
      );
      await collateralWhitelistInstance.addToWhitelist(
        selfMintingCollateralAddress,
        {
          from: maintainer,
        },
      );
      await identifierWhitelistInstance.addToWhitelist(
        web3.utils.utf8ToHex(selfMintingPriceFeedIdentifier),
        {
          from: maintainer,
        },
      );
      creditLineController = await CreditLineController.deployed();
    });
    beforeEach(async () => {
      const pool = await deployerInstance.deployPool.call(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      const deploymentTx = await deployerInstance.deployPool(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      const liquidityPool = await SynthereumLiquidityPool.at(pool);
      const synthTokenAddress = await liquidityPool.syntheticToken.call();
      synthTokenInstance = await MintableBurnableSyntheticToken.at(
        synthTokenAddress,
      );
      selfMintingFee = {
        feePercentage,
        feeRecipients,
        feeProportions,
      };
      selfMintingPayload = encodeCreditLineDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        synthSymbol,
        synthTokenInstance.address,
        collateralRequirement,
        minSponsorTokens,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        selfMintingFee,
        liquidationReward,
        capMintAmount,
      );
    });
    it('Can deploy', async () => {
      const selfMintingDerivative =
        await deployerInstance.deploySelfMintingDerivative.call(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        );
      const deploymentTx = await deployerInstance.deploySelfMintingDerivative(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(
        deploymentTx,
        'SelfMintingDerivativeDeployed',
        ev => {
          return (
            ev.selfMintingDerivativeVersion == 2 &&
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
        minters[1],
        selfMintingDerivative,
        'Second contract is not the token minter',
      );
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        2,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(
        burners[1],
        selfMintingDerivative,
        'Second contract is not the token burner',
      );
    });
    it('Can revert if the caller of deploy is not the maintainer of the deployer', async () => {
      await truffleAssert.reverts(
        deployerInstance.deploySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: firstWrongAddress },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if Synthereum finder of pool is different from the deployer one', async () => {
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
        web3Utils.stringToHex('CollateralWhitelist'),
        collateralWhitelistInstance.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('IdentifierWhitelist'),
        identifierWhitelistInstance.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('Manager'),
        manager,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('PriceFeed'),
        synthereumChainlinkPriceFeed.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('CreditLineController'),
        creditLineController.address,
        { from: maintainer },
      );
      const wrongFactory = await CreditLineFactory.new(
        newFinder.address,
        (
          await CreditLine.deployed()
        ).address,
      );
      await factoryVersioningInstance.setFactory(
        web3.utils.stringToHex('SelfMintingFactory'),
        2,
        wrongFactory.address,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        deployerInstance.deploySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Wrong finder in deployment',
      );
      await factoryVersioningInstance.setFactory(
        web3.utils.stringToHex('SelfMintingFactory'),
        2,
        (
          await CreditLineFactory.deployed()
        ).address,
        { from: maintainer },
      );
    });
    it('Can revert if pool version is different from the one using in the deployemnt', async () => {
      const creditLine = await CreditLineController.new(
        synthereumFinderAddress,
        roles,
        3,
      );
      await finderInstance.changeImplementationAddress(
        web3.utils.stringToHex('CreditLineController'),
        creditLine.address,
        { from: maintainer },
      );
      const wrongDerVersion = 3;
      selfMintingPayload = encodeCreditLineDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        synthSymbol,
        synthTokenInstance.address,
        collateralRequirement,
        minSponsorTokens,
        excessBeneficiary,
        wrongDerVersion,
        selfMintingFee,
        liquidationReward,
        capMintAmount,
      );
      await truffleAssert.reverts(
        deployerInstance.deploySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          {
            from: maintainer,
          },
        ),
        'Wrong version in deployment',
      );
      await finderInstance.changeImplementationAddress(
        web3.utils.stringToHex('CreditLineController'),
        (
          await CreditLineController.deployed()
        ).address,
        { from: maintainer },
      );
    });
  });

  describe('Should Remove self-minting derivative', async () => {
    let synthTokenInstance;
    let selfMintingDerivativeVersion = 2;
    let selfMintingPayload;
    let selfMintingCollateralAddress;
    let selfMintingPriceFeedIdentifier = 'EURJRT';
    let synthTokenAddress;
    before(async () => {
      selfMintingCollateralAddress = (
        await TestnetSelfMintingERC20.new('Self-minting Testnet', 'jrt', 18)
      ).address;
      mockAggregator = await MockAggregator.new(8, 140000000);
      await synthereumChainlinkPriceFeed.setPair(
        selfMintingPriceFeedIdentifier,
        1,
        mockAggregator.address,
        0,
        '0x',
        maxSpread,
        { from: maintainer },
      );
      await priceFeed.setPair(
        selfMintingPriceFeedIdentifier,
        1,
        'chainlink',
        [],
        {
          from: maintainer,
        },
      );
      await collateralWhitelistInstance.addToWhitelist(
        selfMintingCollateralAddress,
        {
          from: maintainer,
        },
      );
      creditLineController = await CreditLineController.deployed();
    });
    beforeEach(async () => {
      const pool = await deployerInstance.deployPool.call(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
      const deploymentTx = await deployerInstance.deployPool(
        poolVersion,
        poolPayload,
        { from: maintainer },
      );
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
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        synthSymbol,
        synthTokenInstance.address,
        collateralRequirement,
        minSponsorTokens,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        selfMintingFee,
        liquidationReward,
        capMintAmount,
      );
    });
    it('Can remove self-minting derivative', async () => {
      const selfMintingDerivative =
        await deployerInstance.deploySelfMintingDerivative.call(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        );
      await deployerInstance.deploySelfMintingDerivative(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await managerContract.revokeSynthereumRole(
        [synthTokenAddress, synthTokenAddress],
        [minterRole, burnerRole],
        [selfMintingDerivative, selfMintingDerivative],
        { from: maintainer },
      );
      const derivativeRemovedTx =
        await deployerInstance.removeSelfMintingDerivative(
          selfMintingDerivative,
          {
            from: maintainer,
          },
        );
      truffleAssert.eventEmitted(
        derivativeRemovedTx,
        'SelfMintingDerivativeRemoved',
        ev => {
          return ev.selfMintingDerivative == selfMintingDerivative;
        },
      );
    });
    it('Can revert if the self-minting derivative has minter role of the synth token', async () => {
      const selfMintingDerivative =
        await deployerInstance.deploySelfMintingDerivative.call(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        );
      await deployerInstance.deploySelfMintingDerivative(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await managerContract.revokeSynthereumRole(
        [synthTokenAddress],
        [burnerRole],
        [selfMintingDerivative],
        { from: maintainer },
      );
      await truffleAssert.reverts(
        deployerInstance.removeSelfMintingDerivative(selfMintingDerivative, {
          from: maintainer,
        }),
        'Contract has minter role',
      );
    });
    it('Can revert if the self-minting derivative has burner role of the synth token', async () => {
      const selfMintingDerivative =
        await deployerInstance.deploySelfMintingDerivative.call(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        );
      await deployerInstance.deploySelfMintingDerivative(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
      await managerContract.revokeSynthereumRole(
        [synthTokenAddress],
        [minterRole],
        [selfMintingDerivative],
        { from: maintainer },
      );
      await truffleAssert.reverts(
        deployerInstance.removeSelfMintingDerivative(selfMintingDerivative, {
          from: maintainer,
        }),
        'Contract has burner role',
      );
    });
  });

  describe('Should Deploy fixed-rate', () => {
    let fixedRatePayload;
    const fixedSyntheticName = 'USD fixed rate';
    const fixedSynthSymbol = 'jUSD';
    const fixedRateWrapperVersion = 1;
    const fixedRate = web3.utils.toWei('1');
    beforeEach(async () => {
      deployerInstance = await SynthereumDeployer.deployed();
      finderInstance = await SynthereumFinder.deployed();
      synthereumFinderAddress = finderInstance.address;
      managerContract = await SynthereumManager.deployed();
      manager = managerContract.address;
      fixedRatePayload = encodeFixedRate(
        collateralAddress,
        fixedSyntheticName,
        fixedSynthSymbol,
        ZERO_ADDRESS,
        {
          admin: admin,
          maintainer: maintainer,
        },
        fixedRateWrapperVersion,
        fixedRate,
      );
    });
    it('Can deploy with new synthetic token', async () => {
      const fixedRateWrapper = await deployerInstance.deployFixedRate.call(
        fixedRateWrapperVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      const deploymentTx = await deployerInstance.deployFixedRate(
        fixedRateWrapperVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(deploymentTx, 'FixedRateDeployed', ev => {
        return (
          ev.fixedRateVersion == fixedRateWrapperVersion &&
          ev.fixedRate == fixedRateWrapper
        );
      });
      //Check roles of synth token
      const fixedRateContract = await SynthereumFixedRateWrapper.at(
        fixedRateWrapper,
      );
      const synthTokenAddress = await fixedRateContract.syntheticToken.call();
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
        fixedRateWrapper,
        'Fixed-rate is not the token minter',
      );
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        1,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(
        burners[0],
        fixedRateWrapper,
        'Fixed-rate is not the token burner',
      );
    });
    it('Can deploy with already existing synthetic token', async () => {
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
      const minters2 = await synthTokenInstance.getMinterMembers.call();
      const secondFixedRatePayload = encodeFixedRate(
        collateralAddress,
        syntheticName,
        synthSymbol,
        synthTokenAddress,
        {
          admin: admin,
          maintainer: maintainer,
        },
        fixedRateWrapperVersion,
        fixedRate,
      );
      const secondFixedRate = await deployerInstance.deployFixedRate.call(
        fixedRateWrapperVersion,
        secondFixedRatePayload,
        { from: maintainer },
      );
      await deployerInstance.deployFixedRate(
        fixedRateWrapperVersion,
        secondFixedRatePayload,
        {
          from: maintainer,
        },
      );
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
      assert.equal(minters[0], pool, 'Pool is not the token minter');
      assert.equal(
        minters[1],
        secondFixedRate,
        'Second fixed-rate is not the token minter',
      );
      const burners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        burners.length,
        2,
        'Wrong number of burners for the synthetic token',
      );
      assert.equal(burners[0], pool, 'Pool is not the token burner');
      assert.equal(
        burners[1],
        secondFixedRate,
        'Second fixed-rate is not the token burner',
      );
    });
    it('Can revert if the caller of deploy is not the maintainer of the deployer', async () => {
      await truffleAssert.reverts(
        deployerInstance.deployFixedRate(
          fixedRateWrapperVersion,
          fixedRatePayload,
          {
            from: firstWrongAddress,
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if Synthereum finder of pool is different from the deployer one', async () => {
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
        web3Utils.stringToHex('CollateralWhitelist'),
        collateralWhitelistInstance.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('IdentifierWhitelist'),
        identifierWhitelistInstance.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('TokenFactory'),
        tokenFactory.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('Manager'),
        manager,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('PriceFeed'),
        synthereumChainlinkPriceFeed.address,
        { from: maintainer },
      );
      await newFinder.changeImplementationAddress(
        web3Utils.stringToHex('TrustedForwarder'),
        forwarderInstance.address,
        { from: maintainer },
      );
      const wrongFactory = await SynthereumFixedRateFactory.new(
        newFinder.address,
      );
      await factoryVersioningInstance.setFactory(
        web3.utils.stringToHex('FixedRateFactory'),
        1,
        wrongFactory.address,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        deployerInstance.deployFixedRate(
          fixedRateWrapperVersion,
          fixedRatePayload,
          {
            from: maintainer,
          },
        ),
        'Wrong finder in deployment',
      );
      await factoryVersioningInstance.setFactory(
        web3.utils.stringToHex('FixedRateFactory'),
        1,
        (
          await SynthereumFixedRateFactory.deployed()
        ).address,
        { from: maintainer },
      );
    });
    it('Can revert if pool version is different from the one using in the deployemnt', async () => {
      const wrongFixedRateVersion = 2;
      const wrongVersionPayload = encodeFixedRate(
        collateralAddress,
        fixedSyntheticName,
        fixedSynthSymbol,
        ZERO_ADDRESS,
        {
          admin: admin,
          maintainer: maintainer,
        },
        wrongFixedRateVersion,
        fixedRate,
      );
      await truffleAssert.reverts(
        deployerInstance.deployFixedRate(
          fixedRateWrapperVersion,
          wrongVersionPayload,
          {
            from: maintainer,
          },
        ),
        'Wrong version in deployment',
      );
    });
  });

  describe('Should Remove fixed-rate', () => {
    let fixedRatePayload;
    const fixedSyntheticName = 'USD fixed rate';
    const fixedSynthSymbol = 'jUSD';
    const fixedRateWrapperVersion = 1;
    const fixedRate = web3.utils.toWei('1');
    beforeEach(async () => {
      deployerInstance = await SynthereumDeployer.deployed();
      finderInstance = await SynthereumFinder.deployed();
      synthereumFinderAddress = finderInstance.address;
      managerContract = await SynthereumManager.deployed();
      manager = managerContract.address;
      fixedRatePayload = encodeFixedRate(
        collateralAddress,
        fixedSyntheticName,
        fixedSynthSymbol,
        ZERO_ADDRESS,
        {
          admin: admin,
          maintainer: maintainer,
        },
        fixedRateWrapperVersion,
        fixedRate,
      );
    });
    it('Can remove fixed-rate', async () => {
      const fixedRateWrapper = await deployerInstance.deployFixedRate.call(
        fixedRateWrapperVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      await deployerInstance.deployFixedRate(
        fixedRateWrapperVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      const fiexdRateWrapperContract = await SynthereumFixedRateWrapper.at(
        fixedRateWrapper,
      );
      const synthTokenAddress =
        await fiexdRateWrapperContract.syntheticToken.call();
      await managerContract.revokeSynthereumRole(
        [synthTokenAddress, synthTokenAddress],
        [minterRole, burnerRole],
        [fixedRateWrapper, fixedRateWrapper],
        { from: maintainer },
      );
      const wrapperRemovedTx = await deployerInstance.removeFixedRate(
        fixedRateWrapper,
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(wrapperRemovedTx, 'FixedRateRemoved', ev => {
        return ev.fixedRate == fixedRateWrapper;
      });
    });
    it('Can revert if the fixed-rate has minter role of the synth token', async () => {
      const fixedRateWrapper = await deployerInstance.deployFixedRate.call(
        fixedRateWrapperVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      await deployerInstance.deployFixedRate(
        fixedRateWrapperVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      const fiexdRateWrapperContract = await SynthereumFixedRateWrapper.at(
        fixedRateWrapper,
      );
      const synthTokenAddress =
        await fiexdRateWrapperContract.syntheticToken.call();
      await managerContract.revokeSynthereumRole(
        [synthTokenAddress],
        [burnerRole],
        [fixedRateWrapper],
        { from: maintainer },
      );
      await truffleAssert.reverts(
        deployerInstance.removeFixedRate(fixedRateWrapper, {
          from: maintainer,
        }),
        'Contract has minter role',
      );
    });
    it('Can revert if the fixed-rate has burner role of the synth token', async () => {
      const fixedRateWrapper = await deployerInstance.deployFixedRate.call(
        fixedRateWrapperVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      await deployerInstance.deployFixedRate(
        fixedRateWrapperVersion,
        fixedRatePayload,
        { from: maintainer },
      );
      const fiexdRateWrapperContract = await SynthereumFixedRateWrapper.at(
        fixedRateWrapper,
      );
      const synthTokenAddress =
        await fiexdRateWrapperContract.syntheticToken.call();
      await managerContract.revokeSynthereumRole(
        [synthTokenAddress],
        [minterRole],
        [fixedRateWrapper],
        { from: maintainer },
      );
      await truffleAssert.reverts(
        deployerInstance.removeFixedRate(fixedRateWrapper, {
          from: maintainer,
        }),
        'Contract has burner role',
      );
    });
  });

  describe('Should deploy a public vault', () => {
    let pool;
    beforeEach(async () => {
      pool = await deployerInstance.deployPool.call(poolVersion, poolPayload, {
        from: maintainer,
      });
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
    });
    it('Correctly deploy public vault', async () => {
      let lpName = 'test';
      let lpSymbol = 'lpTest';
      let collateralRequirement = web3Utils.toWei('1.1');

      let address = await deployerInstance.deployPublicVault.call(
        lpName,
        lpSymbol,
        pool,
        collateralRequirement,
        { from: maintainer },
      );
      let assertion = address == ZERO_ADDRESS;
      assert.equal(assertion, false);

      let tx = await deployerInstance.deployPublicVault(
        lpName,
        lpSymbol,
        pool,
        collateralRequirement,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(tx, 'PublicVaultDeployed', ev => {
        return ev.vault == address;
      });
    });
    it('Revert if caller not maintainer', async () => {
      let lpName = 'test';
      let lpSymbol = 'lpTest';
      await truffleAssert.reverts(
        deployerInstance.deployPublicVault(
          lpName,
          lpSymbol,
          pool,
          collateralRequirement,
          { from: accounts[8] },
        ),
        'Sender must be the maintainer',
      );
    });
  });
});
