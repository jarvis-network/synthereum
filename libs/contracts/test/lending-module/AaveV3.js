const { artifacts, contract } = require('hardhat');
const { assert, AssertionError } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');
const LendingModule = artifacts.require('AaveV3Module');
const PoolMock = artifacts.require('PoolLendingMock');
const LendingProxy = artifacts.require('LendingProxy');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const LendingStorageManager = artifacts.require('LendingStorageManager');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const AToken = artifacts.require('ATokenMock');
const AAVE = artifacts.require('AAVEMock');
const JRTSWAP = artifacts.require('JRTSwapModule');
const data = require('../../data/test/lendingTestnet.json');

const { toBN, toWei, toHex } = web3Utils;

contract('AaveV3 Lending module', accounts => {
  let finder, poolMock, module, proxy, storageManager, networkId, expiration;
  let aUSDC, USDC, USDCInstance, JRT, JRTInstance, aaveInstance;
  const maintainer = accounts[1];
  const admin = accounts[0];
  const Roles = { admin, maintainer };
  const daoInterestShare = toWei('0.4');
  const jrtShare = toWei('0.5');
  const commissionShare = toWei('0.5');

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
    expiration = (await web3.eth.getBlock('latest')).timestamp + 60000;
    networkId = await web3.eth.net.getId();
    finder = await SynthereumFinder.deployed();
    storageManager = await LendingStorageManager.new(finder.address);
    proxy = await LendingProxy.new(finder.address, Roles);
    aUSDC = await AToken.at(data[networkId].aUSDC);
    USDC = await aUSDC.UNDERLYING_ASSET_ADDRESS.call();
    USDCInstance = await TestnetSelfMintingERC20.at(USDC);

    JRT = data[networkId].JRT;
    JRTInstance = await TestnetSelfMintingERC20.at(JRT);

    jEUR = await SyntheticToken.new('jarvis euro', 'jEUR', 18, {
      from: accounts[0],
    });
    aaveInstance = await AAVE.at(data[networkId].AaveV3);
    module = await LendingModule.new();
    poolMock = await PoolMock.new(USDC, jEUR.address, proxy.address, {
      from: maintainer,
    });
    await finder.changeImplementationAddress(
      web3Utils.utf8ToHex('LendingProxy'),
      proxy.address,
      { from: maintainer },
    );
    await finder.changeImplementationAddress(
      web3Utils.utf8ToHex('LendingStorageManager'),
      storageManager.address,
      { from: maintainer },
    );
    await finder.changeImplementationAddress(
      web3Utils.utf8ToHex('PoolFactory'),
      maintainer,
      { from: maintainer },
    );
  });

  describe('Pool storage manager', async () => {
    it('Allows pool factory to set a pool and lending module', async () => {
      let args = web3.eth.abi.encodeParameters(
        ['address'],
        [data[networkId].AaveV3],
      );
      await proxy.setLendingModule(module.address, args, 'aave', {
        from: maintainer,
      });

      // by specifying the aAtoken
      await storageManager.setPoolStorage(
        poolMock.address,
        USDC,
        'aave',
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

      let expectedBearingToken = await proxy.getInterestBearingToken.call(
        poolMock.address,
      );
      let moduleBearingToken = await module.getInterestBearingToken.call(
        USDC,
        storageManager.address,
      );
      assert.equal(expectedBearingToken, aUSDC.address);
      assert.equal(moduleBearingToken, aUSDC.address);

      // by not specifying the aToken
      await storageManager.setPoolStorage(
        poolMock.address,
        USDC,
        'aave',
        ZERO_ADDRESS,
        daoInterestShare,
        jrtShare,
        { from: maintainer },
      );

      poolStorage = await storageManager.getPoolStorage.call(poolMock.address);
      assert.equal(poolStorage.lendingModule, module.address);
      assert.equal(poolStorage.collateral, USDC);
      assert.equal(poolStorage.interestBearingToken, aUSDC.address);
      assert.equal(
        poolStorage.daoInterestShare.toString(),
        daoInterestShare.toString(),
      );
      assert.equal(poolStorage.JRTBuybackShare.toString(), jrtShare.toString());

      expectedBearingToken = await proxy.getInterestBearingToken.call(
        poolMock.address,
      );
      moduleBearingToken = await module.getInterestBearingToken.call(
        USDC,
        storageManager.address,
      );
      assert.equal(expectedBearingToken, aUSDC.address);
      assert.equal(moduleBearingToken, aUSDC.address);
    });

    it('Reverts if msg.sender is not the synthereum pool factory', async () => {
      await truffleAssert.reverts(
        storageManager.setPoolStorage(
          poolMock.address,
          USDC,
          'aave',
          aUSDC.address,
          daoInterestShare,
          jrtShare,
          { from: accounts[4] },
        ),
        'Not allowed',
      );
    });

    it('Allows maintainer to set new shares', async () => {
      let newJRTShare = toWei('0.4');
      let newDaoInterestShare = toWei('0.4');

      await proxy.setShares(
        poolMock.address,
        newDaoInterestShare,
        newJRTShare,
        { from: maintainer },
      );

      let poolStorageAfter = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      assert.equal(
        poolStorageAfter.JRTBuybackShare.toString(),
        newJRTShare.toString(),
      );
      assert.equal(
        poolStorageAfter.daoInterestShare.toString(),
        newDaoInterestShare.toString(),
      );

      // reset to original
      await proxy.setShares(poolMock.address, daoInterestShare, jrtShare, {
        from: maintainer,
      });
    });

    it('Allows maintainer to set new swap module', async () => {
      let newSwapModule = accounts[10];

      await proxy.setSwapModule(newSwapModule, USDC, { from: maintainer });

      let expectedModule = await storageManager.getCollateralSwapModule.call(
        USDC,
      );
      assert.equal(expectedModule, newSwapModule);

      // reset to original
      await proxy.setSwapModule(ZERO_ADDRESS, USDC, { from: maintainer });
    });

    it('Reverts if msg.sender is not the maintainer', async () => {
      let newJRTShare = toWei('0.4');
      let newDaoInterestShare = toWei('0.4');
      let newSwapModule = accounts[10];

      await truffleAssert.reverts(
        proxy.setShares(poolMock.address, newDaoInterestShare, newJRTShare, {
          from: accounts[4],
        }),
        'Sender must be the maintainer',
      );
      await truffleAssert.reverts(
        proxy.setSwapModule(newSwapModule, USDC, { from: accounts[4] }),
        'Sender must be the maintainer',
      );
    });

    it('Reverts if not proxy is trying to modify pool storage contract', async () => {
      await truffleAssert.reverts(
        storageManager.setShares(poolMock.address, 0, 0, { from: accounts[4] }),
        'Not allowed',
      );
      await truffleAssert.reverts(
        storageManager.setSwapModule(accounts[5], USDC, { from: accounts[4] }),
        'Not allowed',
      );
      await truffleAssert.reverts(
        storageManager.setLendingModule(accounts[5], toHex(0), 'fake', {
          from: accounts[4],
        }),
        'Not allowed',
      );
      await truffleAssert.reverts(
        storageManager.updateValues(poolMock.address, 100, 100, 100, {
          from: accounts[4],
        }),
        'Not allowed',
      );
      await truffleAssert.reverts(
        storageManager.migratePool(accounts[5], accounts[6], {
          from: accounts[4],
        }),
        'Not allowed',
      );
      await truffleAssert.reverts(
        storageManager.migrateLendingModule(accounts[5], 'aave', accounts[7], {
          from: accounts[4],
        }),
        'Not allowed',
      );
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
      assert.equal(
        returnValues.tokensTransferred.toString(),
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

      let generatedInterest = await proxy.getAccumulatedInterest.call(
        poolMock.address,
      );

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
      assert.equal(
        generatedInterest.toString().substr(0, 14),
        expectedPoolInterest.toString().substr(0, 14),
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

    it('Reverts if msg.sender is not a registered pool', async () => {
      await truffleAssert.reverts(
        proxy.deposit(10, { from: user }),
        'Not allowed',
      );
    });

    it('Reverts if not enough collateral is sent to proxy', async () => {
      await truffleAssert.reverts(
        poolMock.depositShouldRevert(10, { from: user }),
        'Wrong balance',
      );
    });

    it('Withdraw - Correctly withdraw and update values, interest', async () => {
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
        returnValues.tokensTransferred.toString(),
        amountWithdraw.toString(),
      );
      assert.equal(
        returnValues.poolInterest.toString().substr(0, 12),
        expectedPoolInterest.toString().substr(0, 12),
      );
      assert.equal(
        returnValues.daoInterest.toString().substr(0, 13),
        expectedDaoInterest.toString().substr(0, 13),
      );

      // check tokens have moved correctly
      assert.equal(
        userUSDCAfter.toString(),
        userUSDCBefore.add(toBN(returnValues.tokensTransferred)).toString(),
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
        poolStorage.unclaimedDaoJRT.toString().substr(0, 14),
        expectedUnclaimedJRT.substr(0, 14),
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

    it('Reverts if msg.sender is not a registered pool', async () => {
      await truffleAssert.reverts(
        proxy.withdraw(10, user, { from: user }),
        'Not allowed',
      );
    });

    it('Reverts if not enough aToken is sent to proxy', async () => {
      await truffleAssert.reverts(
        poolMock.withdrawShouldRevert(10, user, { from: user }),
        'Wrong balance',
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
        returnValues.tokensTransferred.toString(),
        amount.toString(),
      );
      assert.equal(
        returnValues.poolInterest.toString().substr(0, 13),
        expectedPoolInterest.toString().substr(0, 13),
      );
      assert.equal(
        returnValues.daoInterest.toString().substr(0, 12),
        expectedDaoInterest.toString().substr(0, 12),
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
        poolStorage.unclaimedDaoCommission.toString().substr(0, 12),
        expectedDaoCommisson.substr(0, 12),
      );
    });

    it('Reverts if msg.sender is not a registered pool', async () => {
      await truffleAssert.reverts(
        proxy.claimCommission(10, { from: user }),
        'Not allowed',
      );
    });

    it('Correctly claim and swap to JRT', async () => {
      let jrtSwap = await JRTSWAP.new();
      await proxy.setSwapModule(jrtSwap.address, USDC, { from: maintainer });

      let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);

      // borrow on aave to generate interest
      await openCDP(toWei('100000000'), toWei('40000000'), accounts[3]);

      // sets recipient
      let buybackReceiver = accounts[4];
      await finder.changeImplementationAddress(
        web3Utils.utf8ToHex('BuybackProgramReceiver'),
        buybackReceiver,
        { from: maintainer },
      );

      let receiverJRTBefore = await JRTInstance.balanceOf.call(buybackReceiver);

      let poolStorageBefore = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);

      // claim commission
      let amount = (await storageManager.getPoolStorage.call(poolMock.address))
        .unclaimedDaoJRT;
      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            SwapParams: {
              routerAddress: 'address',
              tokenSwapPath: 'address[]',
              expiration: 'uint256',
            },
          },
        ],
        [
          {
            routerAddress: data[networkId].JRTSwapRouter,
            tokenSwapPath: [USDC, JRT],
            expiration,
          },
        ],
      );

      let returnValues = await poolMock.claimJRT.call(
        aUSDC.address,
        amount,
        encodedParams,
        {
          from: accounts[0],
        },
      );
      await poolMock.claimJRT(aUSDC.address, amount, encodedParams, {
        from: accounts[0],
      });

      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      let receiverJRTAfter = await JRTInstance.balanceOf.call(buybackReceiver);

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
      assert.equal(
        returnValues.tokensOut.toString(),
        receiverJRTAfter.sub(receiverJRTBefore).toString(),
      );
      assert.equal(
        returnValues.tokensTransferred.toString(),
        amount.toString(),
      );
      assert.equal(
        returnValues.poolInterest.toString().substr(0, 12),
        expectedPoolInterest.toString().substr(0, 12),
      );
      assert.equal(
        returnValues.daoInterest.toString().substr(0, 12),
        expectedDaoInterest.toString().substr(0, 12),
      );

      // check tokens have moved correctly
      assert.equal(
        receiverJRTAfter.toString(),
        receiverJRTBefore.add(toBN(returnValues.tokensOut)).toString(),
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

      let expectedUnclaimedJRT = toBN(returnValues.daoInterest)
        .mul(toBN(jrtShare))
        .div(toBN(Math.pow(10, 18)))
        .toString();
      assert.equal(
        poolStorage.unclaimedDaoJRT.substr(0, 11),
        expectedUnclaimedJRT.substr(0, 11),
      );

      let expectedDaoCommisson = toBN(poolStorageBefore.unclaimedDaoCommission)
        .add(
          toBN(returnValues.daoInterest)
            .mul(toBN(commissionShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();

      assert.equal(
        poolStorage.unclaimedDaoCommission.toString().substr(0, 12),
        expectedDaoCommisson.substr(0, 12),
      );
    });

    it('Reverts if msg.sender is not a registered pool', async () => {
      await truffleAssert.reverts(
        proxy.executeBuyback(10, toHex(0), { from: user }),
        'Not allowed',
      );
    });
    it('Provides collateral to interest token conversion', async () => {
      let collateralAmount = toWei('10');

      // passed as exact transfer to do
      let res = await poolMock.collateralToInterestToken.call(
        collateralAmount,
        true,
        { from: user },
      );
      assert.equal(
        res.interestTokenAmount.toString(),
        collateralAmount.toString(),
      );
      assert.equal(res.interestTokenAddr.toString(), aUSDC.address);

      // passed as exact transfer to receive
      res = await poolMock.collateralToInterestToken.call(
        collateralAmount,
        false,
        { from: user },
      );
      assert.equal(
        res.interestTokenAmount.toString(),
        collateralAmount.toString(),
      );
      assert.equal(res.interestTokenAddr.toString(), aUSDC.address);
    });

    context('Migrations', () => {
      it('Correctly migrate lending module', async () => {
        let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);
        let poolUSDCBefore = await USDCInstance.balanceOf.call(
          poolMock.address,
        );

        // borrow on aave to generate interest
        await openCDP(toWei('100000000'), toWei('40000000'), accounts[3]);

        // deploy new module
        newModule = await LendingModule.new();

        // set new module args and id
        let args = web3.eth.abi.encodeParameters(
          ['address'],
          [data[networkId].AaveV3],
        );
        await proxy.setLendingModule(newModule.address, args, 'new', {
          from: maintainer,
        });

        let poolStorageBefore = await storageManager.getPoolStorage.call(
          poolMock.address,
        );

        // call migration from pool
        let amount = await aUSDC.balanceOf.call(poolMock.address);
        let returnValues = await poolMock.migrateLendingModule.call(
          aUSDC.address,
          'new',
          aUSDC.address,
          amount,
        );
        await poolMock.migrateLendingModule(
          aUSDC.address,
          'new',
          aUSDC.address,
          amount,
        );

        let poolAUSDCAfter = await aUSDC.balanceOf.call(poolMock.address);
        let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);
        let poolStorage = await storageManager.getPoolStorage.call(
          poolMock.address,
        );
        let expectedInterest = poolAUSDCAfter.sub(poolAUSDCBefore);

        let expectedDaoInterest = expectedInterest
          .mul(toBN(daoInterestShare))
          .div(toBN(Math.pow(10, 18)));

        let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

        // check return values to pool
        assert.equal(returnValues.tokensOut.toString(), amount.toString());
        assert.equal(
          returnValues.tokensTransferred.toString(),
          amount.toString(),
        );
        assert.equal(
          returnValues.poolInterest.toString().substr(0, 12),
          expectedPoolInterest.toString().substr(0, 12),
        );
        assert.equal(
          returnValues.daoInterest.toString().substr(0, 13),
          expectedDaoInterest.toString().substr(0, 13),
        );

        // check tokens have moved correctly
        assert.equal(poolUSDCAfter.toString(), poolUSDCBefore.toString());
        assert.equal(
          poolAUSDCAfter.toString().substr(0, 14),
          poolAUSDCBefore
            .add(toBN(returnValues.poolInterest))
            .add(toBN(returnValues.daoInterest))
            .toString()
            .substr(0, 14),
        );

        // check pool storage update on proxy
        let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
          .add(expectedPoolInterest)
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
          poolStorage.unclaimedDaoJRT.toString().substr(0, 13),
          expectedUnclaimedJRT.substr(0, 13),
        );

        let expectedDaoCommisson = toBN(
          poolStorageBefore.unclaimedDaoCommission,
        )
          .add(
            toBN(returnValues.daoInterest)
              .mul(toBN(commissionShare))
              .div(toBN(Math.pow(10, 18))),
          )
          .toString();
        assert.equal(
          poolStorage.unclaimedDaoCommission.toString().substr(0, 13),
          expectedDaoCommisson.substr(0, 13),
        );

        // check lending module changed
        assert.equal(poolStorage.lendingModule, newModule.address);
        assert.equal(poolStorage.interestBearingToken, aUSDC.address);
      });

      it('Reverts if msg.sender is not a registered pool', async () => {
        await truffleAssert.reverts(
          proxy.migrateLendingModule('aave', accounts[5], 10, {
            from: user,
          }),
          'Not allowed',
        );
      });

      it('Correctly migrate pool data to a new one', async () => {
        // deploy new pool
        let newPool = await PoolMock.new(USDC, jEUR.address, proxy.address, {
          from: maintainer,
        });

        let poolStorageBefore = await storageManager.getPoolStorage.call(
          poolMock.address,
        );

        // call migration from pool
        await poolMock.migratePool(newPool.address);

        let poolStorageAft = await storageManager.getPoolStorage.call(
          poolMock.address,
        );
        let newPoolStorageAft = await storageManager.getPoolStorage.call(
          newPool.address,
        );

        // check storage have been copied on new pool
        assert.equal(
          poolStorageBefore.lendingModule,
          newPoolStorageAft.lendingModule,
        );
        assert.equal(
          poolStorageBefore.collateral,
          newPoolStorageAft.collateral,
        );
        assert.equal(
          poolStorageBefore.interestBearingToken,
          newPoolStorageAft.interestBearingToken,
        );
        assert.equal(
          poolStorageBefore.JRTBuybackShare,
          newPoolStorageAft.JRTBuybackShare,
        );
        assert.equal(
          poolStorageBefore.daoInterestShare,
          newPoolStorageAft.daoInterestShare,
        );
        assert.equal(
          poolStorageBefore.collateralDeposited,
          newPoolStorageAft.collateralDeposited,
        );
        assert.equal(
          poolStorageBefore.unclaimedDaoJRT,
          newPoolStorageAft.unclaimedDaoJRT,
        );
        assert.equal(
          poolStorageBefore.unclaimedDaoCommission,
          newPoolStorageAft.unclaimedDaoCommission,
        );

        // check old pool data is reset
        assert.equal(poolStorageAft.lendingModule, ZERO_ADDRESS);
        assert.equal(poolStorageAft.collateral, ZERO_ADDRESS);
        assert.equal(poolStorageAft.interestBearingToken, ZERO_ADDRESS);
        assert.equal(poolStorageAft.JRTBuybackShare, toWei('0'));
        assert.equal(poolStorageAft.daoInterestShare, toWei('0'));
        assert.equal(poolStorageAft.collateralDeposited, toWei('0'));
        assert.equal(poolStorageAft.unclaimedDaoJRT, toWei('0'));
        assert.equal(poolStorageAft.unclaimedDaoCommission, toWei('0'));
      });

      it('Reverts if msg.sender is not a registered pool', async () => {
        let fakePool = await PoolMock.new(USDC, jEUR.address, proxy.address, {
          from: maintainer,
        });
        await truffleAssert.reverts(
          proxy.migrateLiquidity(fakePool.address, { from: user }),
          'Not allowed',
        );
      });
    });
  });
});
