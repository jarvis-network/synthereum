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
const SynthereumTrustedForwarder = artifacts.require(
  'SynthereumTrustedForwarder',
);

contract('Deployer', function (accounts) {
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
  let selfMintingFee;
  let capMintAmount = web3Utils.toWei('1000000');
  let firstWrongAddress = accounts[6];
  let poolPayload;
  let collateralWhitelistInstance;
  let identifierWhitelistInstance;
  let factoryVersioningInstance;
  let mockAggregator;
  let synthereumChainlinkPriceFeed;
  let tokenFactory;
  let forwarderInstance;

  before(async () => {
    collateralAddress = (await TestnetERC20.new('Testnet token', 'USDC', 6))
      .address;
    mockAggregator = await MockAggregator.new(8, 120000000);
    synthereumChainlinkPriceFeed = await SynthereumChainlinkPriceFeed.deployed();
    await synthereumChainlinkPriceFeed.setAggregator(
      web3.utils.utf8ToHex(priceFeedIdentifier),
      mockAggregator.address,
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
    forwarderInstance = await SynthereumTrustedForwarder.deployed();
  });
  beforeEach(async () => {
    deployerInstance = await SynthereumDeployer.deployed();
    poolVersion = 5;
    finderInstance = await SynthereumFinder.deployed();
    synthereumFinderAddress = finderInstance.address;
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

  describe('Should Deploy pool', () => {
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
        return ev.poolVersion == 5 && ev.newPool == pool;
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
      const secondPoolPayload = encodeLiquidityPool(
        collateralAddress,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
        roles,
        overCollateralization,
        fee,
        priceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
        poolVersion,
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
      const synthereumLiquidityPoolLib = await SynthereumLiquidityPoolLib.deployed();
      await SynthereumLiquidityPoolFactory.link(synthereumLiquidityPoolLib);
      const wrongFactory = await SynthereumLiquidityPoolFactory.new(
        newFinder.address,
      );
      await factoryVersioningInstance.setFactory(
        web3.utils.stringToHex('PoolFactory'),
        5,
        wrongFactory.address,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        deployerInstance.deployPool(poolVersion, poolPayload, {
          from: maintainer,
        }),
        'Wrong finder in deployment',
      );
      await factoryVersioningInstance.setFactory(
        web3.utils.stringToHex('PoolFactory'),
        5,
        (await SynthereumLiquidityPoolFactory.deployed()).address,
        { from: maintainer },
      );
    });
    it('Can revert if pool version is different from the one using in the deployemnt', async () => {
      const wrongPoolVersion = 6;
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
        wrongPoolVersion,
      );
      await truffleAssert.reverts(
        deployerInstance.deployPool(poolVersion, poolPayload, {
          from: maintainer,
        }),
        'Wrong version in deployment',
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
      await synthereumChainlinkPriceFeed.setAggregator(
        web3.utils.utf8ToHex(selfMintingPriceFeedIdentifier),
        mockAggregator.address,
        { from: maintainer },
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
        syntheticSymbol,
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
      const selfMintingDerivative = await deployerInstance.deploySelfMintingDerivative.call(
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
      const creditLinelLib = await CreditLineLib.deployed();
      await CreditLineFactory.link(creditLinelLib);
      const wrongFactory = await CreditLineFactory.new(newFinder.address);
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
        (await CreditLineFactory.deployed()).address,
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
        syntheticSymbol,
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
        (await CreditLineController.deployed()).address,
        { from: maintainer },
      );
    });
  });
});
