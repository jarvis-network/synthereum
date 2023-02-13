const { artifacts, contract } = require('hardhat');
const { assert, AssertionError } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const { toHex } = web3Utils;
const truffleAssert = require('truffle-assertions');

const VaultRegistry = artifacts.require('SynthereumPublicVaultRegistry');
const SynthereumFinder = artifacts.require('SynthereumFinder');

contract('Public Vault Registry', accounts => {
  let registry, finder, deployer;

  before(async () => {
    finder = await SynthereumFinder.deployed();
    registry = await VaultRegistry.new(finder.address);
    deployer = accounts[5];
    await finder.changeImplementationAddress(toHex('Deployer'), deployer, {
      from: accounts[1],
    });
  });

  describe('Register/Unregister', async () => {
    let pool = accounts[8];
    let vault = accounts[9];
    let vault2 = accounts[10];

    it('Only deployer can register a new vault and pool', async () => {
      await registry.registerVault(pool, vault, { from: deployer });
      let actualVaults = await registry.getVaults(pool);

      assert.equal(actualVaults.length, 1);
      assert.equal(actualVaults[0], vault);

      await registry.registerVault(pool, vault2, { from: deployer });
      actualVaults = await registry.getVaults(pool);

      assert.equal(actualVaults.length, 2);
      assert.equal(actualVaults[1], vault2);

      await truffleAssert.reverts(
        registry.registerVault(pool, vault),
        'Sender must be Synthereum deployer',
      );
    });
    it('Cannot register the same pair two times', async () => {
      await truffleAssert.reverts(
        registry.registerVault(pool, vault, { from: deployer }),
        'Vault already registered',
      );
    });

    it('Only a pool is able to remove his mapped vault', async () => {
      await registry.removeVault(vault, { from: pool });
      let actualVaults = await registry.getVaults(pool);

      assert.equal(actualVaults.length, 1);
      assert.equal(actualVaults[0], vault2);

      // reverts if another address tries to remove
      await truffleAssert.reverts(
        registry.removeVault(vault2),
        'Vault not registered',
      );

      await registry.removeVault(vault2, { from: pool });
      actualVaults = await registry.getVaults(pool);
      assert.equal(actualVaults.length, 0);
    });
  });
});
