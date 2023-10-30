const { artifacts, contract } = require('hardhat');
const { assert, AssertionError } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const { toWei, hexToUtf8, toBN, utf8ToHex } = web3Utils;
const truffleAssert = require('truffle-assertions');

const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');
const Migration = artifacts.require('JarvisToWrapperConverter');

contract('JARVIS to WRAPPER migration', accounts => {
  let jarvisToken, migrationContract;
  let roles = {
    admin: accounts[0],
    maintainer: accounts[1],
  };
  let user1 = accounts[4];
  let user2 = accounts[5];
  let jarvisAmount = toWei('50');
  let preMintWrapperAmount = toWei('1000');

  before(async () => {
    jarvisToken = await TestnetSelfMintingERC20.new(
      'Jarvis Token',
      'JARVIS',
      18,
      { from: accounts[0] },
    );
    wrapper = await TestnetSelfMintingERC20.new(
      'Jarvis Token Wrapped',
      'WJARVIS',
      18,
      { from: accounts[0] },
    );

    // allocaate jrt
    await jarvisToken.addMinter(accounts[0], { from: accounts[0] });
    await jarvisToken.mint(user1, jarvisAmount.toString(), {
      from: accounts[0],
    });
    await jarvisToken.mint(user2, jarvisAmount.toString(), {
      from: accounts[0],
    });

    // allocate jarvis to no mint contractù
    await wrapper.addMinter(accounts[0], {
      from: accounts[0],
    });
  });

  beforeEach(async () => {
    migrationContract = await Migration.new(
      jarvisToken.address,
      wrapper.address,
      roles,
      { from: accounts[0] },
    );
    await wrapper.mint(migrationContract.address, preMintWrapperAmount, {
      from: accounts[0],
    });
  });

  describe('Migration with pre minted JARVIS', () => {
    it('Setup contract', async () => {
      let actualJarvis = await migrationContract.JARVIS.call();
      assert.equal(actualJarvis, jarvisToken.address);

      let actualWrapper = await migrationContract.WRAPPER.call();
      assert.equal(actualWrapper, wrapper.address);

      let activationBlock = await migrationContract.activationBlock.call();
      assert.equal(activationBlock.toString(), '0');
    });

    it('Only maintainer should set migration starting block', async () => {
      let activationBlock = toBN(await web3.eth.getBlockNumber())
        .add(toBN(10))
        .toString();

      await truffleAssert.reverts(
        migrationContract.setActivationBlock(0, {
          from: roles.maintainer,
        }),
        'Wrong block',
      );

      let tx = await migrationContract.setActivationBlock(activationBlock, {
        from: roles.maintainer,
      });

      truffleAssert.eventEmitted(tx, 'MigrationStartBlock', ev => {
        return ev.blockNumber.toString() == activationBlock;
      });

      let block = await migrationContract.activationBlock.call();
      assert.equal(block.toString(), activationBlock.toString());

      await truffleAssert.reverts(
        migrationContract.setActivationBlock(activationBlock, {
          from: accounts[3],
        }),
        'Sender must be the maintainer',
      );
      await truffleAssert.reverts(
        migrationContract.setActivationBlock('10000000000000000', {
          from: roles.maintainer,
        }),
        'Already active',
      );
    });

    it('Correctly performs token migration', async () => {
      let activationBlock = toBN(await web3.eth.getBlockNumber())
        .add(toBN(1))
        .toString();
      await migrationContract.setActivationBlock(activationBlock, {
        from: roles.maintainer,
      });

      let wrapperBalanceBefore = await wrapper.balanceOf.call(
        migrationContract.address,
      );
      let jarvisContractBalanceBefore = await jarvisToken.balanceOf.call(
        migrationContract.address,
      );

      let amountDepositedBefore =
        await migrationContract.getTotalDepositedAmount();

      let userAmount1 = toBN(jarvisAmount);
      let expectedWRAPPER = toBN(jarvisAmount);

      let userJARVISBalanceBefore = await jarvisToken.balanceOf(user1);
      let userWRAPPERBalanceBefore = await wrapper.balanceOf(user1);

      await jarvisToken.approve(migrationContract.address, userAmount1, {
        from: user1,
      });
      let tx = await migrationContract.migrateFromJARVIS(userAmount1, {
        from: user1,
      });
      truffleAssert.eventEmitted(tx, 'JarvisMigrated', ev => {
        return (
          ev.sender == user1 &&
          ev.jarvisAmount.toString() == userAmount1.toString()
        );
      });
      let wrapperContractBalanceAfter = await wrapper.balanceOf.call(
        migrationContract.address,
      );
      let jarvisContractBalanceAfter = await jarvisToken.balanceOf.call(
        migrationContract.address,
      );
      let amountDepositedAfter =
        await migrationContract.getTotalDepositedAmount();
      let userJARVISBalanceAfter = await jarvisToken.balanceOf(user1);
      let userWRAPPERBalanceAfter = await wrapper.balanceOf(user1);

      assert.equal(
        wrapperContractBalanceAfter.toString(),
        toBN(wrapperBalanceBefore).sub(expectedWRAPPER).toString(),
      );
      assert.equal(
        jarvisContractBalanceAfter.toString(),
        toBN(jarvisContractBalanceBefore).add(userAmount1).toString(),
      );
      assert.equal(
        amountDepositedAfter.toString(),
        toBN(amountDepositedBefore).add(userAmount1).toString(),
      );
      assert.equal(
        userWRAPPERBalanceAfter.toString(),
        toBN(userWRAPPERBalanceBefore).add(expectedWRAPPER).toString(),
      );
      assert.equal(
        userJARVISBalanceAfter.toString(),
        toBN(userJARVISBalanceBefore).sub(toBN(userAmount1)).toString(),
      );
    });

    it('Should allow maintainer to withdraw WRAPPER', async () => {
      let wrapperContractBalanceBefore = await wrapper.balanceOf.call(
        migrationContract.address,
      );
      let wrapperMaintainerBalanceBefore = await wrapper.balanceOf.call(
        roles.maintainer,
      );
      let amountOut = toWei('5');

      let tx = await migrationContract.withdrawWRAPPER(amountOut, {
        from: roles.maintainer,
      });
      truffleAssert.eventEmitted(tx, 'Withdrawn', ev => {
        return (
          ev.recipient == roles.maintainer &&
          ev.amount.toString() == amountOut.toString()
        );
      });

      let wrapperContractBalanceAfter = await wrapper.balanceOf.call(
        migrationContract.address,
      );
      let wrapperMaintainerBalanceAfter = await wrapper.balanceOf.call(
        roles.maintainer,
      );

      assert.equal(
        wrapperContractBalanceAfter.toString(),
        toBN(wrapperContractBalanceBefore).sub(toBN(amountOut)).toString(),
      );
      assert.equal(
        wrapperMaintainerBalanceAfter.toString(),
        toBN(wrapperMaintainerBalanceBefore).add(toBN(amountOut)).toString(),
      );
    });

    it('Should not allow migration if not active', async () => {
      let activationBlock = toBN(await web3.eth.getBlockNumber())
        .add(toBN(10))
        .toString();
      await migrationContract.setActivationBlock(activationBlock, {
        from: roles.maintainer,
      });

      await truffleAssert.reverts(
        migrationContract.migrateFromJARVIS(1, { from: user1 }),
        'Not active',
      );
    });
  });
});
