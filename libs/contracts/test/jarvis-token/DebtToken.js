const { artifacts, contract } = require('hardhat');
const { assert, AssertionError } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const { toWei, hexToUtf8, toBN, utf8ToHex } = web3Utils;
const truffleAssert = require('truffle-assertions');

const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');
const DebtToken = artifacts.require('DebtToken');

contract('Debt Token Contract', accounts => {
  let jFiat,
    debtToken,
    ratio = toWei('1.2');
  let roles = {
    admin: accounts[0],
    maintainer: accounts[1],
  };
  let user1 = accounts[4];
  let user2 = accounts[5];
  let jrtAmount = toWei('50');

  before(async () => {
    jFiat = await TestnetSelfMintingERC20.new('Jarvis Euro', 'jEur', 18, {
      from: accounts[0],
    });
    debtToken = await DebtToken.new(
      jFiat.address,
      'Jarvis Debt Euro',
      'debt-JEur',
      roles,
      {
        from: accounts[0],
      },
    );

    // allocaate jrt
    await jFiat.addMinter(accounts[0], { from: accounts[0] });
    await jFiat.addBurner(debtToken.address, { from: accounts[0] });

    await jFiat.mint(user1, jrtAmount.toString(), { from: accounts[0] });
    await jFiat.mint(user2, jrtAmount.toString(), { from: accounts[0] });
  });

  describe('Lifecycle', () => {
    it('Allows to deposit jFiat as donation', async () => {
      let userBalanceBefore = await jFiat.balanceOf.call(user1);
      let debtTokenBalanceBefore = await debtToken.balanceOf.call(user1);
      let totalDepositBefore = await debtToken.donated.call();
      let amount = toWei('10');

      await jFiat.approve(debtToken.address, amount, { from: user1 });
      let tx = await debtToken.deposit(amount, true, { from: user1 });
      truffleAssert.eventEmitted(tx, 'Donated', ev => {
        return ev.user == user1 && ev.amount.toString() == amount.toString();
      });

      let totalDepositAfter = await debtToken.donated.call();
      assert.equal(
        totalDepositAfter.toString(),
        toBN(totalDepositBefore).add(toBN(amount)).toString(),
      );

      let userBalanceAfter = await jFiat.balanceOf.call(user1);
      let debtTokenBalanceAfter = await debtToken.balanceOf.call(user1);

      assert.equal(
        userBalanceAfter.toString(),
        toBN(userBalanceBefore).sub(toBN(amount)).toString(),
      );
      assert.equal(
        debtTokenBalanceAfter.toString(),
        toBN(debtTokenBalanceBefore).toString(),
      );
    });

    it('Allows to deposit jFiat and bond to receive debt token', async () => {
      let userBalanceBefore = await jFiat.balanceOf.call(user1);
      let debtTokenBalanceBefore = await debtToken.balanceOf.call(user1);
      let totalBondedBefore = await debtToken.bonded.call();

      let amount = toWei('10');

      await jFiat.approve(debtToken.address, amount, { from: user1 });
      let tx = await debtToken.deposit(amount, false, { from: user1 });
      truffleAssert.eventEmitted(tx, 'Bonded', ev => {
        return ev.user == user1 && ev.amount.toString() == amount.toString();
      });

      let totalBondedAfter = await debtToken.bonded.call();
      assert.equal(
        totalBondedAfter.toString(),
        toBN(totalBondedBefore).add(toBN(amount)).toString(),
      );

      let userBalanceAfter = await jFiat.balanceOf.call(user1);
      let debtTokenBalanceAfter = await debtToken.balanceOf.call(user1);

      assert.equal(
        userBalanceAfter.toString(),
        toBN(userBalanceBefore).sub(toBN(amount)).toString(),
      );
      assert.equal(
        debtTokenBalanceAfter.toString(),
        toBN(debtTokenBalanceBefore).add(toBN(amount)).toString(),
      );
    });

    it('Only maintainer can withdraw bonded jFiat', async () => {
      let maintainerBalanceBefore = await jFiat.balanceOf.call(
        roles.maintainer,
      );
      let contractBalanceBefore = await jFiat.balanceOf.call(debtToken.address);
      let totalWithdrawnBefore = await debtToken.withdrawn.call();

      let amount = toWei('10');

      let tx = await debtToken.withdrawBondedJFiat(amount, roles.maintainer, {
        from: roles.maintainer,
      });
      truffleAssert.eventEmitted(tx, 'Withdrawn', ev => {
        return (
          ev.recipient == roles.maintainer &&
          ev.amount.toString() == amount.toString()
        );
      });

      let maintainerBalanceAfter = await jFiat.balanceOf.call(roles.maintainer);
      let contractBalanceAfter = await jFiat.balanceOf.call(debtToken.address);
      let totalWithdrawnAfter = await debtToken.withdrawn.call();

      assert.equal(
        totalWithdrawnAfter.toString(),
        toBN(totalWithdrawnBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        maintainerBalanceAfter.toString(),
        toBN(maintainerBalanceBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        contractBalanceAfter.toString(),
        toBN(contractBalanceBefore).sub(toBN(amount)).toString(),
      );
    });

    it('Only maintainer can deposit and burn withdrawn jFiat', async () => {
      let maintainerBalanceBefore = await jFiat.balanceOf.call(
        roles.maintainer,
      );
      let contractBalanceBefore = await jFiat.balanceOf.call(debtToken.address);
      let totalWithdrawnBefore = await debtToken.withdrawn.call();

      let amountDeposit = toWei('5');
      let amountBurn = toWei('5');

      await jFiat.approve(debtToken.address, toWei('10'), {
        from: roles.maintainer,
      });

      // deposit to burn
      let tx = await debtToken.depositBondedJFiat(amountBurn, true, {
        from: roles.maintainer,
      });
      truffleAssert.eventEmitted(tx, 'Deposited', ev => {
        return ev.burn == true && ev.amount.toString() == amountBurn.toString();
      });

      let maintainerBalanceAfter = await jFiat.balanceOf.call(roles.maintainer);
      let contractBalanceAfter = await jFiat.balanceOf.call(debtToken.address);
      let totalWithdrawnAfter = await debtToken.withdrawn.call();

      assert.equal(
        totalWithdrawnAfter.toString(),
        toBN(totalWithdrawnBefore).sub(toBN(amountBurn)).toString(),
      );
      assert.equal(
        maintainerBalanceAfter.toString(),
        toBN(maintainerBalanceBefore).sub(toBN(amountBurn)).toString(),
      );
      assert.equal(
        contractBalanceAfter.toString(),
        toBN(contractBalanceBefore).toString(),
      );

      // deposit no burn
      tx = await debtToken.depositBondedJFiat(amountDeposit, false, {
        from: roles.maintainer,
      });
      truffleAssert.eventEmitted(tx, 'Deposited', ev => {
        return (
          ev.burn == false && ev.amount.toString() == amountDeposit.toString()
        );
      });

      let maintainerBalanceFinal = await jFiat.balanceOf.call(roles.maintainer);
      let contractBalanceFinal = await jFiat.balanceOf.call(debtToken.address);
      let totalWithdrawnFinal = await debtToken.withdrawn.call();

      assert.equal(
        totalWithdrawnFinal.toString(),
        toBN(totalWithdrawnAfter).sub(toBN(amountDeposit)).toString(),
      );
      assert.equal(
        maintainerBalanceFinal.toString(),
        toBN(maintainerBalanceAfter).sub(toBN(amountDeposit)).toString(),
      );
      assert.equal(
        contractBalanceFinal.toString(),
        toBN(contractBalanceAfter).add(toBN(amountDeposit)).toString(),
      );
    });
  });
});
