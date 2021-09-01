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
        implementationInfo,
        { from: admin },
      );
      let actualInfo = await proxyInstance.implementationInfo.call(
        implementationAddr1,
      );

      assert.equal(
        await proxyInstance.getImplementationAddress(implementationId1),
        implementationAddr1,
      );
      assert.equal(actualInfo[0], implementationInfo.routerAddress);
      assert.equal(actualInfo[1], implementationInfo.synthereumFinder);
      assert.equal(actualInfo[2], implementationInfo.nativeCryptoAddress);

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
        implementationInfo,
        { from: admin },
      );
      let actualInfo = await proxyInstance.implementationInfo.call(
        implementationAddr1,
      );

      assert.equal(
        await proxyInstance.getImplementationAddress(implementationId1),
        implementationAddr2,
      );
      assert.equal(actualInfo[0], implementationInfo.routerAddress);
      assert.equal(actualInfo[1], implementationInfo.synthereumFinder);
      assert.equal(actualInfo[2], implementationInfo.nativeCryptoAddress);

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
      let actualInfo = await proxyInstance.implementationInfo.call(
        implementationAddr2,
      );

      assert.equal(
        await proxyInstance.getImplementationAddress(implementationId1),
        ZERO_ADDRESS,
      );
      assert.equal(actualInfo[0], ZERO_ADDRESS);
      assert.equal(actualInfo[1], ZERO_ADDRESS);
      assert.equal(actualInfo[2], ZERO_ADDRESS);
      truffleAssert.eventEmitted(tx, 'RemovedImplementation', ev => {
        return ev.id == implementationId1;
      });
    });
    it('Rejects if caller is not the admin', async () => {
      await truffleAssert.reverts(
        proxyInstance.registerImplementation(
          implementationId1,
          implementationAddr1,
          implementationInfo,
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
