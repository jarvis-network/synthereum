const { artifacts, contract } = require('hardhat');
const { assert, AssertionError } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const { toWei, hexToUtf8, toBN, utf8ToHex } = web3Utils;
const truffleAssert = require('truffle-assertions');

const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');
const Migration = artifacts.require('JrtToJarvisMigrator');

contract('JRT to JARVIS migration', accounts => {
  let jrtToken,
    jarvisToken,
    migrationContract,
    ratio = toWei('1.2');
  let roles = {
    admin: accounts[0],
    maintainer: accounts[1],
  };
  let user1 = accounts[4];
  let user2 = accounts[5];
  let jrtAmount = toWei('50');
  let preMintJarvisAmount = toWei('1000');

  before(async () => {
    jrtToken = await TestnetSelfMintingERC20.new(
      'Jarvis Reward Token',
      'jrt',
      18,
      { from: accounts[0] },
    );
    jarvisToken = await TestnetSelfMintingERC20.new(
      'Jarvis Token',
      'JARVIS',
      18,
      { from: accounts[0] },
    );
    migrationContract = await Migration.new(
      jrtToken.address,
      jarvisToken.address,
      ratio,
      roles,
      { from: accounts[0] },
    );

    // allocaate jrt
    await jrtToken.addMinter(accounts[0], { from: accounts[0] });
    await jrtToken.mint(user1, jrtAmount.toString(), { from: accounts[0] });
    await jrtToken.mint(user2, jrtAmount.toString(), { from: accounts[0] });

    // allocate jarvis to no mint contractù
    await jarvisToken.addMinter(accounts[0], {
      from: accounts[0],
    });
    await jarvisToken.mint(migrationContract.address, preMintJarvisAmount, {
      from: accounts[0],
    });
  });

  describe('Migration with pre minted JARVIS', () => {
    it('Setup contract', async () => {
      let actualJRT = await migrationContract.JRT.call();
      assert.equal(actualJRT, jrtToken.address);

      let actualJarvis = await migrationContract.JARVIS.call();
      assert.equal(actualJarvis, jarvisToken.address);

      let ratio = await migrationContract.JRT_JARVIS_RATIO.call();
      assert.equal(ratio.toString(), ratio.toString());

      let activationBlock = await migrationContract.activationBlock.call();
      assert.equal(activationBlock.toString(), '0');
    });

    it('Only maintainer should set migration starting block', async () => {
      let activationBlock = toBN(await web3.eth.getBlockNumber())
        .add(toBN(10))
        .toString();
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
        migrationContract.setActivationBlock(0, {
          from: roles.maintainer,
        }),
        'Err',
      );
    });

    it('Correctly performs token migration', async () => {
      let activationBlock = toBN(await web3.eth.getBlockNumber())
        .add(toBN(1))
        .toString();
      await migrationContract.setActivationBlock(activationBlock, {
        from: roles.maintainer,
      });

      let jarvisContractBalanceBefore = await jarvisToken.balanceOf.call(
        migrationContract.address,
      );

      let res = await migrationContract.getTotalMigration();
      let jrtMigratedBefore = res.jrtMigrated;
      let jarvisMintedBefore = res.jarvisDistributed;

      let userAmount1 = toBN(jrtAmount).divn(2).toString();
      let expectedJARVIS = toBN(userAmount1)
        .mul(toBN(Math.pow(10, 18)))
        .div(toBN(ratio));

      let userJRTBalanceBefore = await jrtToken.balanceOf(user1);
      let userJARVISBalanceBefore = await jarvisToken.balanceOf(user1);

      await jrtToken.approve(migrationContract.address, userAmount1, {
        from: user1,
      });
      let tx = await migrationContract.migrateFromJRT(userAmount1, {
        from: user1,
      });
      truffleAssert.eventEmitted(tx, 'JrtMigrated', ev => {
        return (
          ev.sender == user1 &&
          ev.jrtAmount.toString() == userAmount1.toString() &&
          ev.jarvisAmount.toString() == expectedJARVIS.toString()
        );
      });
      let jarvisContractBalanceAfter = await jarvisToken.balanceOf.call(
        migrationContract.address,
      );

      res = await migrationContract.getTotalMigration();
      let jrtMigratedAfter = res.jrtMigrated;
      let jarvisMintedAfter = res.jarvisDistributed;
      let userJRTBalanceAfter = await jrtToken.balanceOf(user1);
      let userJARVISBalanceAfter = await jarvisToken.balanceOf(user1);

      assert.equal(
        jarvisContractBalanceAfter.toString(),
        toBN(jarvisContractBalanceBefore).sub(expectedJARVIS).toString(),
      );
      assert.equal(
        jarvisMintedAfter.toString(),
        toBN(jarvisMintedBefore).add(expectedJARVIS).toString(),
      );
      assert.equal(
        jrtMigratedAfter.toString(),
        toBN(jrtMigratedBefore).add(toBN(userAmount1)).toString(),
      );
      assert.equal(
        userJARVISBalanceAfter.toString(),
        toBN(userJARVISBalanceBefore).add(expectedJARVIS).toString(),
      );
      assert.equal(
        userJRTBalanceAfter.toString(),
        toBN(userJRTBalanceBefore).sub(toBN(userAmount1)).toString(),
      );
    });

    it('Should allow maintainer to withdraw JARVIS', async () => {
      let jarvisContractBalanceBefore = await jarvisToken.balanceOf.call(
        migrationContract.address,
      );
      let jarvisMaintainerBalanceBefore = await jarvisToken.balanceOf.call(
        roles.maintainer,
      );
      let amountOut = toWei('5');

      let tx = await migrationContract.withdrawJARVIS(amountOut, {
        from: roles.maintainer,
      });
      truffleAssert.eventEmitted(tx, 'Withdrawn', ev => {
        return (
          ev.recipient == roles.maintainer &&
          ev.amount.toString() == amountOut.toString()
        );
      });

      let jarvisContractBalanceAfter = await jarvisToken.balanceOf.call(
        migrationContract.address,
      );
      let jarvisMaintainerBalanceAfter = await jarvisToken.balanceOf.call(
        roles.maintainer,
      );

      assert.equal(
        jarvisContractBalanceAfter.toString(),
        toBN(jarvisContractBalanceBefore).sub(toBN(amountOut)).toString(),
      );
      assert.equal(
        jarvisMaintainerBalanceAfter.toString(),
        toBN(jarvisMaintainerBalanceBefore).add(toBN(amountOut)).toString(),
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
        migrationContract.migrateFromJRT(1, { from: user1 }),
        'Not active',
      );
    });
  });
});
