//helper scripts
const {
  ZERO_ADDRESS,
  RegistryRolesEnum,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toWei, hexToUtf8, toBN, utf8ToHex } = web3Utils;

const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumManager = artifacts.require('SynthereumManager');
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);

const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const MockAggregator = artifacts.require('MockAggregator');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const CreditLineCreator = artifacts.require('CreditLineCreator');
const CreditLine = artifacts.require('CreditLine');
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
    feePercentage,
    feeRecipients: [feeRecipient],
    feeProportions: [1],
    totalFeeProportions: 1,
  };

  let synthereumFinderAddress;
  let manager;

  //Other params
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
    // await CreditLineCreator.link(creditLineLib);
    await CreditLine.link(creditLineLib);
    const creditLineImpl = await CreditLine.new();
    creditLineCreatorInstance = await CreditLineCreator.new(
      synthereumFinderAddress,
      creditLineImpl.address,
    );

    manager = (await SynthereumManager.deployed()).address;
    const factoryInterface = await web3.utils.stringToHex('SelfMintingFactory');
    synthereumFactoryVersioning = await SynthereumFactoryVersioning.deployed();
    await synthereumFactoryVersioning.setFactory(
      factoryInterface,
      version,
      creditLineCreatorInstance.address,
      { from: roles.maintainer },
    );
    mockAggregator = await MockAggregator.new(8, 140000000);
    synthereumChainlinkPriceFeed = await SynthereumChainlinkPriceFeed.deployed();
    await synthereumChainlinkPriceFeed.setPair(
      0,
      priceFeedIdentifier,
      mockAggregator.address,
      [],
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
      const params = {
        collateralToken: collateralAddress,
        priceFeedIdentifier,
        syntheticName: wrongSyntName,
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
      await truffleAssert.reverts(
        creditLineCreatorInstance.createSelfMintingDerivative(params, {
          from: roles.maintainer,
        }),
        'Missing synthetic name',
      );
    });
    it('Revert if no token symbol is passed', async () => {
      const wrongSyntSymbol = '';
      const params = {
        collateralToken: collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol: wrongSyntSymbol,
        syntheticToken: syntheticTokenAddress,
        collateralRequirement,
        excessTokenBeneficiary: excessBeneficiary,
        fee: Fee,
        liquidationPercentage: liquidationRewardPct,
        capMintAmount,
        minSponsorTokens: { rawValue: minSponsorTokens },
        version: 2,
      };
      await truffleAssert.reverts(
        creditLineCreatorInstance.createSelfMintingDerivative(params, {
          from: roles.maintainer,
        }),
        'Missing synthetic symbol',
      );
    });
    it('Revert if no synthetic asset is passed', async () => {
      const params = {
        collateralToken: collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        syntheticToken: ZERO_ADDRESS,
        collateralRequirement,
        excessTokenBeneficiary: excessBeneficiary,
        fee: Fee,
        liquidationPercentage: liquidationRewardPct,
        capMintAmount,
        minSponsorTokens: { rawValue: minSponsorTokens },
        version: 2,
      };
      await truffleAssert.reverts(
        creditLineCreatorInstance.createSelfMintingDerivative(params, {
          from: roles.maintainer,
        }),
        'Synthetic token address cannot be 0x00',
      );
    });
    it('Revert if wrong token name is passed', async () => {
      const wrongSyntName = 'EUR wrong coin';
      const params = {
        collateralToken: collateralAddress,
        priceFeedIdentifier,
        syntheticName: wrongSyntName,
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
      await truffleAssert.reverts(
        creditLineCreatorInstance.createSelfMintingDerivative(params, {
          from: roles.maintainer,
        }),
        'Wrong synthetic token name',
      );
    });
    it('Revert if wrong token symbol is passed', async () => {
      const wrongSyntSymbol = 'jCHF';
      const params = {
        collateralToken: collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol: wrongSyntSymbol,
        syntheticToken: syntheticTokenAddress,
        collateralRequirement,
        excessTokenBeneficiary: excessBeneficiary,
        fee: Fee,
        liquidationPercentage: liquidationRewardPct,
        capMintAmount,
        minSponsorTokens: { rawValue: minSponsorTokens },
        version: 2,
      };
      await truffleAssert.reverts(
        creditLineCreatorInstance.createSelfMintingDerivative(params, {
          from: roles.maintainer,
        }),
        'Wrong synthetic token symbol',
      );
    });

    it('Revert if token with no 18 decimals is passed', async () => {
      const wrongDecimalsContract = await SyntheticToken.new(
        syntheticName,
        syntheticSymbol,
        8,
      );
      const params = {
        collateralToken: collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        syntheticToken: wrongDecimalsContract.address,
        collateralRequirement,
        excessTokenBeneficiary: excessBeneficiary,
        fee: Fee,
        liquidationPercentage: liquidationRewardPct,
        capMintAmount,
        minSponsorTokens: { rawValue: minSponsorTokens },
        version: 2,
      };
      await truffleAssert.reverts(
        creditLineCreatorInstance.createSelfMintingDerivative(params, {
          from: roles.maintainer,
        }),
        'Synthetic token has more or less than 18 decimals',
      );
    });

    it('Revert if excess token beneficiary can not be zero address', async () => {
      const wrongExcessTokenBeneficiary = ZERO_ADDRESS;
      const params = {
        collateralToken: collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        syntheticToken: syntheticTokenAddress,
        collateralRequirement,
        excessTokenBeneficiary: wrongExcessTokenBeneficiary,
        fee: Fee,
        liquidationPercentage: liquidationRewardPct,
        capMintAmount,
        minSponsorTokens: { rawValue: minSponsorTokens },
        version: 2,
      };
      await truffleAssert.reverts(
        creditLineCreatorInstance.createSelfMintingDerivative(params, {
          from: roles.maintainer,
        }),
        'Token Beneficiary cannot be 0x00',
      );
    });
  });
});
