//helper scripts
const {
  ZERO_ADDRESS,
  RegistryRolesEnum,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toWei, hexToUtf8, toBN, utf8ToHex } = web3Utils;
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
  encodeCreditLineDerivative,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const { factory } = require('typescript');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumRegistry = artifacts.require('SynthereumRegistry');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumManager = artifacts.require('SynthereumManager');
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const TestnetERC20 = artifacts.require('TestnetERC20');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const MockAggregator = artifacts.require('MockAggregator');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const CreditLineCreator = artifacts.require('CreditLineCreator');
const CreditLineLib = artifacts.require('CreditLineLib');

contract('Self-minting creator', function (accounts) {
  let version = 2;

  // Derivative params
  let collateralAddress;
  const priceFeedIdentifier = web3.utils.padRight(utf8ToHex('EURUSD'), 64);
  let syntheticName = 'Jarvis Synthetic Euro';
  let syntheticSymbol = 'jEUR';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let minSponsorTokens = toWei('1');
  let excessBeneficiary = accounts[4];

  let capMintAmount = toWei('1000000');
  let liquidationRewardPct = toWei('0.2');
  let collateralRequirement = toWei('1.2');
  let feePercentage = toWei('0.002');

  let admin = accounts[0];
  let roles = {
    admin: accounts[0],
    maintainer: accounts[1],
  };
  let feeRecipient = accounts[3];
  let Fee = {
    feePercentage: { rawValue: feePercentage },
    feeRecipients: [feeRecipient],
    feeProportions: [1],
    totalFeeProportions: 1,
  };

  let synthereumFinderAddress;
  let manager;

  //Other params
  let synthTokenAddress;
  let selfMintingDerivativeVersion;
  let selfMintingCollateralAddress;
  let selfMintingPriceFeedIdentifier;
  let selfMintingPayload;
  let deployer;
  before(async () => {
    deployer = await SynthereumDeployer.deployed();
    collateral = await TestnetSelfMintingERC20.new('USDC', 'USDC', 18);
    collateralAddress = collateral.address;
    syntheticToken = await SyntheticToken.new(
      syntheticName,
      syntheticSymbol,
      18,
      {
        from: admin,
      },
    );

    syntheticTokenAddress = syntheticToken.address;
    finder = await SynthereumFinder.deployed();
    synthereumFinderAddress = finder.address;
    const creditLineLib = await CreditLineLib.new();
    await CreditLineCreator.link(creditLineLib);
    creditLineCreatorInstance = await CreditLineCreator.new(
      synthereumFinderAddress,
    );

    manager = (await SynthereumManager.deployed()).address;
    const factoryInterface = await web3.utils.stringToHex('CreditLineFactory');
    synthereumFactoryVersioning = await SynthereumFactoryVersioning.deployed();
    await synthereumFactoryVersioning.setFactory(
      factoryInterface,
      version,
      creditLineCreatorInstance.address,
      { from: roles.maintainer },
    );
    mockAggregator = await MockAggregator.new(8, 140000000);
    synthereumChainlinkPriceFeed = await SynthereumChainlinkPriceFeed.deployed();
    await synthereumChainlinkPriceFeed.setAggregator(
      priceFeedIdentifier,
      mockAggregator.address,
      { from: roles.maintainer },
    );
  });
  describe('Deploy self-minting derivative', async () => {
    it('Can deploy', async () => {
      const params = {
        collateralToken: collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        syntheticToken: syntheticTokenAddress,
        collateralRequirement,
        excessTokenBeneficiary: excessBeneficiary,
        fee: Fee,
        liquidationPercentage: liquidationRewardPct,
        capMintAmount,
        minSponsorTokens: { rawValue: minSponsorTokens },
        version: 2,
      };

      await creditLineCreatorInstance.createSelfMintingDerivative(params, {
        from: roles.maintainer,
      });
    });
  });
  describe('Revert conditions', async () => {
    it('Revert if no token name is passed', async () => {
      const wrongSyntName = '';
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        wrongSyntName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Missing synthetic name',
      );
    });
    it('Revert if no token symbol is passed', async () => {
      const wrongSyntSymbol = '';
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        wrongSyntSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Missing synthetic symbol',
      );
    });
    it('Revert if no synthetic asset is passed', async () => {
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        ZERO_ADDRESS,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Synthetic token address cannot be 0x00',
      );
    });
    it('Revert if wrong token name is passed', async () => {
      const wrongSyntName = 'EUR wrong coin';
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        wrongSyntName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Wrong synthetic token name',
      );
    });
    it('Revert if wrong token symbol is passed', async () => {
      const wrongSyntSymbol = 'jCHF';
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        wrongSyntSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Wrong synthetic token symbol',
      );
    });

    it('Revert if token with no 18 decimals is passed', async () => {
      const wrongDecimalsContract = await MintableBurnableSyntheticToken.new(
        syntheticName,
        syntheticSymbol,
        8,
      );
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        wrongDecimalsContract.address,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Decimals of synthetic token must be 18',
      );
    });
    it('Revert if null withdrawal liveness is passed', async () => {
      const wrongWithdrawalLiveness = 0;
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        wrongWithdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Withdrawal liveness cannot be 0',
      );
    });
    it('Revert if null liquidation liveness is passed', async () => {
      const wrongLiquidationLiveness = 0;
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        wrongLiquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Liquidation liveness cannot be 0',
      );
    });
    it('Revert if excess token beneficiary can not be zero address', async () => {
      const wrongExcessTokenBeneficiary = ZERO_ADDRESS;
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        wrongExcessTokenBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Token Beneficiary cannot be 0x00',
      );
    });
    it('Revert if fee recipient is zero address', async () => {
      const wrongDaoFeeRecipient = ZERO_ADDRESS;
      const wrongDaoFee = {
        feePercentage,
        feeRecipient: wrongDaoFeeRecipient,
      };
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        wrongDaoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Fee recipient cannot be 0x00',
      );
    });
    it('Revert if withdrawal liveness more than 5200 weeks is passed', async () => {
      const wrongWithdrawalLiveness = 3144960001;
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        wrongWithdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Withdrawal liveness too large',
      );
    });
    it('Revert if liquidation liveness more than 5200 weeks is passed', async () => {
      const wrongLiquidationLiveness = 3144960001;
      selfMintingPayload = encodeSelfMintingDerivative(
        selfMintingCollateralAddress,
        selfMintingPriceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        wrongLiquidationLiveness,
        excessBeneficiary,
        selfMintingDerivativeVersion,
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await truffleAssert.reverts(
        deployerInstance.deployOnlySelfMintingDerivative(
          selfMintingDerivativeVersion,
          selfMintingPayload,
          { from: maintainer },
        ),
        'Liquidation liveness too large',
      );
    });
  });
});
