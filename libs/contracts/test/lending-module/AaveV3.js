const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');
const LendingModule = artifacts.require('AaveV3Module');
const PoolMock = artifacts.require('PoolLendingMock');
const LendingProxy = artifacts.require('LendingProxy');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const PoolStorageManager = artifacts.require('PoolStorageManager');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const AToken = artifacts.require('ATokenMock');
const AAVE = artifacts.require('AAVEMock');
const JRTSWAP = artifacts.require('JRTSwapModule');
const data = require('../../data/test/lendingTestnet.json');
const {
  collapseTextChangeRangesAcrossMultipleVersions,
} = require('typescript');

const { toBN, toWei, toHex } = web3Utils;

contract('AaveV3 Lending module', accounts => {
  let finder, poolMock, module, proxy, storageManager, networkId;
  let aUSDC, USDC, USDCInstance, aaveInstance;
  const maintainer = accounts[1];
  const daoInterestShare = toWei('0.04');
  const jrtShare = toWei('0.4');
  const commissionShare = toWei('0.6');

  const openCDP = async (deposit, borrow, from) => {
    let am = toBN(deposit).divn(50).toString();
    let half = toBN(deposit).divn(2).toString();
    await USDCInstance.mint(from, deposit);
    await USDCInstance.approve(data[networkId].AaveV3, deposit, { from });
    await aaveInstance.supply(USDC, half, from, toHex('0'), { from });
    await aaveInstance.borrow(USDC, borrow, 2, toHex('0'), from, { from });

    // produce more blocks and interest
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });
    await aaveInstance.supply(USDC, am, from, toHex('0'), { from });

    // repay all debt
    let tx = await aaveInstance.getUserAccountData.call(from);
    await USDCInstance.increaseAllowance(
      data[networkId].AaveV3,
      tx.totalDebtBase.toString(),
      { from },
    );
    await aaveInstance.repay(USDC, tx.totalDebtBase.toString(), 2, from, {
      from,
    });
  };

  before(async () => {
    networkId = await web3.eth.net.getId();
    finder = await SynthereumFinder.deployed();
    storageManager = await PoolStorageManager.new(finder.address);
    proxy = await LendingProxy.new(
      finder.address,
      storageManager.address,
      maintainer,
    );
    aUSDC = await AToken.at(data[networkId].aUSDC);
    USDC = await aUSDC.UNDERLYING_ASSET_ADDRESS.call();
    USDCInstance = await TestnetSelfMintingERC20.at(USDC);

    jEUR = await SyntheticToken.new('jarvis euro', 'jEUR', 18, {
      from: accounts[0],
    });
    aaveInstance = await AAVE.at(data[networkId].AaveV3);
    module = await LendingModule.new();
    poolMock = await PoolMock.new(
      USDC,
      jEUR.address,
      proxy.address,
      storageManager.address,
      { from: maintainer },
    );
    await finder.changeImplementationAddress(
      web3Utils.utf8ToHex('LendingProxy'),
      proxy.address,
      { from: maintainer },
    );
  });

  describe('Pool storage manager', async () => {
    it('Allows maintainer to set a pool', async () => {
      await proxy.setLendingModule(module.address, 'aave', {
        from: maintainer,
      });
      let args = web3.eth.abi.encodeParameters(
        ['address'],
        [data[networkId].AaveV3],
      );
      await proxy.setPool(
        poolMock.address,
        USDC,
        'aave',
        args,
        aUSDC.address,
        daoInterestShare,
        jrtShare,
        { from: maintainer },
      );

      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      assert.equal(poolStorage.lendingModule, module.address);
      assert.equal(poolStorage.collateral, USDC);
      assert.equal(poolStorage.interestBearingToken, aUSDC.address);
      assert.equal(
        poolStorage.daoInterestShare.toString(),
        daoInterestShare.toString(),
      );
      assert.equal(poolStorage.JRTBuybackShare.toString(), jrtShare.toString());
    });
  });
  describe('AAVe module', () => {
    const user = accounts[2];
    let amountMint = toWei('1000000');
    let amountFirstDeposit = toWei('340000');

    it('First deposit- Correctly deposits and update values', async () => {
      await USDCInstance.mint(user, amountMint);
      let userUSDCBefore = await USDCInstance.balanceOf.call(user);
      assert.equal(userUSDCBefore.toString(), amountMint.toString());

      let userAUSDCBefore = await aUSDC.balanceOf.call(user);
      let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);
      await USDCInstance.approve(poolMock.address, amountFirstDeposit, {
        from: user,
      });

      let returnValues = await poolMock.deposit.call(amountFirstDeposit, USDC, {
        from: user,
      });
      await poolMock.deposit(amountFirstDeposit, USDC, { from: user });

      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      let userUSDCAfter = await USDCInstance.balanceOf.call(user);
      let userAUSDCAfter = await aUSDC.balanceOf.call(user);
      let poolAUSDCAfter = await aUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

      // check return values to pool
      assert.equal(
        returnValues.tokensOut.toString(),
        amountFirstDeposit.toString(),
      );
      assert.equal(returnValues.poolInterest.toString(), '0');
      assert.equal(returnValues.daoInterest.toString(), '0');

      // check tokens have moved correctly
      assert.equal(
        userUSDCAfter.toString(),
        userUSDCBefore.sub(toBN(amountFirstDeposit)).toString(),
      );
      assert.equal(userAUSDCBefore.toString(), userAUSDCAfter.toString());
      assert.equal(
        poolAUSDCAfter.toString(),
        poolAUSDCBefore.add(toBN(amountFirstDeposit)).toString(),
      );
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      assert.equal(
        poolStorage.collateralDeposited.toString(),
        amountFirstDeposit.toString(),
      );
      assert.equal(poolStorage.unclaimedDaoJRT.toString(), '0');
      assert.equal(poolStorage.unclaimedDaoCommission.toString(), '0');
    });

    it('Subsequent deposit- Correctly deposits and update values, interest', async () => {
      let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);

      // borrow on aave to generate interest
      await openCDP(toWei('100000000'), toWei('40000000'), accounts[3]);

      let userUSDCBefore = await USDCInstance.balanceOf.call(user);
      assert.equal(
        userUSDCBefore.toString(),
        toBN(amountMint).sub(toBN(amountFirstDeposit)).toString(),
      );
      let poolStorageBefore = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      let userAUSDCBefore = await aUSDC.balanceOf.call(user);
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);

      // deposit to trigger interest split update
      let amountDeposit = toWei('1');
      await USDCInstance.approve(poolMock.address, amountDeposit, {
        from: user,
      });

      let returnValues = await poolMock.deposit.call(amountDeposit, USDC, {
        from: user,
      });
      await poolMock.deposit(amountDeposit, USDC, { from: user });
      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      let userUSDCAfter = await USDCInstance.balanceOf.call(user);
      let userAUSDCAfter = await aUSDC.balanceOf.call(user);
      let poolAUSDCAfter = await aUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

      let expectedInterest = poolAUSDCAfter
        .sub(poolAUSDCBefore)
        .sub(toBN(amountDeposit));
      let expectedDaoInterest = expectedInterest
        .mul(toBN(daoInterestShare))
        .div(toBN(Math.pow(10, 18)));
      let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

      // check return values to pool
      assert.equal(returnValues.tokensOut.toString(), amountDeposit.toString());
      assert.equal(
        returnValues.poolInterest.toString().substr(0, 13),
        expectedPoolInterest.toString().substr(0, 13),
      );
      assert.equal(
        returnValues.daoInterest.toString().substr(0, 13),
        expectedDaoInterest.toString().substr(0, 13),
      );

      // check tokens have moved correctly
      assert.equal(
        userUSDCAfter.toString(),
        userUSDCBefore.sub(toBN(amountDeposit)).toString(),
      );
      assert.equal(userAUSDCBefore.toString(), userAUSDCAfter.toString());
      assert.equal(
        poolAUSDCAfter.toString().substr(0, 14),
        poolAUSDCBefore
          .add(toBN(amountDeposit))
          .add(toBN(returnValues.poolInterest))
          .add(toBN(returnValues.daoInterest))
          .toString()
          .substr(0, 14),
      );
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(expectedPoolInterest)
        .add(toBN(amountDeposit))
        .toString();
      assert.equal(
        poolStorage.collateralDeposited.toString().substr(0, 20),
        expectedCollateral.substr(0, 20),
      );

      let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
        .add(
          toBN(returnValues.daoInterest)
            .mul(toBN(jrtShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();
      assert.equal(
        poolStorage.unclaimedDaoJRT.substr(0, 13),
        expectedUnclaimedJRT.substr(0, 13),
      );

      let expectedDaoCommisson = toBN(poolStorageBefore.unclaimedDaoCommission)
        .add(
          toBN(returnValues.daoInterest)
            .mul(toBN(commissionShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();
      assert.equal(
        poolStorage.unclaimedDaoCommission.toString().substr(0, 14),
        expectedDaoCommisson.substr(0, 14),
      );
    });

    it('First Withdraw - Correctly withdraw and update values, interest', async () => {
      let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);

      // borrow on aave to generate interest
      await openCDP(toWei('100000000'), toWei('40000000'), accounts[3]);

      let amountWithdraw = toWei('1');
      let userAUSDCBefore = await aUSDC.balanceOf.call(user);
      let userUSDCBefore = await USDCInstance.balanceOf.call(user);
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);
      let poolStorageBefore = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      // withdraw
      let returnValues = await poolMock.withdraw.call(
        amountWithdraw,
        user,
        aUSDC.address,
        {
          from: user,
        },
      );
      await poolMock.withdraw(amountWithdraw, user, aUSDC.address, {
        from: user,
      });

      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      let userUSDCAfter = await USDCInstance.balanceOf.call(user);
      let userAUSDCAfter = await aUSDC.balanceOf.call(user);
      let poolAUSDCAfter = await aUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

      let expectedInterest = poolAUSDCAfter
        .add(toBN(amountWithdraw))
        .sub(poolAUSDCBefore);

      let expectedDaoInterest = expectedInterest
        .mul(toBN(daoInterestShare))
        .div(toBN(Math.pow(10, 18)));

      let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

      // check return values to pool
      assert.equal(
        returnValues.tokensOut.toString(),
        amountWithdraw.toString(),
      );
      assert.equal(
        returnValues.poolInterest.toString().substr(0, 13),
        expectedPoolInterest.toString().substr(0, 13),
      );
      assert.equal(
        returnValues.daoInterest.toString().substr(0, 13),
        expectedDaoInterest.toString().substr(0, 13),
      );

      // check tokens have moved correctly
      assert.equal(
        userUSDCAfter.toString(),
        userUSDCBefore.add(toBN(returnValues.tokensOut)).toString(),
      );
      assert.equal(userAUSDCBefore.toString(), userAUSDCAfter.toString());
      assert.equal(
        poolAUSDCAfter.toString().substr(0, 14),
        poolAUSDCBefore
          .sub(toBN(amountWithdraw))
          .add(toBN(returnValues.poolInterest))
          .add(toBN(returnValues.daoInterest))
          .toString()
          .substr(0, 14),
      );
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(expectedPoolInterest)
        .sub(toBN(amountWithdraw))
        .toString();
      assert.equal(
        poolStorage.collateralDeposited.toString().substr(0, 20),
        expectedCollateral.substr(0, 20),
      );

      let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
        .add(
          toBN(returnValues.daoInterest)
            .mul(toBN(jrtShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();
      assert.equal(
        poolStorage.unclaimedDaoJRT.toString(),
        expectedUnclaimedJRT,
      );

      let expectedDaoCommisson = toBN(poolStorageBefore.unclaimedDaoCommission)
        .add(
          toBN(returnValues.daoInterest)
            .mul(toBN(commissionShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();
      assert.equal(
        poolStorage.unclaimedDaoCommission.toString(),
        expectedDaoCommisson,
      );
    });

    it('Correctly claim commissions', async () => {
      let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);

      // borrow on aave to generate interest
      await openCDP(toWei('100000000'), toWei('40000000'), accounts[3]);

      // sets recipient
      let commissionReceiver = accounts[4];
      await finder.changeImplementationAddress(
        web3Utils.utf8ToHex('CommissionReceiver'),
        commissionReceiver,
        { from: maintainer },
      );

      let commissionUSDCBefore = await USDCInstance.balanceOf.call(
        commissionReceiver,
      );

      let poolStorageBefore = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);

      // claim commission
      let amount = (await storageManager.getPoolStorage.call(poolMock.address))
        .unclaimedDaoCommission;

      let returnValues = await poolMock.claimCommission.call(
        amount,
        aUSDC.address,
        {
          from: accounts[0],
        },
      );
      await poolMock.claimCommission(amount, aUSDC.address, {
        from: accounts[0],
      });
      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      let commissionUSDCAfter = await USDCInstance.balanceOf.call(
        commissionReceiver,
      );
      let poolAUSDCAfter = await aUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

      let expectedInterest = poolAUSDCAfter
        .add(toBN(amount))
        .sub(poolAUSDCBefore);
      let expectedDaoInterest = expectedInterest
        .mul(toBN(daoInterestShare))
        .div(toBN(Math.pow(10, 18)));
      let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

      // check return values to pool
      assert.equal(returnValues.tokensOut.toString(), amount.toString());
      assert.equal(
        returnValues.poolInterest.toString().substr(0, 13),
        expectedPoolInterest.toString().substr(0, 13),
      );
      assert.equal(
        returnValues.daoInterest.toString().substr(0, 13),
        expectedDaoInterest.toString().substr(0, 13),
      );

      // check tokens have moved correctly
      assert.equal(
        commissionUSDCAfter.toString(),
        commissionUSDCBefore.add(toBN(amount)).toString(),
      );
      assert.equal(
        poolAUSDCAfter.toString().substr(0, 14),
        poolAUSDCBefore
          .add(toBN(returnValues.poolInterest))
          .add(toBN(returnValues.daoInterest))
          .sub(toBN(amount))
          .toString()
          .substr(0, 14),
      );
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(toBN(returnValues.poolInterest))
        .toString();
      assert.equal(
        poolStorage.collateralDeposited.toString().substr(0, 20),
        expectedCollateral.substr(0, 20),
      );

      let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
        .add(
          toBN(returnValues.daoInterest)
            .mul(toBN(jrtShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();
      assert.equal(
        poolStorage.unclaimedDaoJRT.substr(0, 13),
        expectedUnclaimedJRT.substr(0, 13),
      );

      let expectedDaoCommisson = toBN(returnValues.daoInterest)
        .mul(toBN(commissionShare))
        .div(toBN(Math.pow(10, 18)))
        .toString();

      assert.equal(
        poolStorage.unclaimedDaoCommission.toString().substr(0, 14),
        expectedDaoCommisson.substr(0, 14),
      );
    });

    // it('Correctly claim and swap to JRT', async () => {
    //   let jrtSwap = await JRTSWAP.new();
    //   await proxy.setSwapModule(jrtSwap.address, USDC);

    //   let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);

    //    // borrow on aave to generate interest
    //    await openCDP(toWei('100000000'), toWei('40000000'), accounts[3]);

    //   // sets recipient
    //   let buybackReceiver = accounts[4];
    //   await finder.changeImplementationAddress(
    //     web3Utils.utf8ToHex('BuybackProgramReceiver'),
    //     buybackReceiver,
    //     { from: maintainer },
    //   );

    //   let receiverUSDCBefore = await USDCInstance.balanceOf.call(buybackReceiver);

    //   let poolStorageBefore = await storageManager.getPoolStorage.call(
    //     poolMock.address,
    //   );
    //   let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);

    //   // claim commission
    //   let amount = (
    //     await storageManager.getPoolStorage.call(poolMock.address)
    //   ).unclaimedDaoJRT;

    //   let returnValues = await poolMock.executeBuyback.call(amount, aUSDC.address, {
    //     from: accounts[0],
    //   });
    //   await poolMock.claimCommission(amount, aUSDC.address, {
    //     from: accounts[0],
    //   });
    //   let poolStorage = await storageManager.getPoolStorage.call(
    //     poolMock.address,
    //   );
    //   let commissionUSDCAfter = await USDCInstance.balanceOf.call(buybackReceiver);
    //   let poolAUSDCAfter = await aUSDC.balanceOf.call(poolMock.address);
    //   let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

    //   let expectedInterest = poolAUSDCAfter
    //     .add(toBN(amount))
    //     .sub(poolAUSDCBefore);
    //   let expectedDaoInterest = expectedInterest
    //     .mul(toBN(daoInterestShare))
    //     .div(toBN(Math.pow(10, 18)));
    //   let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

    //    // check return values to pool
    //    assert.equal(returnValues.tokensOut.toString(), amount.toString());
    //    assert.equal(
    //      returnValues.poolInterest.toString().substr(0, 13),
    //      expectedPoolInterest.toString().substr(0, 13),
    //    );
    //    assert.equal(
    //      returnValues.daoInterest.toString().substr(0, 13),
    //      expectedDaoInterest.toString().substr(0, 13),
    //    );

    //   // check tokens have moved correctly
    //   assert.equal(
    //     commissionUSDCAfter.toString(),
    //     receiverUSDCBefore.add(toBN(amount)).toString(),
    //   );
    //   assert.equal(
    //     poolAUSDCAfter.toString().substr(0, 14),
    //     poolAUSDCBefore
    //       .add(toBN(returnValues.poolInterest))
    //       .add(toBN(returnValues.daoInterest))
    //       .sub(toBN(amount))
    //       .toString()
    //       .substr(0, 14),
    //   );
    //   assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

    //   // check pool storage update on proxy
    //   let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
    //     .add(toBN(returnValues.poolInterest))
    //     .toString();
    //   assert.equal(
    //     poolStorage.collateralDeposited.toString().substr(0, 20),
    //     expectedCollateral.substr(0, 20),
    //   );

    //   let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
    //     .add(
    //       toBN(returnValues.daoInterest)
    //         .mul(toBN(jrtShare))
    //         .div(toBN(Math.pow(10, 18))),
    //     )
    //     .toString();
    //   assert.equal(
    //     poolStorage.unclaimedDaoJRT.substr(0, 13),
    //     expectedUnclaimedJRT.substr(0, 13),
    //   );

    //   let expectedDaoCommisson = toBN(returnValues.daoInterest)
    //     .mul(toBN(commissionShare))
    //     .div(toBN(Math.pow(10, 18))).toString();

    //   assert.equal(
    //     poolStorage.unclaimedDaoCommission.toString().substr(0, 14),
    //     expectedDaoCommisson.substr(0, 14),
    //   );
    // });
  });
});
