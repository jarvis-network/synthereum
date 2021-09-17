/* eslint-disable */
const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const Web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const Proxy = artifacts.require('AtomicSwapProxy');

contract('AtomicSwap Proxy', accounts => {
  let admin = accounts[0];
  let proxyInstance;
  // actual parameters are not really relevant here
  let implementationInfo = {
    routerAddress: accounts[1],
    synthereumFinder: accounts[2],
    nativeCryptoAddress: accounts[3],
  };

  let encodedInfo = web3.eth.abi.encodeParameters(
    ['address', 'address', 'address'],
    [
      implementationInfo.routerAddress,
      implementationInfo.synthereumFinder,
      implementationInfo.nativeCryptoAddress,
    ],
  );

  let implementationId1 = 'sushiSwap';
  let implementationAddr1 = accounts[4];
  let implementationAddr2 = accounts[5];

  describe('Add/Remove Implementation', () => {
    before(async () => {
      proxyInstance = await Proxy.new(admin);
    });

    it('Register a new implementation', async () => {
      let tx = await proxyInstance.registerImplementation(
        implementationId1,
        implementationAddr1,
        encodedInfo,
        { from: admin },
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
          ev.id == implementationId1 && ev.implementation == implementationAddr1
        );
      });
    });
    it('Override an existing implementation with new data', async () => {
      let tx = await proxyInstance.registerImplementation(
        implementationId1,
        implementationAddr2,
        encodedInfo,
        { from: admin },
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
          ev.id == implementationId1 && ev.implementation == implementationAddr2
        );
      });
    });
    it('Removes an implementation', async () => {
      let tx = await proxyInstance.removeImplementation(implementationId1, {
        from: admin,
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
        'Only admin',
      );

      await truffleAssert.reverts(
        proxyInstance.removeImplementation(implementationId1, {
          from: accounts[9],
        }),
        'Only admin',
      );
    });
  });
});
