const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const web3Utils = require('web3-utils');
const { toWei, toBN } = web3Utils;
const truffleAssert = require('truffle-assertions');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const JarvisTokenImplementation = artifacts.require(
  'JarvisTokenImplementation',
);
const JarvisToken = artifacts.require('JarvisToken');
const SynthereumTrustedForwarder = artifacts.require(
  'SynthereumTrustedForwarder',
);
const { generateForwarderSignature } = require('../../utils/metaTx.js');
const { mnemonicToPrivateKey } = require('@jarvis-network/crypto-utils');
const mnemonic = process.env.MNEMONIC;

contract('Jarvis Token Contract', accounts => {
  let tokenProxy;
  let tokenImplementation;
  let tokenInstance;
  let finder;
  let forwarderIntstance;
  const admin = accounts[4];
  const maintainer = accounts[1];
  const receiver = accounts[2];
  const secReceiver = accounts[3];
  const sender = accounts[0];

  const totalSupply = toWei('100000000');
  const MAX_GAS = 12000000;

  before(async () => {
    finder = await SynthereumFinder.deployed();
    forwarder = await SynthereumTrustedForwarder.deployed();
  });

  beforeEach(async () => {
    finder = await SynthereumFinder.deployed();
    tokenImplementation = await JarvisTokenImplementation.new(finder.address);
    tokenProxy = await JarvisToken.new(
      tokenImplementation.address,
      admin,
      web3.eth.abi.encodeFunctionCall(
        {
          name: 'initialize',
          type: 'function',
          inputs: [
            {
              type: 'uint256',
              name: '_totSupply',
            },
            {
              type: 'address',
              name: '_recipient',
            },
          ],
        },
        [totalSupply, receiver],
      ),
    );
    tokenInstance = await JarvisTokenImplementation.at(tokenProxy.address);
  });

  describe('Should initialize', () => {
    it('Can initialize token', async () => {
      const proxyVersion = await tokenInstance.version.call();
      const implVersion = await tokenImplementation.version.call();
      await assert.equal(
        proxyVersion.toString(),
        implVersion.toString(),
        'Versions do not match',
      );
      await assert.equal(proxyVersion, '1', 'Wrong version');
      const proxyfinder = await tokenInstance.synthereumFinder.call();
      const implFinder = await tokenImplementation.synthereumFinder.call();
      await assert.equal(proxyfinder, implFinder, 'Finders do not match');
      await assert.equal(proxyfinder, finder.address, 'Wrong finder');
      const totSupply = await tokenInstance.totalSupply.call();
      await assert.equal(
        totSupply.toString(),
        totalSupply.toString(),
        'Wrong supply',
      );
      const receiverBalance = await tokenInstance.balanceOf.call(receiver);
      await assert.equal(
        receiverBalance,
        totalSupply.toString(),
        'Wrong balance',
      );
    });
    it('Can revert if already initialized', async () => {
      await truffleAssert.reverts(
        tokenInstance.initialize(totalSupply, receiver, {
          from: sender,
        }),
        'Initializable: contract is already initialized',
      );
      await truffleAssert.reverts(
        tokenImplementation.initialize(totalSupply, receiver, {
          from: sender,
        }),
        'Initializable: contract is already initialized',
      );
    });
    it('Can revert if initial receiver is zero address', async () => {
      await truffleAssert.reverts(
        JarvisToken.new(
          tokenImplementation.address,
          admin,
          web3.eth.abi.encodeFunctionCall(
            {
              name: 'initialize',
              type: 'function',
              inputs: [
                {
                  type: 'uint256',
                  name: '_totSupply',
                },
                {
                  type: 'address',
                  name: '_recipient',
                },
              ],
            },
            [totalSupply, ZERO_ADDRESS],
          ),
        ),
        'Null initial recipient',
      );
    });
    it('Can revert if initial supply is zero', async () => {
      await truffleAssert.reverts(
        JarvisToken.new(
          tokenImplementation.address,
          admin,
          web3.eth.abi.encodeFunctionCall(
            {
              name: 'initialize',
              type: 'function',
              inputs: [
                {
                  type: 'uint256',
                  name: '_totSupply',
                },
                {
                  type: 'address',
                  name: '_recipient',
                },
              ],
            },
            ['0', receiver],
          ),
        ),
        'No initial supply',
      );
    });
  });

  describe('Should transfer to many', () => {
    it('Can transfer to many', async () => {
      await tokenInstance.transfer(sender, totalSupply, { from: receiver });
      const firstAmount = toWei('5000000');
      const secondAmount = toWei('7500000');
      const senderBalanceBefore = await tokenInstance.balanceOf.call(sender);
      const firstReceiverBalanceBefore = await tokenInstance.balanceOf.call(
        receiver,
      );
      const secondReceiverBalanceBefore = await tokenInstance.balanceOf.call(
        secReceiver,
      );
      await tokenInstance.transferToMany(
        [receiver, secReceiver],
        [firstAmount, secondAmount],
        { from: sender },
      );
      const senderBalanceAfter = await tokenInstance.balanceOf.call(sender);
      const firstReceiverBalanceAfter = await tokenInstance.balanceOf.call(
        receiver,
      );
      const secondReceiverBalanceAfter = await tokenInstance.balanceOf.call(
        secReceiver,
      );
      await assert.equal(
        toBN(firstReceiverBalanceBefore).add(toBN(firstAmount)).toString(),
        toBN(firstReceiverBalanceAfter).toString(),
        'Wrong first receiver balance',
      );
      await assert.equal(
        toBN(secondReceiverBalanceBefore).add(toBN(secondAmount)).toString(),
        toBN(secondReceiverBalanceAfter).toString(),
        'Wrong second receiver balance',
      );
      await assert.equal(
        toBN(senderBalanceBefore)
          .sub(toBN(firstAmount))
          .sub(toBN(secondAmount))
          .toString(),
        toBN(senderBalanceAfter).toString(),
        'Wrong sender balance',
      );
    });
  });

  describe('Should support meta-sig', () => {
    it('Can transfer using metasig', async () => {
      await tokenInstance.transfer(sender, totalSupply, { from: receiver });
      const senderBalanceBefore = await tokenInstance.balanceOf.call(sender);
      const receiverBalanceBefore = await tokenInstance.balanceOf.call(
        receiver,
      );
      const amount = toWei('1000000');
      const transferData = web3.eth.abi.encodeFunctionCall(
        {
          name: 'transfer',
          type: 'function',
          inputs: [
            {
              type: 'address',
              name: 'to',
            },
            {
              type: 'uint256',
              name: 'amount',
            },
          ],
        },
        [receiver, amount],
      );
      nonce = (await forwarder.getNonce.call(sender)).toString();
      const networkId = await web3.eth.net.getId();
      const transferMetaTxSignature = generateForwarderSignature(
        sender,
        tokenInstance.address,
        0,
        MAX_GAS,
        nonce,
        transferData,
        networkId,
        forwarder.address,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/0"),
      );
      const forwarderRequest = {
        from: sender,
        to: tokenInstance.address,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: transferData,
      };
      await forwarder.safeExecute(forwarderRequest, transferMetaTxSignature, {
        from: admin,
      });
      const receiverBalanceAfter = await tokenInstance.balanceOf.call(receiver);
      const senderBalanceAfter = await tokenInstance.balanceOf.call(sender);
      await assert.equal(
        toBN(receiverBalanceBefore).add(toBN(amount)).toString(),
        toBN(receiverBalanceAfter).toString(),
        'Wrong receiver balance',
      );
      await assert.equal(
        toBN(senderBalanceBefore).sub(toBN(amount)).toString(),
        toBN(senderBalanceAfter).toString(),
        'Wrong sender balance',
      );
    });
    it('Can use token if no forwarder is set in the finder', async () => {
      const forwarderInterface = await web3.utils.stringToHex(
        'TrustedForwarder',
      );
      await finder.changeImplementationAddress(
        forwarderInterface,
        ZERO_ADDRESS,
        { from: maintainer },
      );
      await tokenInstance.transfer(sender, totalSupply, { from: receiver });
    });
  });
});
