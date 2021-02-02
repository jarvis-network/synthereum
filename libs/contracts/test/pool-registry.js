//helper scripts
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { encodeDerivative, encodePool } = require('../utils/encoding.js');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const TestnetERC20 = artifacts.require('TestnetERC20');
const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');
const SynthereumPoolRegistry = artifacts.require('SynthereumPoolRegistry');

contract('Synthereum Pool Register', function (accounts) {
  let derivativeVersion = 1;

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
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let validator = accounts[3];
  let DAO = accounts[5];
  let wrongAddressPool = accounts[6];
  let sender = accounts[7];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
    validator,
  };
  let isContractAllowed = false;
  let startingCollateralization = '1586700';
  let feePercentage = 0.02;
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  let derivativePayload;
  let poolPayload;
  let poolRegistryInstance;
  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 2;
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
    poolRegistryInstance = await SynthereumPoolRegistry.deployed();
  });
  it('Can write in the registry', async () => {
    let pools = await poolRegistryInstance.getPools.call(
      syntheticSymbol,
      collateralAddress,
      poolVersion,
    );
    assert.equal(pools.length, 0, 'Pools not void');
    let collaterals = await poolRegistryInstance.getCollaterals.call();
    assert.equal(collaterals.length, 0, 'Collaterals not void');
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
    let isDeployed = await poolRegistryInstance.isPoolDeployed.call(
      syntheticSymbol,
      collateralAddress,
      poolVersion,
      pool,
    );
    assert.equal(isDeployed, true, 'Wrong deployment status');
    pools = await poolRegistryInstance.getPools.call(
      syntheticSymbol,
      collateralAddress,
      poolVersion,
    );
    assert.equal(pools.length, 1, 'Pools number wrong');
    assert.equal(pools[0], pool, 'Wrong pool address');
    collaterals = await poolRegistryInstance.getCollaterals.call();
    assert.equal(collaterals.length, 1, 'Collateral number wrong');
    assert.equal(collaterals[0], collateralAddress, 'Collateral address wrong');
  });
  it('Revert if an address different from deployer write', async () => {
    await truffleAssert.reverts(
      poolRegistryInstance.registerPool(
        syntheticSymbol,
        collateralAddress,
        poolVersion,
        wrongAddressPool,
        { from: sender },
      ),
      'Sender must be Synthereum deployer',
    );
  });
});
