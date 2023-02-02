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

  const finalCheck = async debtToken => {
    const jAssetBalance = toBN(await debtToken.jFiatBalance.call());
    const donated = toBN(await debtToken.donated.call());
    const bonded = toBN(await debtToken.bonded.call());
    const withdrawn = toBN(await debtToken.withdrawn.call());
    assert.equal(
      jAssetBalance.toString(),
      donated.add(bonded).sub(withdrawn).toString(),
    );
    const sentAmount = toBN(toWei('15'));
    await jFiat.mint(user1, sentAmount.toString(), { from: accounts[0] });
    await jFiat.transfer(debtToken.address, sentAmount.toString(), {
      from: user1,
    });
    const jAssetBalanceAfter = toBN(await debtToken.jFiatBalance.call());
    const donatedAfter = toBN(await debtToken.donated.call());
    assert.equal(
      jAssetBalanceAfter.toString(),
      jAssetBalance.add(sentAmount).toString(),
    );
    assert.equal(donatedAfter.toString(), donated.add(sentAmount).toString());
    assert.equal(
      jAssetBalanceAfter.toString(),
      donatedAfter.add(bonded).sub(withdrawn).toString(),
    );
  };

  describe('Lifecycle', () => {
    afterEach(async () => {
      await finalCheck(debtToken);
    });
    it('Allows to deposit jFiat as donation', async () => {
      assert.equal(
        jFiat.address,
        await debtToken.jAsset.call(),
        'Wrong j-asset',
      );
      let userBalanceBefore = await jFiat.balanceOf.call(user1);
      let contractBalanceBefore = await jFiat.balanceOf.call(debtToken.address);
      let debtTokenBalanceBefore = await debtToken.balanceOf.call(user1);
      let totalDepositBefore = await debtToken.donated.call();
      let amount = toWei('10');

      await jFiat.approve(debtToken.address, amount, { from: user1 });
      let tx = await debtToken.depositJFiat(amount, true, {
        from: user1,
      });
      truffleAssert.eventEmitted(tx, 'Donated', ev => {
        return ev.user == user1 && ev.amount.toString() == amount.toString();
      });

      let totalDepositAfter = await debtToken.donated.call();
      assert.equal(
        totalDepositAfter.toString(),
        toBN(totalDepositBefore).add(toBN(amount)).toString(),
      );

      let userBalanceAfter = await jFiat.balanceOf.call(user1);
      let contractBalanceAfter = await jFiat.balanceOf.call(debtToken.address);
      let debtTokenBalanceAfter = await debtToken.balanceOf.call(user1);

      assert.equal(
        userBalanceAfter.toString(),
        toBN(userBalanceBefore).sub(toBN(amount)).toString(),
      );
      assert.equal(
        contractBalanceAfter.toString(),
        toBN(contractBalanceBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        debtTokenBalanceAfter.toString(),
        toBN(debtTokenBalanceBefore).toString(),
      );
    });

    it('Allows to deposit jFiat and bond to receive debt token', async () => {
      let userBalanceBefore = await jFiat.balanceOf.call(user1);
      let debtTokenBalanceBefore = await debtToken.balanceOf.call(user1);
      let contractBalanceBefore = await jFiat.balanceOf.call(debtToken.address);
      let totalBondedBefore = await debtToken.bonded.call();

      let amount = toWei('10');

      await jFiat.approve(debtToken.address, amount, { from: user1 });
      let tx = await debtToken.depositJFiat(amount, false, { from: user1 });
      truffleAssert.eventEmitted(tx, 'Bonded', ev => {
        return ev.user == user1 && ev.amount.toString() == amount.toString();
      });

      let totalBondedAfter = await debtToken.bonded.call();
      assert.equal(
        totalBondedAfter.toString(),
        toBN(totalBondedBefore).add(toBN(amount)).toString(),
      );

      let userBalanceAfter = await jFiat.balanceOf.call(user1);
      let contractBalanceAfter = await jFiat.balanceOf.call(debtToken.address);
      let debtTokenBalanceAfter = await debtToken.balanceOf.call(user1);

      assert.equal(
        userBalanceAfter.toString(),
        toBN(userBalanceBefore).sub(toBN(amount)).toString(),
      );
      assert.equal(
        contractBalanceAfter.toString(),
        toBN(contractBalanceBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        debtTokenBalanceAfter.toString(),
        toBN(debtTokenBalanceBefore).add(toBN(amount)).toString(),
      );
    });

    it('Maintainer can withdraw bonded jFiat', async () => {
      let receiverBalanceBefore = await jFiat.balanceOf.call(user2);
      let contractBalanceBefore = await jFiat.balanceOf.call(debtToken.address);
      let totalWithdrawnBefore = await debtToken.withdrawn.call();

      let amount = toWei('15');

      let tx = await debtToken.withdrawJFiat(amount, user2, {
        from: roles.maintainer,
      });
      truffleAssert.eventEmitted(tx, 'Withdrawn', ev => {
        return (
          ev.recipient == user2 && ev.amount.toString() == amount.toString()
        );
      });

      let receiverBalanceAfter = await jFiat.balanceOf.call(user2);
      let contractBalanceAfter = await jFiat.balanceOf.call(debtToken.address);
      let totalWithdrawnAfter = await debtToken.withdrawn.call();

      assert.equal(
        totalWithdrawnAfter.toString(),
        toBN(totalWithdrawnBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        receiverBalanceAfter.toString(),
        toBN(receiverBalanceBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        contractBalanceAfter.toString(),
        toBN(contractBalanceBefore).sub(toBN(amount)).toString(),
      );
    });

    it('Revert if a non-maintainer can withdraw bonded jFiat', async () => {
      const amount = '1';
      await truffleAssert.reverts(
        debtToken.withdrawJFiat(amount, user2, {
          from: user1,
        }),
        'Sender must be the maintainer',
      );
    });
  });
});
