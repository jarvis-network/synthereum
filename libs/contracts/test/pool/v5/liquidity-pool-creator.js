const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const web3Utils = require('web3-utils');
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

contract('LiquidityPoolCreator', function (accounts) {
  describe('Can deploy a new liquidity pool', async () => {
    it('Can deploy a new liquidity pool using creator', async () => {
      const version = 5;
      const collateralInstance = await TestnetERC20.deployed();
      const collateralAddress = collateralInstance.address;
      const synthTokenSymbol = 'jEUR';
      const admin = accounts[0];
      const maintainer = accounts[1];
      const liquidityProvider = accounts[2];
      const DAO = accounts[3];
      const synthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        synthTokenSymbol,
        18,
        { from: admin },
      );
      const synthTokenAddress = synthTokenInstance.address;
      const finderInstance = await SynthereumFinder.deployed();
      const finderAddress = finderInstance.address;
      const roles = {
        admin,
        maintainer,
        liquidityProvider,
      };
      const overCollateralization = web3Utils.toWei('0.3');
      const feePercentageValue = web3Utils.toWei('0.002');
      const feePercentage = { rawValue: feePercentageValue };
      const feeRecipients = [liquidityProvider, DAO, maintainer];
      const feeProportions = [20, 35, 52];
      const fee = {
        feePercentage,
        feeRecipients,
        feeProportions,
      };
      const priceFeedIdentifier = web3Utils.padRight(
        web3Utils.toHex('EUR/USD'),
        64,
      );
      const collateralRequirement = web3Utils.toWei('1.20');
      const liquidationReward = web3Utils.toWei('0.85');
      const liquidityPoolLibInstance = await SynthereumLiquidityPoolLib.new();
      await SynthereumLiquidityPoolCreator.link(liquidityPoolLibInstance);
      const liquidityPoolCreatorInstance = await SynthereumLiquidityPoolCreator.new();
      const poolAddress = await liquidityPoolCreatorInstance.createPool.call(
        finderAddress,
        version,
        collateralAddress,
        synthTokenAddress,
        roles,
        overCollateralization,
        fee,
        priceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      );
      assert.notEqual(
        poolAddress,
        ZERO_ADDRESS,
        'Wrong deployment of liquidity pool',
      );
      await liquidityPoolCreatorInstance.createPool(
        finderAddress,
        version,
        collateralAddress,
        synthTokenAddress,
        roles,
        overCollateralization,
        fee,
        priceFeedIdentifier,
        collateralRequirement,
        liquidationReward,
      );
    });
  });
});
