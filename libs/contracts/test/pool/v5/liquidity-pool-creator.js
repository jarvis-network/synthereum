const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const TestnetERC20 = artifacts.require('TestnetERC20');
const MintableBurnableSyntheticTokenPermit = artifacts.require(
  'MintableBurnableSyntheticTokenPermit',
);
const SynthereumLiquidityPoolLib = artifacts.require(
  'SynthereumLiquidityPoolLib',
);
const SynthereumLiquidityPoolCreator = artifacts.require(
  'SynthereumLiquidityPoolCreator',
);
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const MockAggregator = artifacts.require('MockAggregator');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);

contract('LiquidityPoolCreator', function (accounts) {
  const synthTokenSymbol = 'jEUR';
  const admin = accounts[0];
  const maintainer = accounts[1];
  const liquidityProvider = accounts[2];
  const DAO = accounts[3];
  const roles = {
    admin,
    maintainer,
    liquidityProvider,
  };
  const sender = accounts[4];
  const overCollateralization = web3Utils.toWei('0.3');
  const feePercentageValue = web3Utils.toWei('0.002');
  const feePercentage = { rawValue: feePercentageValue };
  const feeRecipients = [liquidityProvider, DAO, maintainer];
  const feeProportions = [20, 35, 52];
  const feeData = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  const identifier = 'EURUSD';
  const priceIdentifier = web3Utils.padRight(web3Utils.toHex('EURUSD'), 64);
  const collateralRequirement = web3Utils.toWei('1.20');
  const liquidationReward = web3Utils.toWei('0.85');
  const syntheticName = 'Jarvis Euro Token';
  const syntheticSymbol = 'jEUR';
  describe('Should deploy a new liquidity pool using creator', async () => {
    let version = 5;
    let collateralInstance;
    let collateralToken;
    let synthTokenInstance;
    let syntheticToken;
    let finderInstance;
    let finderAddress;
    let liquidityPoolCreatorInstance;
    let synthereumFactoryVersioning;
    let mockAggregator;
    let synthereumChainlinkPriceFeed;
    before(async () => {
      collateralInstance = await TestnetERC20.new('Test Token', 'USDC', 6);
      collateralToken = collateralInstance.address;
      synthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
        syntheticName,
        synthTokenSymbol,
        18,
        { from: admin },
      );
      syntheticToken = synthTokenInstance.address;
      finderInstance = await SynthereumFinder.deployed();
      finderAddress = finderInstance.address;
      const liquidityPoolLibInstance = await SynthereumLiquidityPoolLib.new();
      await SynthereumLiquidityPoolCreator.link(liquidityPoolLibInstance);
      liquidityPoolCreatorInstance = await SynthereumLiquidityPoolCreator.new(
        finderAddress,
      );
      const factoryInterface = await web3.utils.stringToHex('PoolFactory');
      synthereumFactoryVersioning = await SynthereumFactoryVersioning.deployed();
      await synthereumFactoryVersioning.setFactory(
        factoryInterface,
        version,
        liquidityPoolCreatorInstance.address,
        { from: maintainer },
      );
      mockAggregator = await MockAggregator.new(8, 140000000);
      synthereumChainlinkPriceFeed = await SynthereumChainlinkPriceFeed.deployed();
      await synthereumChainlinkPriceFeed.setAggregator(
        web3.utils.utf8ToHex(identifier),
        mockAggregator.address,
        { from: maintainer },
      );
    });
    it('Can deploy a new liquidity pool with new synthetic token', async () => {
      const params = {
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken: ZERO_ADDRESS,
        roles,
        overCollateralization,
        feeData,
        priceIdentifier,
        collateralRequirement,
        liquidationReward,
        version,
      };
      const poolAddress = await liquidityPoolCreatorInstance.createPool.call(
        params,
      );
      assert.notEqual(
        poolAddress,
        ZERO_ADDRESS,
        'Wrong deployment of liquidity pool',
      );
      const poolCreationTx = await liquidityPoolCreatorInstance.createPool(
        params,
        { from: sender },
      );
      truffleAssert.eventEmitted(poolCreationTx, 'CreatedPool', ev => {
        return (
          ev.poolAddress == poolAddress &&
          ev.version == version &&
          ev.deployerAddress == sender
        );
      });
    });
    it('Can deploy a new liquidity pool with existing synthetic token', async () => {
      const params = {
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken,
        roles,
        overCollateralization,
        feeData,
        priceIdentifier,
        collateralRequirement,
        liquidationReward,
        version,
      };
      const poolAddress = await liquidityPoolCreatorInstance.createPool.call(
        params,
      );
      assert.notEqual(
        poolAddress,
        ZERO_ADDRESS,
        'Wrong deployment of liquidity pool',
      );
      await liquidityPoolCreatorInstance.createPool(params);
    });
    it('Can revert is wrong token name is passed', async () => {
      const wrongName = 'Wrong name';
      const params = {
        collateralToken,
        syntheticName: wrongName,
        syntheticSymbol,
        syntheticToken,
        roles,
        overCollateralization,
        feeData,
        priceIdentifier,
        collateralRequirement,
        liquidationReward,
        version,
      };
      await truffleAssert.reverts(
        liquidityPoolCreatorInstance.createPool(params),
        'Wrong synthetic token name',
      );
    });
    it('Can revert is wrong token symbol is passed', async () => {
      const wrongSymbol = 'Wrong symbol';
      const params = {
        collateralToken,
        syntheticName,
        syntheticSymbol: wrongSymbol,
        syntheticToken,
        roles,
        overCollateralization,
        feeData,
        priceIdentifier,
        collateralRequirement,
        liquidationReward,
        version,
      };
      await truffleAssert.reverts(
        liquidityPoolCreatorInstance.createPool(params),
        'Wrong synthetic token symbol',
      );
    });
    it('Can revert is missing token name', async () => {
      const wrongName = '';
      const params = {
        collateralToken,
        syntheticName: wrongName,
        syntheticSymbol,
        syntheticToken,
        roles,
        overCollateralization,
        feeData,
        priceIdentifier,
        collateralRequirement,
        liquidationReward,
        version,
      };
      await truffleAssert.reverts(
        liquidityPoolCreatorInstance.createPool(params),
        'Missing synthetic name',
      );
    });
    it('Can revert is missing token symbol', async () => {
      const wrongSymbol = '';
      const params = {
        collateralToken,
        syntheticName,
        syntheticSymbol: wrongSymbol,
        syntheticToken,
        roles,
        overCollateralization,
        feeData,
        priceIdentifier,
        collateralRequirement,
        liquidationReward,
        version,
      };
      await truffleAssert.reverts(
        liquidityPoolCreatorInstance.createPool(params),
        'Missing synthetic symbol',
      );
    });
    it('Can revert is zero address is passed as admin', async () => {
      const wrongRoles = {
        admin: ZERO_ADDRESS,
        maintainer,
        liquidityProvider,
      };
      const params = {
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken,
        roles: wrongRoles,
        overCollateralization,
        feeData,
        priceIdentifier,
        collateralRequirement,
        liquidationReward,
        version,
      };
      await truffleAssert.reverts(
        liquidityPoolCreatorInstance.createPool(params),
        'Admin cannot be 0x00',
      );
    });
  });
});
