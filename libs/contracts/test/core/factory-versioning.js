const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const SynthereumLiquidityPoolFactory = artifacts.require(
  'SynthereumLiquidityPoolFactory',
);
const CreditLineFactory = artifacts.require('CreditLineFactory');
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

contract('Factory versioning', function (accounts) {
  let factoryVersioningInstance;
  let poolFactoryAddress;
  let selfMintingFactoryAddress;
  let maintainer = accounts[1];
  let sender = accounts[5];
  let testPoolFactory = accounts[6];
  let testSelfMintingFactory = accounts[7];
  let poolFactoryInterface = web3.utils.padRight(
    web3.utils.stringToHex('PoolFactory'),
    64,
  );
  let selfMintingFactoryInterface = web3.utils.padRight(
    web3.utils.stringToHex('SelfMintingFactory'),
    64,
  );

  beforeEach(async () => {
    factoryVersioningInstance = await SynthereumFactoryVersioning.deployed();
    poolFactoryAddress = (await SynthereumLiquidityPoolFactory.deployed())
      .address;
    selfMintingFactoryAddress = (await CreditLineFactory.deployed()).address;
  });

  describe('Should pool factory works', () => {
    it('Can get correct number of pool versions', async () => {
      const numberOfVersions = await factoryVersioningInstance.numberOfVerisonsOfFactory.call(
        poolFactoryInterface,
      );
      assert.equal(numberOfVersions, 1, 'wrong number of pool versions');
    });
    it('Can update existing pool factory', async () => {
      let poolFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        poolFactoryInterface,
        5,
      );
      assert.equal(
        poolFactoryAddressStored,
        poolFactoryAddress,
        'Wrong initial pool factory',
      );
      const updateTx = await factoryVersioningInstance.setFactory(
        poolFactoryInterface,
        5,
        testPoolFactory,
        { from: maintainer },
      );
      poolFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        poolFactoryInterface,
        5,
      );
      assert.equal(
        poolFactoryAddressStored,
        testPoolFactory,
        'Wrong pool factory after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetFactory', ev => {
        return (
          ev.factoryType == poolFactoryInterface &&
          ev.version == 5 &&
          ev.factory == testPoolFactory
        );
      });
      await factoryVersioningInstance.setFactory(
        poolFactoryInterface,
        4,
        poolFactoryAddress,
        {
          from: maintainer,
        },
      );
    });
    it('Can insert new pool factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          poolFactoryInterface,
          6,
        ),
        'EnumerableMap: nonexistent key',
      );
      const insertTx = await factoryVersioningInstance.setFactory(
        poolFactoryInterface,
        6,
        testPoolFactory,
        { from: maintainer },
      );
      poolFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        poolFactoryInterface,
        6,
      );
      assert.equal(
        poolFactoryAddressStored,
        testPoolFactory,
        'Wrong pool factory after insert',
      );
      truffleAssert.eventEmitted(insertTx, 'AddFactory', ev => {
        return (
          ev.factoryType == poolFactoryInterface &&
          ev.version == 6 &&
          ev.factory == testPoolFactory
        );
      });
    });
    it('Can remove pool factory', async () => {
      let poolFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        poolFactoryInterface,
        6,
      );
      assert.equal(
        poolFactoryAddressStored,
        testPoolFactory,
        'Wrong initial pool factory',
      );
      const removeTx = await factoryVersioningInstance.removeFactory(
        poolFactoryInterface,
        6,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          poolFactoryInterface,
          6,
        ),
        'EnumerableMap: nonexistent key',
      );
      truffleAssert.eventEmitted(removeTx, 'RemoveFactory', ev => {
        return (
          ev.factoryType == poolFactoryInterface &&
          ev.version == 6 &&
          ev.factory == testPoolFactory
        );
      });
    });
    it('Can revert if try to set a zero address factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          poolFactoryInterface,
          5,
          ZERO_ADDRESS,
          {
            from: maintainer,
          },
        ),
        'Factory cannot be address 0',
      );
    });
    it('Can revert if try to remove a not existing version', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeFactory(poolFactoryInterface, 6, {
          from: maintainer,
        }),
        'EnumerableMap: nonexistent key',
      );
    });
    it('Can revert if a non-maintener user try to set factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          poolFactoryInterface,
          5,
          testPoolFactory,
          {
            from: sender,
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if a non-maintener user try to remove factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeFactory(poolFactoryInterface, 5, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
    });
  });

  describe('Should self-minting Factory works', () => {
    it('Can get correct number of self-minting versions', async () => {
      const numberOfVersions = await factoryVersioningInstance.numberOfVerisonsOfFactory.call(
        selfMintingFactoryInterface,
      );
      assert.equal(
        numberOfVersions,
        1,
        'wrong number of self-minting versions',
      );
    });
    it('Can update existing self-minting factory', async () => {
      let selfMintingFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        selfMintingFactoryInterface,
        2,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        selfMintingFactoryAddress,
        'Wrong initial self-minting factory',
      );
      const updateTx = await factoryVersioningInstance.setFactory(
        selfMintingFactoryInterface,
        2,
        testSelfMintingFactory,
        { from: maintainer },
      );
      selfMintingFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        selfMintingFactoryInterface,
        2,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        testSelfMintingFactory,
        'Wrong self-minting factory after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetFactory', ev => {
        return (
          ev.factoryType == selfMintingFactoryInterface &&
          ev.version == 2 &&
          ev.factory == testSelfMintingFactory
        );
      });
      await factoryVersioningInstance.setFactory(
        selfMintingFactoryInterface,
        2,
        selfMintingFactoryAddress,
        { from: maintainer },
      );
    });
    it('Can insert new self-minting factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          selfMintingFactoryInterface,
          3,
        ),
        'EnumerableMap: nonexistent key',
      );
      const insertTx = await factoryVersioningInstance.setFactory(
        selfMintingFactoryInterface,
        3,
        testSelfMintingFactory,
        { from: maintainer },
      );
      selfMintingFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        selfMintingFactoryInterface,
        3,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        testSelfMintingFactory,
        'Wrong self-minting factory after insert',
      );
      truffleAssert.eventEmitted(insertTx, 'AddFactory', ev => {
        return (
          ev.factoryType == selfMintingFactoryInterface &&
          ev.version == 3 &&
          ev.factory == testSelfMintingFactory
        );
      });
    });
    it('Can remove derivative factory', async () => {
      let selfMintingFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        selfMintingFactoryInterface,
        3,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        testSelfMintingFactory,
        'Wrong initial self-minting factory',
      );
      const removeTx = await factoryVersioningInstance.removeFactory(
        selfMintingFactoryInterface,
        3,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          selfMintingFactoryInterface,
          3,
        ),
        'EnumerableMap: nonexistent key',
      );
      truffleAssert.eventEmitted(removeTx, 'RemoveFactory', ev => {
        return (
          ev.factoryType == selfMintingFactoryInterface &&
          ev.version == 3 &&
          ev.factory == testSelfMintingFactory
        );
      });
    });
    it('Can revert if try to set a zero address factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          selfMintingFactoryInterface,
          2,
          ZERO_ADDRESS,
          {
            from: maintainer,
          },
        ),
        'Factory cannot be address 0',
      );
    });
    it('Can revert if try to remove a not existing version', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeFactory(
          selfMintingFactoryInterface,
          3,
          {
            from: maintainer,
          },
        ),
        'EnumerableMap: nonexistent key',
      );
    });
    it('Can revert if a non-maintener user try to set factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          selfMintingFactoryInterface,
          2,
          testSelfMintingFactory,
          {
            from: sender,
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if a non-maintener user try to remove factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeFactory(
          selfMintingFactoryInterface,
          2,
          {
            from: sender,
          },
        ),
        'Sender must be the maintainer',
      );
    });
  });
});
