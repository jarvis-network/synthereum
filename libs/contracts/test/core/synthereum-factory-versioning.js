const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const SynthereumDerivativeFactory = artifacts.require(
  'SynthereumDerivativeFactory',
);
const SelfMintingDerivativeFactory = artifacts.require(
  'SelfMintingDerivativeFactory',
);
const SynthereumPoolOnChainPriceFeedFactory = artifacts.require(
  'SynthereumPoolOnChainPriceFeedFactory',
);
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

contract('Factory versioning', function (accounts) {
  let factoryVersioningInstance;
  let derivativeFactoryAddress;
  let poolFactoryAddress;
  let selfMintingFactoryAddress;
  let maintainer = accounts[1];
  let sender = accounts[5];
  let testDerivativeFactory = accounts[6];
  let testPoolFactory = accounts[7];
  let testSelfMintingFactory = accounts[8];
  let derivateFactoryInterface = web3.utils.padRight(
    web3.utils.stringToHex('DerivativeFactory'),
    64,
  );
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
    derivativeFactoryAddress = (await SynthereumDerivativeFactory.deployed())
      .address;
    poolFactoryAddress = (
      await SynthereumPoolOnChainPriceFeedFactory.deployed()
    ).address;
    selfMintingFactoryAddress = (await SelfMintingDerivativeFactory.deployed())
      .address;
  });

  describe('Derivative Factory', () => {
    it('Get correct number of derivative versions', async () => {
      const numberOfVersions = await factoryVersioningInstance.numberOfVerisonsOfFactory.call(
        derivateFactoryInterface,
      );
      assert.equal(numberOfVersions, 1, 'wrong number of derivative versions');
    });
    it('Update existing derivative factory', async () => {
      let derivativeFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        derivateFactoryInterface,
        2,
      );
      assert.equal(
        derivativeFactoryAddressStored,
        derivativeFactoryAddress,
        'Wrong initial derivative factory',
      );
      const updateTx = await factoryVersioningInstance.setFactory(
        derivateFactoryInterface,
        2,
        testDerivativeFactory,
        { from: maintainer },
      );
      derivativeFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        derivateFactoryInterface,
        2,
      );
      assert.equal(
        derivativeFactoryAddressStored,
        testDerivativeFactory,
        'Wrong derivative factory after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetFactory', ev => {
        return (
          ev.factoryType == derivateFactoryInterface &&
          ev.version == 2 &&
          ev.factory == testDerivativeFactory
        );
      });
      await factoryVersioningInstance.setFactory(
        derivateFactoryInterface,
        2,
        derivativeFactoryAddress,
        { from: maintainer },
      );
    });
    it('Insert new derivative factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          derivateFactoryInterface,
          3,
        ),
        'EnumerableMap: nonexistent key',
      );
      const insertTx = await factoryVersioningInstance.setFactory(
        derivateFactoryInterface,
        3,
        testDerivativeFactory,
        { from: maintainer },
      );
      derivativeFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        derivateFactoryInterface,
        3,
      );
      assert.equal(
        derivativeFactoryAddressStored,
        testDerivativeFactory,
        'Wrong derivative factory after insert',
      );
      truffleAssert.eventEmitted(insertTx, 'AddFactory', ev => {
        return (
          ev.factoryType == derivateFactoryInterface &&
          ev.version == 3 &&
          ev.factory == testDerivativeFactory
        );
      });
    });
    it('Remove derivative factory', async () => {
      let derivativeFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        derivateFactoryInterface,
        3,
      );
      assert.equal(
        derivativeFactoryAddressStored,
        testDerivativeFactory,
        'Wrong initial derivative factory',
      );
      const removeTx = await factoryVersioningInstance.removeFactory(
        derivateFactoryInterface,
        3,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          derivateFactoryInterface,
          3,
        ),
        'EnumerableMap: nonexistent key',
      );
      truffleAssert.eventEmitted(removeTx, 'RemoveFactory', ev => {
        return (
          ev.factoryType == derivateFactoryInterface &&
          ev.version == 3 &&
          ev.factory == testDerivativeFactory
        );
      });
    });
    it('Revert if try to set a zero address factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          derivateFactoryInterface,
          1,
          ZERO_ADDRESS,
          {
            from: maintainer,
          },
        ),
        'Factory cannot be address 0',
      );
    });
    it('Revert if try to remove a not existing version', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeFactory(derivateFactoryInterface, 3, {
          from: maintainer,
        }),
        'EnumerableMap: nonexistent key',
      );
    });
    it('Revert if a non-maintener user try to set factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          derivateFactoryInterface,
          1,
          testDerivativeFactory,
          {
            from: sender,
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Revert if a non-maintener user try to remove factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeFactory(derivateFactoryInterface, 1, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
    });
  });
  describe('Pool Factory', () => {
    it('Get correct number of pool versions', async () => {
      const numberOfVersions = await factoryVersioningInstance.numberOfVerisonsOfFactory.call(
        poolFactoryInterface,
      );
      assert.equal(numberOfVersions, 1, 'wrong number of pool versions');
    });
    it('Update existing pool factory', async () => {
      let poolFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        poolFactoryInterface,
        4,
      );
      assert.equal(
        poolFactoryAddressStored,
        poolFactoryAddress,
        'Wrong initial pool factory',
      );
      const updateTx = await factoryVersioningInstance.setFactory(
        poolFactoryInterface,
        4,
        testPoolFactory,
        { from: maintainer },
      );
      poolFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        poolFactoryInterface,
        4,
      );
      assert.equal(
        poolFactoryAddressStored,
        testPoolFactory,
        'Wrong pool factory after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetFactory', ev => {
        return (
          ev.factoryType == poolFactoryInterface &&
          ev.version == 4 &&
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
    it('Insert new pool factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          poolFactoryInterface,
          5,
        ),
        'EnumerableMap: nonexistent key',
      );
      const insertTx = await factoryVersioningInstance.setFactory(
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
        'Wrong pool factory after insert',
      );
      truffleAssert.eventEmitted(insertTx, 'AddFactory', ev => {
        return (
          ev.factoryType == poolFactoryInterface &&
          ev.version == 5 &&
          ev.factory == testPoolFactory
        );
      });
    });
    it('Remove pool factory', async () => {
      let poolFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        poolFactoryInterface,
        5,
      );
      assert.equal(
        poolFactoryAddressStored,
        testPoolFactory,
        'Wrong initial pool factory',
      );
      const removeTx = await factoryVersioningInstance.removeFactory(
        poolFactoryInterface,
        5,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          poolFactoryInterface,
          5,
        ),
        'EnumerableMap: nonexistent key',
      );
      truffleAssert.eventEmitted(removeTx, 'RemoveFactory', ev => {
        return (
          ev.factoryType == poolFactoryInterface &&
          ev.version == 5 &&
          ev.factory == testPoolFactory
        );
      });
    });
    it('Revert if try to set a zero address factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          poolFactoryInterface,
          4,
          ZERO_ADDRESS,
          {
            from: maintainer,
          },
        ),
        'Factory cannot be address 0',
      );
    });
    it('Revert if try to remove a not existing version', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeFactory(poolFactoryInterface, 5, {
          from: maintainer,
        }),
        'EnumerableMap: nonexistent key',
      );
    });
    it('Revert if a non-maintener user try to set factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          poolFactoryInterface,
          4,
          testDerivativeFactory,
          {
            from: sender,
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Revert if a non-maintener user try to remove factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeFactory(poolFactoryInterface, 4, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
    });
  });
  describe('Self-minting Factory', () => {
    it('Get correct number of self-minting versions', async () => {
      const numberOfVersions = await factoryVersioningInstance.numberOfVerisonsOfFactory.call(
        selfMintingFactoryInterface,
      );
      assert.equal(
        numberOfVersions,
        1,
        'wrong number of self-minting versions',
      );
    });
    it('Update existing self-minting factory', async () => {
      let selfMintingFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        selfMintingFactoryInterface,
        1,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        selfMintingFactoryAddress,
        'Wrong initial self-minting factory',
      );
      const updateTx = await factoryVersioningInstance.setFactory(
        selfMintingFactoryInterface,
        1,
        testSelfMintingFactory,
        { from: maintainer },
      );
      selfMintingFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        selfMintingFactoryInterface,
        1,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        testSelfMintingFactory,
        'Wrong self-minting factory after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetFactory', ev => {
        return (
          ev.factoryType == selfMintingFactoryInterface &&
          ev.version == 1 &&
          ev.factory == testSelfMintingFactory
        );
      });
      await factoryVersioningInstance.setFactory(
        selfMintingFactoryInterface,
        1,
        selfMintingFactoryAddress,
        { from: maintainer },
      );
    });
    it('Insert new self-minting factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          selfMintingFactoryInterface,
          2,
        ),
        'EnumerableMap: nonexistent key',
      );
      const insertTx = await factoryVersioningInstance.setFactory(
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
        'Wrong self-minting factory after insert',
      );
      truffleAssert.eventEmitted(insertTx, 'AddFactory', ev => {
        return (
          ev.factoryType == selfMintingFactoryInterface &&
          ev.version == 2 &&
          ev.factory == testSelfMintingFactory
        );
      });
    });
    it('Remove derivative factory', async () => {
      let selfMintingFactoryAddressStored = await factoryVersioningInstance.getFactoryVersion.call(
        selfMintingFactoryInterface,
        2,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        testSelfMintingFactory,
        'Wrong initial self-minting factory',
      );
      const removeTx = await factoryVersioningInstance.removeFactory(
        selfMintingFactoryInterface,
        2,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        factoryVersioningInstance.getFactoryVersion.call(
          selfMintingFactoryInterface,
          2,
        ),
        'EnumerableMap: nonexistent key',
      );
      truffleAssert.eventEmitted(removeTx, 'RemoveFactory', ev => {
        return (
          ev.factoryType == selfMintingFactoryInterface &&
          ev.version == 2 &&
          ev.factory == testSelfMintingFactory
        );
      });
    });
    it('Revert if try to set a zero address factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          selfMintingFactoryInterface,
          1,
          ZERO_ADDRESS,
          {
            from: maintainer,
          },
        ),
        'Factory cannot be address 0',
      );
    });
    it('Revert if try to remove a not existing version', async () => {
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
    it('Revert if a non-maintener user try to set factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setFactory(
          selfMintingFactoryInterface,
          1,
          testSelfMintingFactory,
          {
            from: sender,
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Revert if a non-maintener user try to remove factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeFactory(
          selfMintingFactoryInterface,
          1,
          {
            from: sender,
          },
        ),
        'Sender must be the maintainer',
      );
    });
  });
});
