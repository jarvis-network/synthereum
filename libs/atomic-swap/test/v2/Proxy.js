/* eslint-disable */
const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const Web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const Proxy = artifacts.require('AtomicSwapProxy');

contract('AtomicSwap Proxy', accounts => {
  let admin = accounts[0];
  let maintainer = accounts[1];

  let proxyInstance;
  // actual parameters are not really relevant here
  let synthereumFinder = accounts[0];

  let implementationInfo = {
    routerAddress: accounts[1],
  };

  let FixedRateRoles = {
    admin,
    maintainers: [maintainer],
  };
  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address'],
    [implementationInfo.routerAddress],
  );

  let implementationId1 = 'sushiSwap';
  let implementationAddr1 = accounts[4];
  let implementationAddr2 = accounts[5];

  describe('Add/Remove Implementation', () => {
    before(async () => {
      proxyInstance = await Proxy.new(FixedRateRoles, synthereumFinder);
    });

    it('Register a new implementation', async () => {
      let tx = await proxyInstance.registerImplementation(
        implementationId1,
        implementationAddr1,
        encodedInfo,
        { from: maintainer },
      );
      let actualInfo = await proxyInstance.dexImplementationInfo.call(
        implementationAddr1,
      );

      assert.equal(
        await proxyInstance.getImplementationAddress(implementationId1),
        implementationAddr1,
      );
      assert.equal(actualInfo, encodedInfo);
      // assert.equal(actualInfo[1], implementationInfo.synthereumFinder);
      // assert.equal(actualInfo[2], implementationInfo.nativeCryptoAddress);

      truffleAssert.eventEmitted(tx, 'RegisterImplementation', ev => {
        return (
          ev.id == implementationId1 &&
          ev.implementation == implementationAddr1 &&
          ev.previous == ZERO_ADDRESS
        );
      });
    });
    it('Override an existing implementation with new data', async () => {
      let tx = await proxyInstance.registerImplementation(
        implementationId1,
        implementationAddr2,
        encodedInfo,
        { from: maintainer },
      );
      let actualInfo = await proxyInstance.dexImplementationInfo.call(
        implementationAddr1,
      );

      assert.equal(
        await proxyInstance.getImplementationAddress(implementationId1),
        implementationAddr2,
      );
      assert.equal(actualInfo, encodedInfo);

      truffleAssert.eventEmitted(tx, 'RegisterImplementation', ev => {
        return (
          ev.id == implementationId1 &&
          ev.implementation == implementationAddr2 &&
          ev.previous == implementationAddr1
        );
      });
    });
    it('Removes an implementation', async () => {
      let tx = await proxyInstance.removeImplementation(implementationId1, {
        from: maintainer,
      });
      let actualInfo = await proxyInstance.dexImplementationInfo.call(
        implementationAddr2,
      );

      assert.equal(
        await proxyInstance.getImplementationAddress(implementationId1),
        ZERO_ADDRESS,
      );
      assert.equal(actualInfo, null);

      truffleAssert.eventEmitted(tx, 'RemovedImplementation', ev => {
        return ev.id == implementationId1;
      });
    });
    it('Rejects if caller is not the admin', async () => {
      await truffleAssert.reverts(
        proxyInstance.registerImplementation(
          implementationId1,
          implementationAddr1,
          encodedInfo,
          { from: accounts[9] },
        ),
        'Only contract maintainer can call this function',
      );

      await truffleAssert.reverts(
        proxyInstance.removeImplementation(implementationId1, {
          from: accounts[9],
        }),
        'Only contract maintainer can call this function',
      );
    });
  });
});
