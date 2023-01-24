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
const SynthereumLiquidityPoolLib = artifacts.require(
  'SynthereumLiquidityPoolLib',
);
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const SynthereumCollateralWhitelist = artifacts.require(
  'SynthereumCollateralWhitelist',
);
const SynthereumIdentifierWhitelist = artifacts.require(
  'SynthereumIdentifierWhitelist',
);
const SynthereumLiquidityPoolFactory = artifacts.require(
  'SynthereumLiquidityPoolFactory',
);
const SynthereumMultiLpLiquidityPoolFactory = artifacts.require(
  'SynthereumMultiLpLiquidityPoolFactory',
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
const {
  encodeMultiLpLiquidityPool,
  encodeMultiLpLiquidityPoolMigration,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const PoolV6Data = require('../../data/test/poolV6.json');

contract('Factories', function (accounts) {
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
  let multiPoolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
  };
  let multiLpRoles = {
    admin,
    maintainer,
  };
  let overCollateralization = web3Utils.toWei('0.2');
  let overCollateralRequirement = web3.utils.toWei('0.05');
  let liquidationReward = web3Utils.toWei('0.5');
  let feePercentage = '0.02';
  let DAO = accounts[5];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  let lendingId = 'AaveV3';
  let daoInterestShare = web3.utils.toWei('0.1');
  let jrtBuybackShare = web3.utils.toWei('0.6');
  let capMintAmount = web3Utils.toWei('1000000');
  let sender = accounts[6];
  let poolPayload;
  let collateralWhitelistInstance;
  let identifierWhitelistInstance;
  let factoryVersioningInstance;
  let mockAggregator;
  let synthereumChainlinkPriceFeed;
  let tokenFactory;
  let poolFactoryInstance;
  let selfMintingFactoryInstance;

  before(async () => {
    networkId = await web3.eth.net.getId();
    collateralAddress = PoolV6Data[networkId].collateral;
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
    const synthereumLiquidityPoolLib = await SynthereumLiquidityPoolLib.new();
    await SynthereumLiquidityPoolFactory.link(synthereumLiquidityPoolLib);
    const finder = await SynthereumFinder.deployed();
    poolFactoryInstance = await SynthereumLiquidityPoolFactory.new(
      finder.address,
    );
    await factoryVersioningInstance.setFactory(
      web3.utils.stringToHex('PoolFactory'),
      5,
      poolFactoryInstance.address,
      { from: maintainer },
    );
    multiLpPoolFactoryInstance = await SynthereumMultiLpLiquidityPoolFactory.deployed();
    selfMintingFactoryInstance = await CreditLineFactory.deployed();
  });
  beforeEach(async () => {
    deployerInstance = await SynthereumDeployer.deployed();
    poolVersion = 5;
    multiPoolVersion = 6;
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
    multiPoolPayload = encodeMultiLpLiquidityPool(
      multiPoolVersion,
      collateralAddress,
      syntheticName,
      syntheticSymbol,
      syntheticTokenAddress,
      multiLpRoles,
      feePercentage,
      priceFeedIdentifier,
      overCollateralRequirement,
      liquidationReward,
      lendingId,
      ZERO_ADDRESS,
      daoInterestShare,
      jrtBuybackShare,
    );
  });

  describe('Should deploy using factories', async () => {
    it('Can deploy pool and synthetic token', async () => {
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      //Chech deploy also for token factory without permit
      const tokenFactory = await SynthereumSyntheticTokenFactory.new(
        synthereumFinderAddress,
      );
      const tokenFactoryInterface = await web3.utils.stringToHex(
        'TokenFactory',
      );
      const finder = await SynthereumFinder.deployed();
      await finder.changeImplementationAddress(
        tokenFactoryInterface,
        tokenFactory.address,
        { from: maintainer },
      );
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      const permitTokenFactory = await SynthereumSyntheticTokenPermitFactory.deployed();
      await finder.changeImplementationAddress(
        tokenFactoryInterface,
        permitTokenFactory.address,
        { from: maintainer },
      );
    });
    it('Can deploy multi pool and synthetic token', async () => {
      await deployerInstance.deployPool(multiPoolVersion, multiPoolPayload, {
        from: maintainer,
      });
      //Chech deploy also for token factory without permit
      const tokenFactory = await SynthereumSyntheticTokenFactory.new(
        synthereumFinderAddress,
      );
      const tokenFactoryInterface = await web3.utils.stringToHex(
        'TokenFactory',
      );
      const finder = await SynthereumFinder.deployed();
      await finder.changeImplementationAddress(
        tokenFactoryInterface,
        tokenFactory.address,
        { from: maintainer },
      );
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      const permitTokenFactory = await SynthereumSyntheticTokenPermitFactory.deployed();
      await finder.changeImplementationAddress(
        tokenFactoryInterface,
        permitTokenFactory.address,
        { from: maintainer },
      );
    });
    it('Can migrate multi pool', async () => {
      const poolAddress = await deployerInstance.deployPool.call(
        multiPoolVersion,
        multiPoolPayload,
        {
          from: maintainer,
        },
      );
      await deployerInstance.deployPool(multiPoolVersion, multiPoolPayload, {
        from: maintainer,
      });
      const migrationPayload = encodeMultiLpLiquidityPoolMigration(
        poolAddress,
        multiPoolVersion,
        '0x',
      );
      await deployerInstance.migratePool(
        poolAddress,
        multiPoolVersion,
        migrationPayload,
        {
          from: maintainer,
        },
      );
    });
    it('Can deploy self-minting derivative', async () => {
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
      const poolInstance = await SynthereumLiquidityPool.at(pool);
      const tokenCurrencyAddress = await poolInstance.syntheticToken.call();
      selfMintingDerivativeVersion = 2;
      selfMintingFee = {
        feePercentage,
        feeRecipients,
        feeProportions,
      };
      const selfMintingPayload = encodeCreditLineDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        tokenCurrencyAddress,
        collateralRequirement,
        minSponsorTokens,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        selfMintingFee,
        liquidationReward,
        capMintAmount,
      );
      await deployerInstance.deploySelfMintingDerivative(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
    });
  });

  describe('Should revert if sender is not the deployer', async () => {
    it('Can revert in synthetic token factory', async () => {
      const synthereumSyntheticTokenFactoryInstance = await SynthereumSyntheticTokenPermitFactory.deployed();
      await truffleAssert.reverts(
        synthereumSyntheticTokenFactoryInstance.createToken(
          'jTest',
          'Test Coin',
          18,
          { from: sender },
        ),
        'Sender must be a Pool or FixedRate factory',
      );
    });
    it('Can revert in pool factory', async () => {
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
    it('Can revert in multi pool factory', async () => {
      const funcSignature = await multiLpPoolFactoryInstance.deploymentSignature();
      const dataPayload =
        funcSignature +
        web3Utils.padRight(ZERO_ADDRESS.replace('0x', ''), '64') +
        multiPoolPayload.replace('0x', '');
      await truffleAssert.reverts(
        web3.eth.sendTransaction({
          from: sender,
          to: multiLpPoolFactoryInstance.address,
          data: dataPayload,
        }),
        'Sender must be Synthereum deployer',
      );
    });
    it('Can revert in self-minting factory', async () => {
      pool = await deployerInstance.deployPool.call(poolVersion, poolPayload, {
        from: maintainer,
      });
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      const poolInstance = await SynthereumLiquidityPool.at(pool);
      const tokenCurrencyAddress = await poolInstance.syntheticToken.call();
      selfMintingDerivativeVersion = 2;
      const funcSignature = await selfMintingFactoryInstance.deploymentSignature();
      const selfMintingPayload = encodeCreditLineDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        tokenCurrencyAddress,
        collateralRequirement,
        minSponsorTokens,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        selfMintingFee,
        liquidationReward,
        capMintAmount,
      );
      const dataPayload =
        funcSignature +
        web3Utils.padRight(ZERO_ADDRESS.replace('0x', ''), '64') +
        selfMintingPayload.replace('0x', '');
      await truffleAssert.reverts(
        web3.eth.sendTransaction({
          from: sender,
          to: selfMintingFactoryInstance.address,
          data: dataPayload,
        }),
        'Sender must be Synthereum deployer',
      );
    });
  });

  describe('Should revert if collateral not whitelisted', async () => {
    it('Can revert in the pool factory', async () => {
      await collateralWhitelistInstance.removeFromWhitelist(collateralAddress, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        deployerInstance.deployPool(poolVersion, poolPayload, {
          from: maintainer,
        }),
        'Collateral not supported',
      );
      await collateralWhitelistInstance.addToWhitelist(collateralAddress, {
        from: maintainer,
      });
    });
    it('Can revert in the multi pool factory', async () => {
      await collateralWhitelistInstance.removeFromWhitelist(collateralAddress, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        deployerInstance.deployPool(multiPoolVersion, multiPoolPayload, {
          from: maintainer,
        }),
        'Collateral not supported',
      );
      await collateralWhitelistInstance.addToWhitelist(collateralAddress, {
        from: maintainer,
      });
    });
    it('Can revert in the self-minting factory', async () => {
      pool = await deployerInstance.deployPool.call(poolVersion, poolPayload, {
        from: maintainer,
      });
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      const poolInstance = await SynthereumLiquidityPool.at(pool);
      const tokenCurrencyAddress = await poolInstance.syntheticToken.call();
      selfMintingDerivativeVersion = 2;
      const selfMintingPayload = encodeCreditLineDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        tokenCurrencyAddress,
        collateralRequirement,
        minSponsorTokens,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        selfMintingFee,
        liquidationReward,
        capMintAmount,
      );
      await collateralWhitelistInstance.removeFromWhitelist(collateralAddress, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        deployerInstance.deploySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          {
            from: maintainer,
          },
        ),
        'Collateral not supported',
      );
      await collateralWhitelistInstance.addToWhitelist(collateralAddress, {
        from: maintainer,
      });
    });
  });

  describe('Should revert if identifier not whitelisted', async () => {
    it('Can revert in the pool factory', async () => {
      await identifierWhitelistInstance.removeFromWhitelist(
        web3.utils.utf8ToHex(priceFeedIdentifier),
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        deployerInstance.deployPool(poolVersion, poolPayload, {
          from: maintainer,
        }),
        'Identifier not supported',
      );
      await identifierWhitelistInstance.addToWhitelist(
        web3.utils.utf8ToHex(priceFeedIdentifier),
        {
          from: maintainer,
        },
      );
    });
    it('Can revert in the multi pool factory', async () => {
      await identifierWhitelistInstance.removeFromWhitelist(
        web3.utils.utf8ToHex(priceFeedIdentifier),
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        deployerInstance.deployPool(multiPoolVersion, multiPoolPayload, {
          from: maintainer,
        }),
        'Identifier not supported',
      );
      await identifierWhitelistInstance.addToWhitelist(
        web3.utils.utf8ToHex(priceFeedIdentifier),
        {
          from: maintainer,
        },
      );
    });
    it('Can revert in the self-minting factory', async () => {
      pool = await deployerInstance.deployPool.call(poolVersion, poolPayload, {
        from: maintainer,
      });
      await deployerInstance.deployPool(poolVersion, poolPayload, {
        from: maintainer,
      });
      const poolInstance = await SynthereumLiquidityPool.at(pool);
      const tokenCurrencyAddress = await poolInstance.syntheticToken.call();
      selfMintingDerivativeVersion = 2;
      const selfMintingPayload = encodeCreditLineDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        tokenCurrencyAddress,
        collateralRequirement,
        minSponsorTokens,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        selfMintingFee,
        liquidationReward,
        capMintAmount,
      );
      await identifierWhitelistInstance.removeFromWhitelist(
        web3.utils.utf8ToHex(priceFeedIdentifier),
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        deployerInstance.deploySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          {
            from: maintainer,
          },
        ),
        'Identifier not supported',
      );
      await identifierWhitelistInstance.addToWhitelist(
        web3.utils.utf8ToHex(priceFeedIdentifier),
        {
          from: maintainer,
        },
      );
    });
  });
});
