//helper scripts
const {
  ZERO_ADDRESS,
  RegistryRolesEnum,
} = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
  encodeSelfMintingDerivative,
} = require('../../utils/encoding.js');
const Finder = artifacts.require('Finder');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const Registry = artifacts.require('Registry');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumManager = artifacts.require('SynthereumManager');
const SelfMintingController = artifacts.require('SelfMintingController');
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const TestnetERC20 = artifacts.require('TestnetERC20');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');
const MintableBurnableSyntheticToken = artifacts.require(
  'MintableBurnableSyntheticToken',
);

contract('Self-minting creator', function (accounts) {
  let derivativeVersion = 2;

  // Derivative params
  let collateralAddress;
  let priceFeedIdentifier = 'EUR/USD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let syntheticSymbol = 'jEUR';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let collateralRequirement = web3Utils.toWei('1.1');
  let disputeBondPct = web3Utils.toWei('1.5');
  let sponsorDisputeRewardPct = web3Utils.toWei('0.5');
  let disputerDisputeRewardPct = web3Utils.toWei('0.4');
  let minSponsorTokens = web3Utils.toWei('1');
  let withdrawalLiveness = 3600;
  let liquidationLiveness = 3600;
  let excessBeneficiary = accounts[4];
  let derivativeAdmins;
  let derivativePools;

  //Pool params
  let derivativeAddress = ZERO_ADDRESS;
  let synthereumFinderAddress;
  let manager;
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let validator = accounts[3];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
    validator,
  };
  let isContractAllowed = false;
  let startingCollateralization = '1586700';
  let feePercentage = 0.02;
  let DAO = accounts[5];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  let feeRecipient = DAO;
  let daoFee = {
    feePercentage,
    feeRecipient,
  };
  let capMintAmount = web3Utils.toWei('1000000');
  let capDepositRatio = 700;
  //Other params
  let firstWrongAddress = accounts[6];
  let secondWrongAddress = accounts[7];
  let derivativePayload;
  let poolPayload;
  let synthTokenAddress;
  let selfMintingDerivativeVersion;
  let selfMintingCollateralAddress;
  let selfMintingPriceFeedIdentifier;
  let selfMintingPayload;

  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 4;
    synthereumFinderAddress = (await SynthereumFinder.deployed()).address;
    manager = (await SynthereumManager.deployed()).address;
    selfMintingControllerInstanceAddr = (await SelfMintingController.deployed())
      .address;
    derivativePayload = encodeDerivative(
      collateralAddress,
      priceFeedIdentifier,
      syntheticName,
      syntheticSymbol,
      syntheticTokenAddress,
      collateralRequirement,
      disputeBondPct,
      sponsorDisputeRewardPct,
      disputerDisputeRewardPct,
      minSponsorTokens,
      withdrawalLiveness,
      liquidationLiveness,
      excessBeneficiary,
      derivativeAdmins,
      derivativePools,
    );
    poolPayload = encodePoolOnChainPriceFeed(
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      roles,
      isContractAllowed,
      startingCollateralization,
      fee,
    );
    const {
      derivative,
      pool,
    } = await deployerInstance.deployPoolAndDerivative.call(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    await deployerInstance.deployPoolAndDerivative(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    const derivativeInstance = await PerpetualPoolParty.at(derivative);
    synthTokenAddress = await derivativeInstance.tokenCurrency.call();
    selfMintingDerivativeVersion = 1;
    selfMintingCollateralAddress = (await TestnetSelfMintingERC20.deployed())
      .address;
    selfMintingPriceFeedIdentifier = 'EUR/JRT';
  });
  describe('Deploy self-minting derivative', async () => {
    it('Can deploy', async () => {
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
        daoFee,
        capMintAmount,
        capDepositRatio,
      );
      await deployerInstance.deployOnlySelfMintingDerivative(
        selfMintingDerivativeVersion,
        selfMintingPayload,
        { from: maintainer },
      );
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
