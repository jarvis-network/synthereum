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
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');

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
      const numberOfVersions = await factoryVersioningInstance.numberOfVerisonsOfDerivativeFactory.call();
      assert.equal(numberOfVersions, 1, 'wrong number of derivative versions');
    });
    it('Update existing derivative factory', async () => {
      let derivativeFactoryAddressStored = await factoryVersioningInstance.getDerivativeFactoryVersion.call(
        2,
      );
      assert.equal(
        derivativeFactoryAddressStored,
        derivativeFactoryAddress,
        'Wrong initial derivative factory',
      );
      const updateTx = await factoryVersioningInstance.setDerivativeFactory(
        2,
        testDerivativeFactory,
        { from: maintainer },
      );
      derivativeFactoryAddressStored = await factoryVersioningInstance.getDerivativeFactoryVersion.call(
        2,
      );
      assert.equal(
        derivativeFactoryAddressStored,
        testDerivativeFactory,
        'Wrong derivative factory after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetDerivativeFactory', ev => {
        return ev.version == 2 && ev.derivativeFactory == testDerivativeFactory;
      });
      await factoryVersioningInstance.setDerivativeFactory(
        2,
        derivativeFactoryAddress,
        { from: maintainer },
      );
    });
    it('Insert new derivative factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.getDerivativeFactoryVersion.call(3),
        'EnumerableMap: nonexistent key',
      );
      const insertTx = await factoryVersioningInstance.setDerivativeFactory(
        3,
        testDerivativeFactory,
        { from: maintainer },
      );
      derivativeFactoryAddressStored = await factoryVersioningInstance.getDerivativeFactoryVersion.call(
        3,
      );
      assert.equal(
        derivativeFactoryAddressStored,
        testDerivativeFactory,
        'Wrong derivative factory after insert',
      );
      truffleAssert.eventEmitted(insertTx, 'AddDerivativeFactory', ev => {
        return ev.version == 3 && ev.derivativeFactory == testDerivativeFactory;
      });
    });
    it('Remove derivative factory', async () => {
      let derivativeFactoryAddressStored = await factoryVersioningInstance.getDerivativeFactoryVersion.call(
        3,
      );
      assert.equal(
        derivativeFactoryAddressStored,
        testDerivativeFactory,
        'Wrong initial derivative factory',
      );
      const removeTx = await factoryVersioningInstance.removeDerivativeFactory(
        3,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        factoryVersioningInstance.getDerivativeFactoryVersion.call(3),
        'EnumerableMap: nonexistent key',
      );
      truffleAssert.eventEmitted(removeTx, 'RemoveDerivativeFactory', ev => {
        return ev.version == 3 && ev.derivativeFactory == testDerivativeFactory;
      });
    });
    it('Revert if try to set a zero address factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setDerivativeFactory(1, ZERO_ADDRESS, {
          from: maintainer,
        }),
        'Derivative factory cannot be address 0',
      );
    });
    it('Revert if try to remove a not existing version', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeDerivativeFactory(3, {
          from: maintainer,
        }),
        'EnumerableMap: nonexistent key',
      );
    });
    it('Revert if a non-maintener user try to set factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setDerivativeFactory(
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
        factoryVersioningInstance.removeDerivativeFactory(1, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
    });
  });
  describe('Pool Factory', () => {
    it('Get correct number of pool versions', async () => {
      const numberOfVersions = await factoryVersioningInstance.numberOfVerisonsOfPoolFactory.call();
      assert.equal(numberOfVersions, 1, 'wrong number of pool versions');
    });
    it('Update existing pool factory', async () => {
      let poolFactoryAddressStored = await factoryVersioningInstance.getPoolFactoryVersion.call(
        4,
      );
      assert.equal(
        poolFactoryAddressStored,
        poolFactoryAddress,
        'Wrong initial pool factory',
      );
      const updateTx = await factoryVersioningInstance.setPoolFactory(
        4,
        testPoolFactory,
        { from: maintainer },
      );
      poolFactoryAddressStored = await factoryVersioningInstance.getPoolFactoryVersion.call(
        4,
      );
      assert.equal(
        poolFactoryAddressStored,
        testPoolFactory,
        'Wrong pool factory after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetPoolFactory', ev => {
        return ev.version == 4 && ev.poolFactory == testPoolFactory;
      });
      await factoryVersioningInstance.setPoolFactory(4, poolFactoryAddress, {
        from: maintainer,
      });
    });
    it('Insert new pool factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.getPoolFactoryVersion.call(5),
        'EnumerableMap: nonexistent key',
      );
      const insertTx = await factoryVersioningInstance.setPoolFactory(
        5,
        testPoolFactory,
        { from: maintainer },
      );
      poolFactoryAddressStored = await factoryVersioningInstance.getPoolFactoryVersion.call(
        5,
      );
      assert.equal(
        poolFactoryAddressStored,
        testPoolFactory,
        'Wrong pool factory after insert',
      );
      truffleAssert.eventEmitted(insertTx, 'AddPoolFactory', ev => {
        return ev.version == 5 && ev.poolFactory == testPoolFactory;
      });
    });
    it('Remove pool factory', async () => {
      let poolFactoryAddressStored = await factoryVersioningInstance.getPoolFactoryVersion.call(
        5,
      );
      assert.equal(
        poolFactoryAddressStored,
        testPoolFactory,
        'Wrong initial pool factory',
      );
      const removeTx = await factoryVersioningInstance.removePoolFactory(5, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        factoryVersioningInstance.getPoolFactoryVersion.call(5),
        'EnumerableMap: nonexistent key',
      );
      truffleAssert.eventEmitted(removeTx, 'RemovePoolFactory', ev => {
        return ev.version == 5 && ev.poolFactory == testPoolFactory;
      });
    });
    it('Revert if try to set a zero address factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setPoolFactory(4, ZERO_ADDRESS, {
          from: maintainer,
        }),
        'Pool factory cannot be address 0',
      );
    });
    it('Revert if try to remove a not existing version', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removePoolFactory(5, {
          from: maintainer,
        }),
        'EnumerableMap: nonexistent key',
      );
    });
    it('Revert if a non-maintener user try to set factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setPoolFactory(4, testDerivativeFactory, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
    });
    it('Revert if a non-maintener user try to remove factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removePoolFactory(4, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
    });
  });
  describe('Self-minting Factory', () => {
    it('Get correct number of self-minting versions', async () => {
      const numberOfVersions = await factoryVersioningInstance.numberOfVerisonsOfSelfMintingFactory.call();
      assert.equal(
        numberOfVersions,
        1,
        'wrong number of self-minting versions',
      );
    });
    it('Update existing self-minting factory', async () => {
      let selfMintingFactoryAddressStored = await factoryVersioningInstance.getSelfMintingFactoryVersion.call(
        1,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        selfMintingFactoryAddress,
        'Wrong initial self-minting factory',
      );
      const updateTx = await factoryVersioningInstance.setSelfMintingFactory(
        1,
        testSelfMintingFactory,
        { from: maintainer },
      );
      selfMintingFactoryAddressStored = await factoryVersioningInstance.getSelfMintingFactoryVersion.call(
        1,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        testSelfMintingFactory,
        'Wrong self-minting factory after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetSelfMintingFactory', ev => {
        return (
          ev.version == 1 && ev.selfMintingFactory == testSelfMintingFactory
        );
      });
      await factoryVersioningInstance.setDerivativeFactory(
        1,
        selfMintingFactoryAddress,
        { from: maintainer },
      );
    });
    it('Insert new self-minting factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.getSelfMintingFactoryVersion.call(2),
        'EnumerableMap: nonexistent key',
      );
      const insertTx = await factoryVersioningInstance.setSelfMintingFactory(
        2,
        testSelfMintingFactory,
        { from: maintainer },
      );
      selfMintingFactoryAddressStored = await factoryVersioningInstance.getSelfMintingFactoryVersion.call(
        2,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        testSelfMintingFactory,
        'Wrong self-minting factory after insert',
      );
      truffleAssert.eventEmitted(insertTx, 'AddSelfMintingFactory', ev => {
        return (
          ev.version == 2 && ev.selfMintingFactory == testSelfMintingFactory
        );
      });
    });
    it('Remove derivative factory', async () => {
      let selfMintingFactoryAddressStored = await factoryVersioningInstance.getSelfMintingFactoryVersion.call(
        2,
      );
      assert.equal(
        selfMintingFactoryAddressStored,
        testSelfMintingFactory,
        'Wrong initial self-minting factory',
      );
      const removeTx = await factoryVersioningInstance.removeSelfMintingFactory(
        2,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        factoryVersioningInstance.getSelfMintingFactoryVersion.call(2),
        'EnumerableMap: nonexistent key',
      );
      truffleAssert.eventEmitted(removeTx, 'RemoveSelfMintingFactory', ev => {
        return (
          ev.version == 2 && ev.selfMintingFactory == testSelfMintingFactory
        );
      });
    });
    it('Revert if try to set a zero address factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setSelfMintingFactory(1, ZERO_ADDRESS, {
          from: maintainer,
        }),
        'Self-minting factory cannot be address 0',
      );
    });
    it('Revert if try to remove a not existing version', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.removeSelfMintingFactory(3, {
          from: maintainer,
        }),
        'EnumerableMap: nonexistent key',
      );
    });
    it('Revert if a non-maintener user try to set factory', async () => {
      await truffleAssert.reverts(
        factoryVersioningInstance.setSelfMintingFactory(
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
        factoryVersioningInstance.removeDerivativeFactory(1, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
    });
  });
});
