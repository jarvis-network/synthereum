//helper scripts
const { interfaceName } = require('@jarvis-network/uma-common');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const ethers = require('ethers');
const { encodeDerivative, encodePool } = require('../utils/encoding.js');
const {
  generateMintSignature,
  generateRedeemSignature,
  generateExchangeSignature,
} = require('../utils/metasignature.js');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const TestnetERC20 = artifacts.require('TestnetERC20');
const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');
const SynthereumPool = artifacts.require('SynthereumPool');
const MintableBurnableERC20 = artifacts.require('MintableBurnableERC20');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
const SynthereumPoolLib = artifacts.require('SynthereumPoolLib');
const SynthereumSyntheticTokenFactory = artifacts.require(
  'SynthereumSyntheticTokenFactory',
);
const SynthereumDerivativeFactory = artifacts.require(
  'SynthereumDerivativeFactory',
);
const SynthereumPoolFactory = artifacts.require('SynthereumPoolFactory');
const Timer = artifacts.require('Timer');
const MockOracle = artifacts.require('MockOracle');
const UmaFinder = artifacts.require('Finder');
const ContractAllowed = artifacts.require('ContractAllowed');

contract('Factories', function (accounts) {
  let derivativeVersion = 1;

  // Derivative params
  let collateralAddress;
  let priceFeedIdentifier = 'EUR/USD';
  let secondPriceFeedIdentifier = 'GBP/USD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let secondSyntheticName = 'Jarvis Synthetic British Pound';
  let syntheticSymbol = 'jEUR';
  let secondSyntheticSymbol = 'jGBP';
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
  let startingCollateralization = '1500000';
  let secondStartingCollateralization = '1700000';
  let feePercentage = '0.002';
  let feePercentageWei;
  let DAO = accounts[5];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  //Addresses
  let poolAddress;
  let synthTokenAddr;
  //Other params
  let sender = accounts[6];
  let secondSender = accounts[7];
  let wrongSender = accounts[8];
  let wrongDerivativeAddr = accounts[9];
  let newAdmin = accounts[10];
  let derivativePayload;
  let poolPayload;
  let collateralInstance;
  let poolStartingDeposit = web3Utils.toWei('1000', 'mwei');
  let poolInstance;
  let derivativeInstance;
  let synthTokenInstance;
  //MetaSig params
  //We suppose a starting rate of 1 jEur = 1.2 USDC (EUR/USD = 1.2)
  let collateralAmount = web3Utils.toWei('120', 'mwei');
  let feeAmount = web3Utils.toWei((120 * feePercentage).toString(), 'mwei');
  let totCollAmount = (
    parseInt(collateralAmount) + parseInt(feeAmount)
  ).toString();
  let numTokens;
  let nonce;
  let networkId;
  let version;
  let expiration;
  const mnemonic =
    'test test test test test test test test test test test junk';
  const path = "m/44'/60'/0'/0/3";
  const wallet = ethers.Wallet.fromMnemonic(mnemonic, path);
  let validatorPrivKey = wallet.privateKey.replace('0x', '');
  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 2;
    feePercentageWei = web3Utils.toWei(feePercentage);
    synthereumFinderAddress = (await SynthereumFinder.deployed()).address;
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
    poolPayload = encodePool(
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      roles,
      isContractAllowed,
      startingCollateralization,
      fee,
    );
  });

  it('Can deploy', async () => {
    await deployerInstance.deployPoolAndDerivative(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
  });
  describe('Revert if not deployer', async () => {
    it('Revert in derivative factory', async () => {
      const derivativeFactoryInstance = await SynthereumDerivativeFactory.deployed();
      const funcSignature = await derivativeFactoryInstance.deploymentSignature();
      const dataPayload = funcSignature + derivativePayload.replace('0x', '');
      await truffleAssert.reverts(
        web3.eth.sendTransaction({
          from: sender,
          to: derivativeFactoryInstance.address,
          data: dataPayload,
        }),
        'Sender must be Synthereum deployer',
      );
    });
    it('Revert in pool factory', async () => {
      const poolFactoryInstance = await SynthereumPoolFactory.deployed();
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
  });
});
