//helper scripts
const { interfaceName } = require('@jarvis-network/uma-common');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
} = require('../utils/encoding.js');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumPoolOnChainPriceFeed = artifacts.require(
  'SynthereumPoolOnChainPriceFeed',
);
const MintableBurnableSyntheticToken = artifacts.require(
  'MintableBurnableSyntheticToken',
);
const Derivative = artifacts.require('PerpetualPoolParty');
const SynthereumManager = artifacts.require('SynthereumManager');

contract('Synthereum manager', function (accounts) {
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
  let disputeBondPct = web3Utils.toWei('0.05');
  let sponsorDisputeRewardPct = web3Utils.toWei('0.5');
  let disputerDisputeRewardPct = web3Utils.toWei('0.2');
  let minSponsorTokens = web3Utils.toWei('0');
  let withdrawalLiveness = 7200;
  let liquidationLiveness = 7200;
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
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
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
  let testAdmin = accounts[8];
  let testPool = accounts[9];
  let testDerivative = accounts[10];

  let derivativePayload;
  let poolPayload;
  let poolStartingDeposit = web3Utils.toWei('1000', 'mwei');
  let poolInstance;
  let derivativeInstance;
  let synthTokenInstance;
  let managerInstance;
  let adminRole;
  let poolRole;
  let minterRole;
  let burnerRole;

  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 3;
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
    poolPayload = encodePoolOnChainPriceFeed(
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      roles,
      isContractAllowed,
      startingCollateralization,
      fee,
    );
    const addresses = await deployerInstance.deployPoolAndDerivative.call(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    poolAddress = addresses.pool;
    derivativeAddress = addresses.derivative;
    await deployerInstance.deployPoolAndDerivative(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    poolInstance = await SynthereumPoolOnChainPriceFeed.at(poolAddress);
    derivativeInstance = await Derivative.at(derivativeAddress);
    synthTokenAddr = await derivativeInstance.tokenCurrency.call();
    synthTokenInstance = await MintableBurnableSyntheticToken.at(
      synthTokenAddr,
    );
    managerInstance = await SynthereumManager.deployed();
    adminRole = '0x00';
    poolRole = web3Utils.soliditySha3('Pool');
    minterRole = web3Utils.soliditySha3('Minter');
    burnerRole = web3Utils.soliditySha3('Burner');
  });

  describe('Roles of derivative', async () => {
    it('Add roles', async () => {
      let actualAdmins = await derivativeInstance.getAdminMembers.call();
      let actualPools = await derivativeInstance.getPoolMembers.call();
      assert.equal(
        actualAdmins.length,
        1,
        'Wrong number of admins before manager calls',
      );
      assert.equal(
        actualAdmins[0],
        managerInstance.address,
        'Wrong admin before manager calls',
      );
      assert.equal(
        actualPools.length,
        1,
        'Wrong number of pools before manager calls',
      );
      assert.equal(
        actualPools[0],
        poolInstance.address,
        'Wrong pool before manager calls',
      );
      const contracts = [
        derivativeInstance.address,
        derivativeInstance.address,
      ];
      const roles = [adminRole, poolRole];
      const accounts = [testAdmin, testPool];
      await managerInstance.grantSynthereumRole(contracts, roles, accounts, {
        from: maintainer,
      });
      actualAdmins = await derivativeInstance.getAdminMembers.call();
      actualPools = await derivativeInstance.getPoolMembers.call();
      assert.equal(
        actualAdmins.length,
        2,
        'Wrong number of admins after manager calls',
      );
      assert.equal(
        actualAdmins[1],
        testAdmin,
        'Wrong admin after manager calls',
      );
      assert.equal(
        actualPools.length,
        2,
        'Wrong number of pools after manager calls',
      );
      assert.equal(actualPools[1], testPool, 'Wrong pool after manager calls');
    });
    it('Revert if no roles are passed in adding roles', async () => {
      await truffleAssert.reverts(
        managerInstance.grantSynthereumRole([], [], [], { from: maintainer }),
        'No roles paased',
      );
    });
    it('Revert if different number of roles and accounts in adding roles', async () => {
      const contracts = [
        derivativeInstance.address,
        derivativeInstance.address,
      ];
      const roles = [adminRole, poolRole];
      const accounts = [testAdmin];
      await truffleAssert.reverts(
        managerInstance.grantSynthereumRole(contracts, roles, accounts, {
          from: maintainer,
        }),
        'Number of roles and accounts must be the same',
      );
    });
    it('Revert if different number of roles and contracts in adding roles', async () => {
      const contracts = [derivativeInstance.address];
      const roles = [adminRole, poolRole];
      const accounts = [testAdmin, testPool];
      await truffleAssert.reverts(
        managerInstance.grantSynthereumRole(contracts, roles, accounts, {
          from: maintainer,
        }),
        'Number of roles and contracts must be the same',
      );
    });
    it('Revert if grant roles is not called by the maintainer', async () => {
      const contracts = [
        derivativeInstance.address,
        derivativeInstance.address,
      ];
      const roles = [adminRole, poolRole];
      const accounts = [testAdmin, testPool];
      await truffleAssert.reverts(
        managerInstance.grantSynthereumRole(contracts, roles, accounts, {
          from: sender,
        }),
        'Sender must be the maintainer or the deployer',
      );
    });
    it('Revoke roles', async () => {
      const contracts = [derivativeInstance.address];
      const roles = [poolRole];
      const accounts = [poolInstance.address];
      await managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
        from: maintainer,
      });
      actualAdmins = await derivativeInstance.getAdminMembers.call();
      actualPools = await derivativeInstance.getPoolMembers.call();
      assert.equal(
        actualAdmins.length,
        1,
        'Wrong number of admins after manager calls',
      );
      assert.equal(
        actualAdmins[0],
        managerInstance.address,
        'Wrong admin after manager calls',
      );
      assert.equal(
        actualPools.length,
        0,
        'Wrong number of pools after manager calls',
      );
    });
    it('Revert if no roles are passed in revoking roles', async () => {
      await truffleAssert.reverts(
        managerInstance.revokeSynthereumRole([], [], [], { from: maintainer }),
        'No roles paased',
      );
    });
    it('Revert if different number of roles and accounts in revoking roles', async () => {
      const contracts = [
        derivativeInstance.address,
        derivativeInstance.address,
      ];
      const roles = [adminRole, poolRole];
      const accounts = [testAdmin];
      await truffleAssert.reverts(
        managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
          from: maintainer,
        }),
        'Number of roles and accounts must be the same',
      );
    });
    it('Revert if different number of roles and contracts in revoking roles', async () => {
      const contracts = [derivativeInstance.address];
      const roles = [adminRole, poolRole];
      const accounts = [testAdmin, testPool];
      await truffleAssert.reverts(
        managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
          from: maintainer,
        }),
        'Number of roles and contracts must be the same',
      );
    });
    it('Revert if revoke roles is not called by the maintainer', async () => {
      const contracts = [
        derivativeInstance.address,
        derivativeInstance.address,
      ];
      const roles = [adminRole, poolRole];
      const accounts = [testAdmin, testPool];
      await truffleAssert.reverts(
        managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
          from: sender,
        }),
        'Sender must be the maintainer or the deployer',
      );
    });
    it('Renounce roles', async () => {
      const contracts = [derivativeInstance.address];
      const roles = [adminRole];
      await managerInstance.renounceSynthereumRole(contracts, roles, {
        from: maintainer,
      });
      actualAdmins = await derivativeInstance.getAdminMembers.call();
      actualPools = await derivativeInstance.getPoolMembers.call();
      assert.equal(
        actualAdmins.length,
        0,
        'Wrong number of admins after manager calls',
      );
      assert.equal(
        actualPools.length,
        1,
        'Wrong number of pools after manager calls',
      );
      assert.equal(
        actualPools[0],
        poolInstance.address,
        'Wrong pool after manager calls',
      );
    });
    it('Revert if no roles are passed in renouncing roles', async () => {
      await truffleAssert.reverts(
        managerInstance.renounceSynthereumRole([], [], { from: maintainer }),
        'No roles paased',
      );
    });
    it('Revert if different number of roles and contracts in renouncing roles', async () => {
      const contracts = [
        derivativeInstance.address,
        derivativeInstance.address,
      ];
      const roles = [adminRole];
      await truffleAssert.reverts(
        managerInstance.renounceSynthereumRole(contracts, roles, {
          from: maintainer,
        }),
        'Number of roles and contracts must be the same',
      );
    });
    it('Revert if renounce roles is not called by the maintainer', async () => {
      const contracts = [derivativeInstance.address];
      const roles = [adminRole];
      await truffleAssert.reverts(
        managerInstance.renounceSynthereumRole(contracts, roles, {
          from: sender,
        }),
        'Sender must be the maintainer or the deployer',
      );
    });
  });
  describe('Roles of synthetic token', async () => {
    it('Revoke roles', async () => {
      let actualAdmins = await synthTokenInstance.getAdminMembers.call();
      let actualMinters = await synthTokenInstance.getMinterMembers.call();
      let actualBurners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        actualAdmins.length,
        1,
        'Wrong number of admins before manager calls',
      );
      assert.equal(
        actualAdmins[0],
        managerInstance.address,
        'Wrong admin before manager calls',
      );
      assert.equal(
        actualMinters.length,
        1,
        'Wrong number of minters before manager calls',
      );
      assert.equal(
        actualMinters[0],
        derivativeInstance.address,
        'Wrong minter before manager calls',
      );
      assert.equal(
        actualBurners.length,
        1,
        'Wrong number of burners before manager calls',
      );
      assert.equal(
        actualBurners[0],
        derivativeInstance.address,
        'Wrong burner before manager calls',
      );
      const contracts = [synthTokenAddr, synthTokenAddr];
      const roles = [adminRole, minterRole];
      const accounts = [derivativeInstance.address, derivativeInstance.address];
      await managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
        from: maintainer,
      });
      actualAdmins = await synthTokenInstance.getAdminMembers.call();
      actualMinters = await synthTokenInstance.getMinterMembers.call();
      actualBurners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        actualAdmins.length,
        1,
        'Wrong number of admins after manager calls',
      );
      assert.equal(
        actualAdmins[0],
        managerInstance.address,
        'Wrong admin before manager calls',
      );
      assert.equal(
        actualMinters.length,
        0,
        'Wrong number of minters after manager calls',
      );
      assert.equal(
        actualBurners.length,
        1,
        'Wrong number of burners after manager calls',
      );
      assert.equal(
        actualBurners[0],
        derivativeInstance.address,
        'Wrong burner after manager calls',
      );
    });
    it('Add roles', async () => {
      let contracts = [synthTokenAddr];
      let roles = [adminRole];
      let accounts = [derivativeInstance.address];
      await managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
        from: maintainer,
      });
      contracts = [synthTokenAddr, synthTokenAddr];
      roles = [minterRole, burnerRole];
      accounts = [testDerivative, testDerivative];
      await managerInstance.grantSynthereumRole(contracts, roles, accounts, {
        from: maintainer,
      });
      const actualAdmins = await synthTokenInstance.getAdminMembers.call();
      const actualMinters = await synthTokenInstance.getMinterMembers.call();
      const actualBurners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        actualAdmins.length,
        1,
        'Wrong number of admins after manager calls',
      );
      assert.equal(
        actualAdmins[0],
        managerInstance.address,
        'Wrong admin before manager calls',
      );
      assert.equal(
        actualMinters.length,
        2,
        'Wrong number of minters after manager calls',
      );
      assert.equal(
        actualMinters[1],
        testDerivative,
        'Wrong minter before manager calls',
      );
      assert.equal(
        actualBurners.length,
        2,
        'Wrong number of burners after manager calls',
      );
      assert.equal(
        actualBurners[1],
        testDerivative,
        'Wrong burner before manager calls',
      );
    });
    it('Renounce roles', async () => {
      let contracts = [synthTokenAddr];
      let roles = [adminRole];
      let accounts = [derivativeInstance.address];
      await managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
        from: maintainer,
      });
      contracts = [synthTokenAddr];
      roles = [adminRole];
      await managerInstance.renounceSynthereumRole(contracts, roles, {
        from: maintainer,
      });
      const actualAdmins = await synthTokenInstance.getAdminMembers.call();
      const actualMinters = await synthTokenInstance.getMinterMembers.call();
      const actualBurners = await synthTokenInstance.getBurnerMembers.call();
      assert.equal(
        actualAdmins.length,
        0,
        'Wrong number of admins after manager calls',
      );
      assert.equal(
        actualMinters.length,
        1,
        'Wrong number of minters after manager calls',
      );
      assert.equal(
        actualBurners.length,
        1,
        'Wrong number of burners after manager calls',
      );
    });
  });
  describe('Emergency shutdown', async () => {
    let contracts;
    let roles;
    let accounts;
    beforeEach(async () => {
      contracts = [derivativeInstance.address];
      roles = [poolRole];
      accounts = [managerInstance.address];
      await managerInstance.grantSynthereumRole(contracts, roles, accounts, {
        from: maintainer,
      });
    });
    it('Call emergency shutdown', async () => {
      assert.equal(
        (await derivativeInstance.positionManagerData())
          .emergencyShutdownTimestamp,
        0,
        'Derivative already shutdown',
      );
      await managerInstance.emergencyShutdown(contracts, {
        from: maintainer,
      });
      assert.notEqual(
        (await derivativeInstance.positionManagerData())
          .emergencyShutdownTimestamp,
        0,
        'Derivative not shutdown',
      );
    });
    it('Revert if emergency shutdown is not called by the maintainer', async () => {
      await truffleAssert.reverts(
        managerInstance.emergencyShutdown(contracts, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
    });
    it('Revert if no derivatives are passed', async () => {
      contracts = [];
      await truffleAssert.reverts(
        managerInstance.emergencyShutdown(contracts, {
          from: maintainer,
        }),
        'No Derivative passed',
      );
    });
  });
});
