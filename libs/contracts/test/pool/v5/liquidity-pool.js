const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const TestnetERC20 = artifacts.require('TestnetERC20');
const MintableBurnableSyntheticTokenPermit = artifacts.require(
  'MintableBurnableSyntheticTokenPermit',
);
const SynthereumLiquidityPool = artifacts.require('SynthereumLiquidityPool');
const SynthereumLiquidityPoolLib = artifacts.require(
  'SynthereumLiquidityPoolLib',
);

contract('LiquidityPool', function (accounts) {
  let collateralInstance;
  let collateralAddress;
  let synthTokenInstance;
  let synthTokenAddress;
  let finderInstance;
  let finderAddress;
  let liquidityPoolLibInstance;
  let liquidityPoolInstance;
  const version = 5;
  const admin = accounts[0];
  const maintainer = accounts[1];
  const liquidityProvider = accounts[2];
  const DAO = accounts[3];
  const roles = {
    admin,
    maintainer,
    liquidityProvider,
  };
  const overCollateralization = web3Utils.toWei('0.25');
  const feePercentageValue = web3Utils.toWei('0.002');
  const feePercentage = { rawValue: feePercentageValue };
  const feeRecipients = [liquidityProvider, DAO];
  const feeProportions = [50, 50];
  const feeTotalProportion = 100;
  const fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  const priceFeedIdentifier = web3Utils.padRight(
    web3Utils.toHex('EUR/USD'),
    64,
  );
  const collateralRequirement = web3Utils.toWei('1.05');
  const liquidationReward = web3Utils.toWei('0.75');
  const synthTokenSymbol = 'jEUR';

  before(async () => {
    liquidityPoolLibInstance = await SynthereumLiquidityPoolLib.new();
    await SynthereumLiquidityPool.link(liquidityPoolLibInstance);
  });

  beforeEach(async () => {
    collateralInstance = await TestnetERC20.deployed();
    collateralAddress = collateralInstance.address;
    synthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
      'Jarvis Synthetic Euro',
      synthTokenSymbol,
      18,
      { from: admin },
    );
    synthTokenAddress = synthTokenInstance.address;
    finderInstance = await SynthereumFinder.deployed();
    finderAddress = finderInstance.address;
    liquidityPoolInstance = await SynthereumLiquidityPool.new(
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

  describe('Should initialize in the constructor', async () => {
    it('Can initialize variables in the correct way', async () => {
      assert.equal(
        await liquidityPoolInstance.synthereumFinder(),
        finderAddress,
        'Wrong finder initialization',
      );
      assert.equal(
        await liquidityPoolInstance.version(),
        version,
        'Wrong version initialization',
      );
      assert.equal(
        await liquidityPoolInstance.collateralToken(),
        collateralAddress,
        'Wrong collateral initialization',
      );
      assert.equal(
        await liquidityPoolInstance.syntheticToken(),
        synthTokenAddress,
        'Wrong synthetic token initialization',
      );
      assert.equal(
        await liquidityPoolInstance.syntheticTokenSymbol(),
        synthTokenSymbol,
        'Wrong synthetic token symbol',
      );
      assert.equal(
        await liquidityPoolInstance.overCollateralization(),
        overCollateralization,
        'Wrong over-collateralization initialization',
      );
      assert.equal(
        await liquidityPoolInstance.getPriceFeedIdentifier(),
        priceFeedIdentifier,
        'Wrong price feed identifier initialization',
      );
      assert.equal(
        await liquidityPoolInstance.collateralRequirement(),
        collateralRequirement,
        'Wrong collateral requirement initialization',
      );
      assert.equal(
        await liquidityPoolInstance.liquidationReward(),
        liquidationReward,
        'Wrong liquidation reward initialization',
      );
      assert.equal(
        await liquidityPoolInstance.feePercentage(),
        feePercentageValue,
        'Wrong fee percentage initialization',
      );
      const feeInfo = await liquidityPoolInstance.feeRecipientsInfo();
      assert.deepEqual(
        feeInfo[0],
        feeRecipients,
        'Wrong fee recipients initialization',
      );
      assert.deepEqual(
        feeInfo[1].map(fee => parseInt(fee.toString())),
        feeProportions,
        'Wrong fee proportions initialization',
      );
      assert.equal(
        feeInfo[2].toString(),
        web3Utils.toBN(feeTotalProportion).toString(),
        'Wrong fee total proportion initialization',
      );
    });
    it('Can revert if collateral requirement is less than 100% ', async () => {
      const wrongCollateralRequirement = web3Utils.toWei('0.999');
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          wrongCollateralRequirement,
          liquidationReward,
        ),
        'Collateral requirement must be bigger than 100%',
      );
    });
    it('Can revert if overCollateralization is less then Lp part of the collateral', async () => {
      const wrongOverCollateralization = web3Utils.toWei('0.03');
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          wrongOverCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Overcollateralization must be bigger than the Lp part of the collateral requirement',
      );
    });
    it('Can revert if liquidation reward is 0', async () => {
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          0,
        ),
        'Liquidation reward must be between 0 and 100%',
      );
    });
    it('Can revert if liquidation reward is bigger than 100%', async () => {
      const wrongLiquidationReward = web3Utils.toWei('1.01');
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          wrongLiquidationReward,
        ),
        'Liquidation reward must be between 0 and 100%',
      );
    });
    it('Can revert if collateral has more than 18 decimals', async () => {
      const wrongCollateralToken = await TestnetERC20.new(
        'Test token',
        'TEST',
        20,
      );
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          wrongCollateralToken.address,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Collateral has more than 18 decimals',
      );
    });
    it('Can revert if synthetic token has more or less than 18 decimals', async () => {
      let wrongSynthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        synthTokenSymbol,
        16,
        { from: admin },
      );
      let wrongSynthTokenAddress = wrongSynthTokenInstance.address;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          wrongSynthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Synthetic token has more or less than 18 decimals',
      );
      wrongSynthTokenInstance = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        synthTokenSymbol,
        20,
        { from: admin },
      );
      wrongSynthTokenAddress = wrongSynthTokenInstance.address;
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          wrongSynthTokenAddress,
          roles,
          overCollateralization,
          fee,
          priceFeedIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Synthetic token has more or less than 18 decimals',
      );
    });
    it('Can revert if price identifier is not supported by the the price feed', async () => {
      const wrongPriceIdentifier = web3Utils.padRight(
        web3Utils.toHex('EUR/NOT-USD'),
        64,
      );
      await truffleAssert.reverts(
        SynthereumLiquidityPool.new(
          finderAddress,
          version,
          collateralAddress,
          synthTokenAddress,
          roles,
          overCollateralization,
          fee,
          wrongPriceIdentifier,
          collateralRequirement,
          liquidationReward,
        ),
        'Price identifier not supported',
      );
    });
  });
});
