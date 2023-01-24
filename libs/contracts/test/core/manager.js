//helper scripts
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeLiquidityPool,
  encodeCreditLineDerivative,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const { artifacts } = require('hardhat');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumManager = artifacts.require('SynthereumManager');
const TestnetERC20 = artifacts.require('TestnetERC20');
const MintableBurnableSyntheticToken = artifacts.require(
  'MintableBurnableSyntheticToken',
);
const SynthereumCollateralWhitelist = artifacts.require(
  'SynthereumCollateralWhitelist',
);
const SynthereumIdentifierWhitelist = artifacts.require(
  'SynthereumIdentifierWhitelist',
);
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumLiquidityPool = artifacts.require('SynthereumLiquidityPool');
const MockAggregator = artifacts.require('MockAggregator');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const SynthereumLiquidityPoolLib = artifacts.require(
  'SynthereumLiquidityPoolLib',
);
const SynthereumLiquidityPoolFactory = artifacts.require(
  'SynthereumLiquidityPoolFactory',
);
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);

contract('Manager', function (accounts) {
  let collateralAddress;
  let priceFeedIdentifier = 'EURUSD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let syntheticSymbol = 'jEUR';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let collateralRequirement = web3Utils.toWei('1.1');
  let minSponsorTokens = web3Utils.toWei('1');
  let excessBeneficiary = accounts[4];
  let managerInstance;
  let manager;
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
  };
  let overCollateralization = web3Utils.toWei('0.2');
  let liquidationReward = web3Utils.toWei('0.5');
  let feePercentage = 0.02;
  let DAO = accounts[5];
  let testAccount = accounts[6];
  let sender = accounts[7];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  let capMintAmount = web3Utils.toWei('1000000');
  let firstWrongAddress = accounts[6];
  let secondWrongAddress = accounts[7];
  let poolPayload;
  let collateralWhitelistInstance;
  let identifierWhitelistInstance;
  let mockAggregator;
  let synthereumChainlinkPriceFeed;
  let liquidityPool;
  let synthTokenAddress;
  let synthTokenInstance;
  let adminRole = '0x00';
  let minterRole;
  let burnerRole;

  before(async () => {
    collateralAddress = (await TestnetERC20.new('Testnet token', 'USDC', 6))
      .address;
    mockAggregator = await MockAggregator.new(8, 120000000);
    synthereumChainlinkPriceFeed = await SynthereumChainlinkPriceFeed.deployed();
    await synthereumChainlinkPriceFeed.setPair(
      0,
      web3.utils.utf8ToHex(priceFeedIdentifier),
      mockAggregator.address,
      [],
      { from: maintainer },
    );
    collateralWhitelistInstance = await SynthereumCollateralWhitelist.deployed();
    await collateralWhitelistInstance.addToWhitelist(collateralAddress, {
      from: maintainer,
    });
    identifierWhitelistInstance = await SynthereumIdentifierWhitelist.deployed();
    await identifierWhitelistInstance.addToWhitelist(
      web3.utils.utf8ToHex(priceFeedIdentifier),
      {
        from: maintainer,
      },
    );
    const synthereumLiquidityPoolLib = await SynthereumLiquidityPoolLib.new();
    await SynthereumLiquidityPoolFactory.link(synthereumLiquidityPoolLib);
    const finder = await SynthereumFinder.deployed();
    poolFactoryInstance = await SynthereumLiquidityPoolFactory.new(
      finder.address,
    );
    const factoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
    await factoryVersioningInstance.setFactory(
      web3.utils.stringToHex('PoolFactory'),
      5,
      poolFactoryInstance.address,
      { from: maintainer },
    );
    managerInstance = await SynthereumManager.deployed();
    adminRole = '0x00';
    poolRole = web3Utils.soliditySha3('Pool');
    minterRole = web3Utils.soliditySha3('Minter');
    burnerRole = web3Utils.soliditySha3('Burner');
  });
  beforeEach(async () => {
    deployerInstance = await SynthereumDeployer.deployed();
    poolVersion = 5;
    manager = (await SynthereumManager.deployed()).address;
    poolPayload = encodeLiquidityPool(
      collateralAddress,
      syntheticName,
      syntheticSymbol,
      syntheticTokenAddress,
      roles,
      overCollateralization,
      fee,
      priceFeedIdentifier,
      collateralRequirement,
      liquidationReward,
      poolVersion,
    );
    const pool = await deployerInstance.deployPool.call(
      poolVersion,
      poolPayload,
      { from: maintainer },
    );
    await deployerInstance.deployPool(poolVersion, poolPayload, {
      from: maintainer,
    });
    liquidityPool = await SynthereumLiquidityPool.at(pool);
    synthTokenAddress = await liquidityPool.syntheticToken.call();
    synthTokenInstance = await MintableBurnableSyntheticToken.at(
      synthTokenAddress,
    );
  });

  describe('Should manage roles of synthetic token', async () => {
    it('Can revoke roles', async () => {
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
        liquidityPool.address,
        'Wrong minter before manager calls',
      );
      assert.equal(
        actualBurners.length,
        1,
        'Wrong number of burners before manager calls',
      );
      assert.equal(
        actualBurners[0],
        liquidityPool.address,
        'Wrong burner before manager calls',
      );
      const contracts = [synthTokenAddress, synthTokenAddress];
      const roles = [burnerRole, minterRole];
      const accounts = [liquidityPool.address, liquidityPool.address];
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
        0,
        'Wrong number of burners after manager calls',
      );
    });
    it('Can revert if no roles are passed in revoking roles', async () => {
      await truffleAssert.reverts(
        managerInstance.revokeSynthereumRole([], [], [], { from: maintainer }),
        'No roles passed',
      );
    });
    it('Can revert if different number of roles and accounts in revoking roles', async () => {
      const contracts = [synthTokenAddress, synthTokenAddress];
      const roles = [adminRole, minterRole];
      const accounts = [managerInstance.address];
      await truffleAssert.reverts(
        managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
          from: maintainer,
        }),
        'Number of roles and accounts must be the same',
      );
    });
    it('Can revert if different number of roles and contracts in revoking roles', async () => {
      const contracts = [synthTokenAddress];
      const roles = [adminRole, minterRole];
      const accounts = [managerInstance.address, liquidityPool.address];
      await truffleAssert.reverts(
        managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
          from: maintainer,
        }),
        'Number of roles and contracts must be the same',
      );
    });
    it('Can revert if revoke roles is not called by the maintainer', async () => {
      const contracts = [synthTokenAddress, synthTokenAddress];
      const roles = [minterRole, burnerRole];
      const accounts = [liquidityPool.address, liquidityPool.address];
      await truffleAssert.reverts(
        managerInstance.revokeSynthereumRole(contracts, roles, accounts, {
          from: sender,
        }),
        'Sender must be the maintainer or the deployer',
      );
    });
    it('Can add roles', async () => {
      const contracts = [synthTokenAddress, synthTokenAddress];
      const roles = [minterRole, burnerRole];
      const accounts = [testAccount, testAccount];
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
        testAccount,
        'Wrong minter before manager calls',
      );
      assert.equal(
        actualBurners.length,
        2,
        'Wrong number of burners after manager calls',
      );
      assert.equal(
        actualBurners[1],
        testAccount,
        'Wrong burner before manager calls',
      );
    });
    it('Can revert if no roles are passed in adding roles', async () => {
      await truffleAssert.reverts(
        managerInstance.grantSynthereumRole([], [], [], { from: maintainer }),
        'No roles passed',
      );
    });
    it('Can revert if different number of roles and accounts in adding roles', async () => {
      const contracts = [synthTokenAddress, synthTokenAddress];
      const roles = [minterRole, burnerRole];
      const accounts = [testAccount];
      await truffleAssert.reverts(
        managerInstance.grantSynthereumRole(contracts, roles, accounts, {
          from: maintainer,
        }),
        'Number of roles and accounts must be the same',
      );
    });
    it('Can revert if different number of roles and contracts in adding roles', async () => {
      const contracts = [synthTokenAddress];
      const roles = [minterRole, burnerRole];
      const accounts = [testAccount, testAccount];
      await truffleAssert.reverts(
        managerInstance.grantSynthereumRole(contracts, roles, accounts, {
          from: maintainer,
        }),
        'Number of roles and contracts must be the same',
      );
    });
    it('Can revert if grant roles is not called by the maintainer', async () => {
      const contracts = [synthTokenAddress, synthTokenAddress];
      const roles = [minterRole, burnerRole];
      const accounts = [testAccount, testAccount];
      await truffleAssert.reverts(
        managerInstance.grantSynthereumRole(contracts, roles, accounts, {
          from: sender,
        }),
        'Sender must be the maintainer or the deployer',
      );
    });
    it('Can renounce roles', async () => {
      const contracts = [synthTokenAddress];
      const roles = [adminRole];
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
    it('Can revert if no roles are passed in renouncing roles', async () => {
      await truffleAssert.reverts(
        managerInstance.renounceSynthereumRole([], [], { from: maintainer }),
        'No roles passed',
      );
    });
    it('Can revert if different number of roles and contracts in renouncing roles', async () => {
      const contracts = [synthTokenAddress, synthTokenAddress];
      const roles = [adminRole];
      await truffleAssert.reverts(
        managerInstance.renounceSynthereumRole(contracts, roles, {
          from: maintainer,
        }),
        'Number of roles and contracts must be the same',
      );
    });
    it('Can revert if renounce roles is not called by the maintainer', async () => {
      const contracts = [synthTokenAddress];
      const roles = [adminRole];
      await truffleAssert.reverts(
        managerInstance.renounceSynthereumRole(contracts, roles, {
          from: sender,
        }),
        'Sender must be the maintainer or the deployer',
      );
    });
  });

  describe('Should Emergency shutdown', async () => {
    it('Can call emergency shutdown', async () => {
      assert.equal(
        await liquidityPool.emergencyShutdownTimestamp(),
        0,
        'Pool already shutdown',
      );
      await managerInstance.emergencyShutdown([liquidityPool.address], {
        from: maintainer,
      });
      assert.notEqual(
        await liquidityPool.emergencyShutdownTimestamp(),
        0,
        'Pool not shutdown',
      );
    });
    it('Can revert if emergency shutdown is not called by the maintainer', async () => {
      await truffleAssert.reverts(
        managerInstance.emergencyShutdown([liquidityPool.address], {
          from: testAccount,
        }),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if no derivatives are passed', async () => {
      const contracts = [];
      await truffleAssert.reverts(
        managerInstance.emergencyShutdown(contracts, {
          from: maintainer,
        }),
        'No Derivative passed',
      );
    });
  });
});
