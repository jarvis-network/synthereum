const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const ERC20 = artifacts.require('ERC20');
const MintableBurnableSyntheticTokenPermit = artifacts.require(
  'MintableBurnableSyntheticTokenPermit',
);
const SynthereumMultiLpLiquidityPoolMainLib = artifacts.require(
  'SynthereumMultiLpLiquidityPoolMainLib',
);
const SynthereumMultiLpLiquidityPoolMigrationLib = artifacts.require(
  'SynthereumMultiLpLiquidityPoolMigrationLib',
);
const SynthereumMultiLpLiquidityPool = artifacts.require(
  'SynthereumMultiLpLiquidityPool',
);
const SynthereumMultiLpLiquidityPoolCreator = artifacts.require(
  'SynthereumMultiLpLiquidityPoolCreator',
);
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const MockAggregator = artifacts.require('MockAggregator');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const PoolV6Data = require('../../../data/test/poolV6.json');

contract('LiquidityPoolCreator', function (accounts) {
  const synthTokenSymbol = 'jEUR';
  const admin = accounts[0];
  const maintainer = accounts[1];
  const roles = {
    admin,
    maintainer,
  };
  const sender = accounts[4];
  const feePercentage = '0.0015';
  const fee = web3.utils.toWei(feePercentage);
  const overCollateralRequirement = web3.utils.toWei('0.05');
  const liquidationReward = web3.utils.toWei('0.7');
  const lendingId = 'AaveV3';
  const daoInterestShare = web3.utils.toWei('0.1');
  const jrtBuybackShare = web3.utils.toWei('0.6');
  const identifier = 'EURUSD';
  const priceIdentifier = web3Utils.padRight(web3Utils.toHex(identifier), 64);
  const syntheticName = 'Jarvis Euro Token';
  const syntheticSymbol = 'jEUR';
  describe('Should deploy a new liquidity pool using creator', async () => {
    let version = 6;
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
      networkId = await web3.eth.net.getId();
      collateralInstance = await ERC20.at(PoolV6Data[networkId].collateral);
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
      const multiLpLiquidityPoolMainLibInstance = await SynthereumMultiLpLiquidityPoolMainLib.new();
      await SynthereumMultiLpLiquidityPool.link(
        multiLpLiquidityPoolMainLibInstance,
      );
      const multiLpLiquidityPoolMigrationLibInstance = await SynthereumMultiLpLiquidityPoolMigrationLib.new();
      await SynthereumMultiLpLiquidityPool.link(
        multiLpLiquidityPoolMigrationLibInstance,
      );
      const multiLpLiquidityPoolLibInstance = await SynthereumMultiLpLiquidityPool.new();
      liquidityPoolCreatorInstance = await SynthereumMultiLpLiquidityPoolCreator.new(
        finderAddress,
        multiLpLiquidityPoolLibInstance.address,
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
      await synthereumChainlinkPriceFeed.setPair(
        0,
        web3.utils.utf8ToHex(identifier),
        mockAggregator.address,
        [],
        { from: maintainer },
      );
    });
    it('Can deploy a new liquidity pool with new synthetic token', async () => {
      const lendingManagerParams = {
        lendingId,
        interestBearingToken: ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      };
      const params = {
        version,
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken: ZERO_ADDRESS,
        roles,
        fee,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingManagerParams,
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
    });
    it('Can deploy a new liquidity pool with existing synthetic token', async () => {
      const lendingManagerParams = {
        lendingId,
        interestBearingToken: ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      };
      const params = {
        version,
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken,
        roles,
        fee,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingManagerParams,
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
      const lendingManagerParams = {
        lendingId,
        interestBearingToken: ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      };
      const params = {
        version,
        collateralToken,
        syntheticName: wrongName,
        syntheticSymbol,
        syntheticToken,
        roles,
        fee,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingManagerParams,
      };
      await truffleAssert.reverts(
        liquidityPoolCreatorInstance.createPool(params),
        'Wrong synthetic token name',
      );
    });
    it('Can revert is wrong token symbol is passed', async () => {
      const wrongSymbol = 'Wrong symbol';
      const lendingManagerParams = {
        lendingId,
        interestBearingToken: ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      };
      const params = {
        version,
        collateralToken,
        syntheticName,
        syntheticSymbol: wrongSymbol,
        syntheticToken,
        roles,
        fee,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingManagerParams,
      };
      await truffleAssert.reverts(
        liquidityPoolCreatorInstance.createPool(params),
        'Wrong synthetic token symbol',
      );
    });
    it('Can revert is missing token name', async () => {
      const wrongName = '';
      const lendingManagerParams = {
        lendingId,
        interestBearingToken: ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      };
      const params = {
        version,
        collateralToken,
        syntheticName: wrongName,
        syntheticSymbol,
        syntheticToken,
        roles,
        fee,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingManagerParams,
      };
      await truffleAssert.reverts(
        liquidityPoolCreatorInstance.createPool(params),
        'Missing synthetic name',
      );
    });
    it('Can revert is missing token symbol', async () => {
      const wrongSymbol = '';
      const lendingManagerParams = {
        lendingId,
        interestBearingToken: ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      };
      const params = {
        version,
        collateralToken,
        syntheticName,
        syntheticSymbol: wrongSymbol,
        syntheticToken,
        roles,
        fee,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingManagerParams,
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
      };
      const lendingManagerParams = {
        lendingId,
        interestBearingToken: ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      };
      const params = {
        version,
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken,
        roles: wrongRoles,
        fee,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingManagerParams,
      };
      await truffleAssert.reverts(
        liquidityPoolCreatorInstance.createPool(params),
        'Admin cannot be 0x00',
      );
    });
    it('Can migrate storage to a new pool', async () => {
      const lendingManagerParams = {
        lendingId,
        interestBearingToken: ZERO_ADDRESS,
        daoInterestShare,
        jrtBuybackShare,
      };
      const params = {
        version,
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken: ZERO_ADDRESS,
        roles,
        fee,
        priceIdentifier,
        overCollateralRequirement,
        liquidationReward,
        lendingManagerParams,
      };
      const poolAddress = await liquidityPoolCreatorInstance.createPool.call(
        params,
      );
      await liquidityPoolCreatorInstance.createPool(params, { from: sender });
    });
  });
});
