const web3Utils = require('web3-utils');
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
    liquidityPoolLibInstance = await SynthereumLiquidityPoolLib.new();
    await SynthereumLiquidityPool.link(liquidityPoolLibInstance);
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
  });
});
