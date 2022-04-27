const { artifacts, contract } = require('hardhat');
const { assert, AssertionError } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');
const LendingModule = artifacts.require('AaveV3Module');
const PoolMock = artifacts.require('PoolLendingMock');
const LendingProxy = artifacts.require('LendingManager');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const LendingStorageManager = artifacts.require('LendingStorageManager');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const IUniswapRouter = artifacts.require('IUniswapV2Router02');

const AToken = artifacts.require('ATokenMock');
const AAVE = artifacts.require('AAVEMock');
const JRTSWAP = artifacts.require('UniV2JRTSwapModule');
const data = require('../../data/test/lendingTestnet.json');

const { toBN, toWei, toHex } = web3Utils;

contract('AaveV3 Lending module', accounts => {
  let finder, poolMock, module, proxy, storageManager, networkId, expiration;
  let aUSDC, USDC, USDCInstance, JRT, JRTInstance, aaveInstance, factoryVers;
  const maintainer = accounts[1];
  const admin = accounts[0];
  const Roles = { admin, maintainer };
  const daoInterestShare = toWei('0.4');
  const jrtShare = toWei('0.5');
  const commissionShare = toWei('0.5');

  const openCDP = async (deposit, borrow, from) => {
    let am = toBN(deposit).divn(50).toString();
    let half = toBN(deposit).divn(2).toString();
    await getUSDC(deposit, from);
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

  const getUSDC = async (collateralAmount, recipient) => {
    let NativeWrapperAddr = data[networkId].NativeWrapper;

    let deadline = ((Date.now() / 1000) | 0) + 7200;
    const nativeAmount = web3.utils.toWei('100');
    const actualBalance = await web3.eth.getBalance(recipient);
    const newTotal = web3.utils
      .toBN(nativeAmount)
      .add(web3.utils.toBN(actualBalance));

    await network.provider.send('hardhat_setBalance', [
      recipient,
      web3.utils.toHex(newTotal.toString()),
    ]);

    let uniswapInstance = await IUniswapRouter.at(
      data[networkId].JRTSwapRouter,
    );
    await uniswapInstance.swapETHForExactTokens(
      collateralAmount,
      [NativeWrapperAddr, USDC],
      recipient,
      deadline,
      { from: recipient, value: nativeAmount },
    );
  };

  before(async () => {
    expiration = (await web3.eth.getBlock('latest')).timestamp + 60000;
    networkId = await web3.eth.net.getId();
    finder = await SynthereumFinder.deployed();
    factoryVers = await SynthereumFactoryVersioning.deployed();
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
    poolMock = await PoolMock.new(
      USDC,
      jEUR.address,
      proxy.address,
      storageManager.address,
      {
        from: maintainer,
      },
    );
    await finder.changeImplementationAddress(
      web3Utils.utf8ToHex('LendingManager'),
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
    await factoryVers.setFactory(
      web3Utils.utf8ToHex('PoolFactory'),
      1,
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
      let lendingInfo = {
        lendingModule: module.address,
        args,
      };
      await proxy.setLendingModule('aave', lendingInfo, {
        from: maintainer,
      });

      // by specifying the aAtoken
      await storageManager.setPoolStorage(
        'aave',
        poolMock.address,
        USDC,
        aUSDC.address,
        daoInterestShare,
        jrtShare,
        { from: maintainer },
      );

      let poolStorage = await storageManager.getPoolData.call(poolMock.address);
      assert.equal(poolStorage.lendingInfo.lendingModule, module.address);
      assert.equal(poolStorage.poolData.collateral, USDC);
      assert.equal(poolStorage.poolData.interestBearingToken, aUSDC.address);
      assert.equal(
        poolStorage.poolData.daoInterestShare.toString(),
        daoInterestShare.toString(),
      );
      assert.equal(
        poolStorage.poolData.jrtBuybackShare.toString(),
        jrtShare.toString(),
      );

      let expectedBearingToken = await storageManager.getInterestBearingToken.call(
        poolMock.address,
      );
      let moduleBearingToken = await module.getInterestBearingToken.call(
        USDC,
        poolStorage.lendingInfo.args,
      );
      assert.equal(expectedBearingToken, aUSDC.address);
      assert.equal(moduleBearingToken, aUSDC.address);

      // by not specifying the aToken
      await proxy.setLendingModule('aave-2', lendingInfo, {
        from: maintainer,
      });
      // this information is not used in any other tests
      await storageManager.setPoolStorage(
        'aave-2',
        accounts[8],
        USDC,
        ZERO_ADDRESS,
        daoInterestShare,
        jrtShare,
        { from: maintainer },
      );

      poolStorage = await storageManager.getPoolData.call(poolMock.address);
      assert.equal(poolStorage.lendingInfo.lendingModule, module.address);
      assert.equal(poolStorage.poolData.collateral, USDC);
      assert.equal(poolStorage.poolData.interestBearingToken, aUSDC.address);
      assert.equal(
        poolStorage.poolData.daoInterestShare.toString(),
        daoInterestShare.toString(),
      );
      assert.equal(
        poolStorage.poolData.jrtBuybackShare.toString(),
        jrtShare.toString(),
      );

      expectedBearingToken = await storageManager.getInterestBearingToken.call(
        poolMock.address,
      );
      moduleBearingToken = await module.getInterestBearingToken.call(
        USDC,
        poolStorage.lendingInfo.args,
      );
      assert.equal(expectedBearingToken, aUSDC.address);
      assert.equal(moduleBearingToken, aUSDC.address);
    });

    it('Reverts if bearing token is not set and lending module reverts', async () => {
      let args = web3.eth.abi.encodeParameters(
        ['address'],
        [data[networkId].AaveV3],
      );
      let lendingInfo = {
        lendingModule: poolMock.address,
        args,
      };
      await proxy.setLendingModule('badlendingInfo', lendingInfo, {
        from: maintainer,
      });

      await truffleAssert.reverts(
        storageManager.setPoolStorage(
          'badlendingInfo',
          accounts[10],
          USDC,
          ZERO_ADDRESS,
          daoInterestShare,
          jrtShare,
          { from: maintainer },
        ),
        'No bearing token passed',
      );
    });

    it('Store passed bearing token if lending module reverts', async () => {
      await storageManager.setPoolStorage(
        'badlendingInfo',
        accounts[10],
        USDC,
        aUSDC.address,
        daoInterestShare,
        jrtShare,
        { from: maintainer },
      );

      let poolStorage = await storageManager.getPoolData.call(accounts[10]);
      assert.equal(poolStorage.lendingInfo.lendingModule, poolMock.address);
      assert.equal(poolStorage.poolData.collateral, USDC);
      assert.equal(poolStorage.poolData.interestBearingToken, aUSDC.address);
      assert.equal(
        poolStorage.poolData.daoInterestShare.toString(),
        daoInterestShare.toString(),
      );
      assert.equal(
        poolStorage.poolData.jrtBuybackShare.toString(),
        jrtShare.toString(),
      );

      expectedBearingToken = await storageManager.getInterestBearingToken.call(
        accounts[10],
      );
      assert.equal(expectedBearingToken, aUSDC.address);
    });

    it('Reverts if msg.sender is not the synthereum pool factory', async () => {
      await truffleAssert.reverts(
        storageManager.setPoolStorage(
          'aave',
          poolMock.address,
          USDC,
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
        poolStorageAfter.jrtBuybackShare.toString(),
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

      await proxy.setSwapModule(USDC, newSwapModule, { from: maintainer });

      let expectedModule = await storageManager.getCollateralSwapModule.call(
        USDC,
      );
      assert.equal(expectedModule, newSwapModule);

      // reset to original
      await proxy.setSwapModule(USDC, ZERO_ADDRESS, { from: maintainer });
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
        proxy.setSwapModule(USDC, newSwapModule, { from: accounts[4] }),
        'Sender must be the maintainer',
      );
    });

    it('Reverts if not proxy is trying to modify pool storage contract', async () => {
      await truffleAssert.reverts(
        storageManager.setShares(poolMock.address, 0, 0, { from: accounts[4] }),
        'Not allowed',
      );
      await truffleAssert.reverts(
        storageManager.setSwapModule(USDC, accounts[5], { from: accounts[4] }),
        'Not allowed',
      );
      await truffleAssert.reverts(
        proxy.setLendingModule(
          'fake',
          { lendingModule: accounts[5], args: '0x00' },
          {
            from: accounts[4],
          },
        ),
        'Sender must be the maintainer',
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
        storageManager.migrateLendingModule('aave', accounts[5], accounts[7], {
          from: accounts[4],
        }),
        'Not allowed',
      );
    });
  });
  describe('AAVe module', () => {
    const user = accounts[2];
    let amountMint = '10';
    let amountFirstDeposit = '3';

    it('First deposit- Correctly deposits and update values', async () => {
      await getUSDC(amountMint, user);
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
      await openCDP('1000', '400', accounts[3]);

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
      let amountDeposit = '1';
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
        generatedInterest.poolInterest.toString().substr(0, 14),
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
        proxy.deposit(10, user, { from: user }),
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
      await openCDP('1000', '400', accounts[3]);

      let amountWithdraw = '1';
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
      );
    });

    it('Correctly claim commissions', async () => {
      let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);

      // borrow on aave to generate interest
      await openCDP('1000', '400', accounts[3]);

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
      let amount = poolStorageBefore.unclaimedDaoCommission;

      let tx = await proxy.batchClaimCommission([poolMock.address], [amount], {
        from: maintainer,
      });

      truffleAssert.eventEmitted(tx, 'BatchCommissionClaim', ev => {
        return (
          ev.collateralOut.toString() == amount.toString() &&
          ev.receiver == commissionReceiver
        );
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

      // check tokens have moved correctly
      assert.equal(
        commissionUSDCAfter.toString(),
        commissionUSDCBefore.add(toBN(amount)).toString(),
      );
      assert.equal(
        poolAUSDCAfter.toString().substr(0, 14),
        poolAUSDCBefore
          .add(toBN(expectedInterest))
          .sub(toBN(amount))
          .toString()
          .substr(0, 14),
      );
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(toBN(expectedPoolInterest))
        .toString();
      assert.equal(
        poolStorage.collateralDeposited.toString().substr(0, 20),
        expectedCollateral.substr(0, 20),
      );

      let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
        .add(
          toBN(expectedDaoInterest)
            .mul(toBN(jrtShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();
      assert.equal(
        poolStorage.unclaimedDaoJRT.substr(0, 13),
        expectedUnclaimedJRT.substr(0, 13),
      );

      let expectedDaoCommisson = toBN(expectedDaoInterest)
        .mul(toBN(commissionShare))
        .div(toBN(Math.pow(10, 18)))
        .toString();

      assert.equal(
        poolStorage.unclaimedDaoCommission.toString().substr(0, 12),
        expectedDaoCommisson.substr(0, 12),
      );
    });

    it('Cant claim more commission than due', async () => {
      // sets recipient
      let commissionReceiver = accounts[4];
      await finder.changeImplementationAddress(
        web3Utils.utf8ToHex('CommissionReceiver'),
        commissionReceiver,
        { from: maintainer },
      );

      // claim commission
      let amount = (await storageManager.getPoolStorage.call(poolMock.address))
        .unclaimedDaoJRT;
      amount = toBN(amount).muln(2);
      await truffleAssert.reverts(
        proxy.batchClaimCommission([poolMock.address], [amount], {
          from: maintainer,
        }),
      );
    });

    it('Reverts if msg.sender is not maintainer', async () => {
      await truffleAssert.reverts(
        proxy.batchClaimCommission([poolMock.address], [10], { from: user }),
        'Sender must be the maintainer',
      );
    });

    it('Reverts if number of pools and amount mismatch', async () => {
      await truffleAssert.reverts(
        proxy.batchClaimCommission([poolMock.address], [10, 20], {
          from: maintainer,
        }),
        'Invalid call',
      );
    });

    it('Correctly claim and swap to JRT', async () => {
      let jrtSwap = await JRTSWAP.new();
      await proxy.setSwapModule(USDC, jrtSwap.address, { from: maintainer });

      let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);

      // borrow on aave to generate interest
      await openCDP('1000', '400', accounts[3]);

      // sets recipient
      let buybackReceiver = accounts[5];
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
      let amount = poolStorageBefore.unclaimedDaoJRT;
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
      let tx = await proxy.batchBuyback(
        [poolMock.address],
        [amount],
        USDC,
        encodedParams,
        {
          from: maintainer,
        },
      );

      let JRTOut;
      truffleAssert.eventEmitted(tx, 'BatchBuyback', ev => {
        JRTOut = ev.JRTOut;
        return (
          ev.collateralIn.toString() == amount.toString() &&
          ev.receiver == buybackReceiver
        );
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

      // check tokens have moved correctly
      assert.equal(
        receiverJRTAfter.toString(),
        receiverJRTBefore.add(toBN(JRTOut)).toString(),
      );
      // interest has been added to pool
      assert.equal(
        poolAUSDCAfter.toString().substr(0, 14),
        poolAUSDCBefore
          .add(toBN(expectedInterest))
          .sub(toBN(amount))
          .toString()
          .substr(0, 14),
      );
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(toBN(expectedPoolInterest))
        .toString();
      assert.equal(
        poolStorage.collateralDeposited.toString().substr(0, 20),
        expectedCollateral.substr(0, 20),
      );

      let expectedUnclaimedJRT = toBN(expectedDaoInterest)
        .mul(toBN(jrtShare))
        .div(toBN(Math.pow(10, 18)))
        .toString();
      assert.equal(
        poolStorage.unclaimedDaoJRT.substr(0, 13),
        expectedUnclaimedJRT.substr(0, 13),
      );

      let expectedDaoCommisson = toBN(poolStorageBefore.unclaimedDaoCommission)
        .add(
          toBN(expectedDaoInterest)
            .mul(toBN(commissionShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();

      assert.equal(
        poolStorage.unclaimedDaoCommission.substr(0, 13),
        expectedDaoCommisson.substr(0, 13),
      );
    });

    it('Reverts if msg.sender is not maintainer', async () => {
      await truffleAssert.reverts(
        proxy.batchBuyback([poolMock.address], [10], USDC, toHex(0), {
          from: user,
        }),
        'Sender must be the maintainer',
      );
    });

    it('Reverts if number of pools and amount mismatch', async () => {
      await truffleAssert.reverts(
        proxy.batchBuyback([poolMock.address], [10, 20], USDC, toHex(0), {
          from: maintainer,
        }),
        'Invalid call',
      );
    });

    it('Reverts if pool has different collateral', async () => {
      await truffleAssert.reverts(
        proxy.batchBuyback([poolMock.address], [10], aUSDC.address, toHex(0), {
          from: maintainer,
        }),
        'Collateral mismatch',
      );
    });

    it('Provides collateral to interest token conversion', async () => {
      let collateralAmount = toWei('10');

      // passed as exact transfer to do
      let res = await proxy.collateralToInterestToken.call(
        poolMock.address,
        collateralAmount,
        { from: user },
      );
      assert.equal(
        res.interestTokenAmount.toString(),
        collateralAmount.toString(),
      );
      assert.equal(res.interestTokenAddr.toString(), aUSDC.address);

      // passed as exact transfer to receive
      res = await proxy.collateralToInterestToken.call(
        poolMock.address,
        collateralAmount,
        { from: user },
      );
      assert.equal(
        res.interestTokenAmount.toString(),
        collateralAmount.toString(),
      );
      assert.equal(res.interestTokenAddr.toString(), aUSDC.address);
    });

    it('Let a pool update his own state without moving collateral', async () => {
      let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);

      // borrow on aave to generate interest
      await openCDP('1000', '400', accounts[3]);

      let poolStorageBefore = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      // call updateAccumulatedInterest to trigger interest split update
      let returnValues = await poolMock.updateAccumulatedInterest.call({
        from: user,
      });
      await poolMock.updateAccumulatedInterest({ from: user });
      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      let poolAUSDCAfter = await aUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

      let expectedInterest = poolAUSDCAfter.sub(poolAUSDCBefore);
      let expectedDaoInterest = expectedInterest
        .mul(toBN(daoInterestShare))
        .div(toBN(Math.pow(10, 18)));
      let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

      // check return values to pool
      assert.equal(returnValues.tokensOut.toString(), '0');
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

    it('Revert if msg.sender is not a registered pool', async () => {
      await truffleAssert.reverts(
        proxy.updateAccumulatedInterest({
          from: user,
        }),
        'Not allowed',
      );
    });

    context('Migrations', () => {
      it('Correctly migrate lending module', async () => {
        let poolAUSDCBefore = await aUSDC.balanceOf.call(poolMock.address);
        let poolUSDCBefore = await USDCInstance.balanceOf.call(
          poolMock.address,
        );

        // borrow on aave to generate interest
        await openCDP('1000', '400', accounts[3]);

        // deploy new module
        newModule = await LendingModule.new();

        // set new module args and id
        let args = web3.eth.abi.encodeParameters(
          ['address'],
          [data[networkId].AaveV3],
        );
        let newLendingInfo = {
          lendingModule: newModule.address,
          args,
        };
        await proxy.setLendingModule('new', newLendingInfo, {
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
        let poolStorage = await storageManager.getPoolData.call(
          poolMock.address,
        );
        let expectedInterest = poolAUSDCAfter.sub(poolAUSDCBefore);

        let expectedDaoInterest = expectedInterest
          .mul(toBN(daoInterestShare))
          .div(toBN(Math.pow(10, 18)));

        let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

        // check return values to pool
        assert.equal(
          returnValues.prevTotalCollateral.toString(),
          poolStorageBefore.collateralDeposited.toString(),
        );
        assert.equal(
          returnValues.actualTotalCollateral.toString(),
          toBN(poolAUSDCAfter)
            .sub(toBN(expectedDaoInterest))
            .sub(toBN(poolStorageBefore.unclaimedDaoCommission))
            .sub(toBN(poolStorageBefore.unclaimedDaoJRT))
            .toString(),
        );
        assert.equal(
          returnValues.poolInterest.toString().substr(0, 12),
          expectedPoolInterest.toString().substr(0, 12),
        );

        // check tokens have moved correctly
        assert.equal(poolUSDCAfter.toString(), poolUSDCBefore.toString());
        assert.equal(
          poolAUSDCAfter.toString().substr(0, 14),
          returnValues.actualTotalCollateral.toString(),
        );

        // check pool storage update on proxy
        let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
          .add(toBN(returnValues.poolInterest))
          .toString();
        assert.equal(
          poolStorage.poolData.collateralDeposited.toString().substr(0, 20),
          expectedCollateral.substr(0, 20),
        );

        let expectedUnclaimedDao = toBN(returnValues.actualTotalCollateral)
          .sub(toBN(returnValues.prevTotalCollateral))
          .sub(toBN(returnValues.poolInterest));

        let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
          .add(
            expectedUnclaimedDao
              .mul(toBN(jrtShare))
              .div(toBN(Math.pow(10, 18))),
          )
          .toString();
        assert.equal(
          poolStorage.poolData.unclaimedDaoJRT.toString().substr(0, 13),
          expectedUnclaimedJRT.substr(0, 13),
        );

        let expectedDaoCommisson = toBN(
          poolStorageBefore.unclaimedDaoCommission,
        )
          .add(
            expectedUnclaimedDao
              .mul(toBN(commissionShare))
              .div(toBN(Math.pow(10, 18))),
          )
          .toString();
        assert.equal(
          poolStorage.poolData.unclaimedDaoCommission.toString().substr(0, 13),
          expectedDaoCommisson.substr(0, 13),
        );

        // check lending module changed
        assert.equal(poolStorage.lendingInfo.lendingModule, newModule.address);
        assert.equal(poolStorage.poolData.interestBearingToken, aUSDC.address);
      });

      it('Reverts if msg.sender is not a registered pool', async () => {
        await truffleAssert.reverts(
          proxy.migrateLendingModule('aave', accounts[5], 10, {
            from: user,
          }),
          'Not allowed',
        );
      });

      it('Reverts if new bearing token is not set and new lending module reverts', async () => {
        await truffleAssert.reverts(
          poolMock.migrateLendingModule(
            aUSDC.address,
            'badlendingInfo',
            ZERO_ADDRESS,
            1,
          ),
          'No bearing token passed',
        );
      });

      it('Correctly migrate pool data to a new one', async () => {
        // deploy new pool
        let newPool = await PoolMock.new(
          USDC,
          jEUR.address,
          proxy.address,
          storageManager.address,
          {
            from: maintainer,
          },
        );

        let poolStorageBefore = await storageManager.getPoolData.call(
          poolMock.address,
        );

        // call migration from pool
        await storageManager.migratePool(poolMock.address, newPool.address, {
          from: maintainer,
        });

        let poolStorageAft = await storageManager.getPoolData.call(
          poolMock.address,
        );
        let newPoolStorageAft = await storageManager.getPoolData.call(
          newPool.address,
        );

        // check storage have been copied on new pool
        assert.equal(
          poolStorageBefore.lendingInfo.lendingModule,
          newPoolStorageAft.lendingInfo.lendingModule,
        );
        assert.equal(
          poolStorageBefore.poolData.collateral,
          newPoolStorageAft.poolData.collateral,
        );
        assert.equal(
          poolStorageBefore.poolData.interestBearingToken,
          newPoolStorageAft.poolData.interestBearingToken,
        );
        assert.equal(
          poolStorageBefore.poolData.jrtBuybackShare,
          newPoolStorageAft.poolData.jrtBuybackShare,
        );
        assert.equal(
          poolStorageBefore.poolData.daoInterestShare,
          newPoolStorageAft.poolData.daoInterestShare,
        );
        assert.equal(
          poolStorageBefore.poolData.collateralDeposited,
          newPoolStorageAft.poolData.collateralDeposited,
        );
        assert.equal(
          poolStorageBefore.poolData.unclaimedDaoJRT,
          newPoolStorageAft.poolData.unclaimedDaoJRT,
        );
        assert.equal(
          poolStorageBefore.poolData.unclaimedDaoCommission,
          newPoolStorageAft.poolData.unclaimedDaoCommission,
        );

        // check old pool data is reset
        assert.equal(poolStorageAft.lendingInfo.lendingModule, ZERO_ADDRESS);
        assert.equal(poolStorageAft.poolData.collateral, ZERO_ADDRESS);
        assert.equal(
          poolStorageAft.poolData.interestBearingToken,
          ZERO_ADDRESS,
        );
        assert.equal(poolStorageAft.poolData.jrtBuybackShare, toWei('0'));
        assert.equal(poolStorageAft.poolData.daoInterestShare, toWei('0'));
        assert.equal(poolStorageAft.poolData.collateralDeposited, toWei('0'));
        assert.equal(poolStorageAft.poolData.unclaimedDaoJRT, toWei('0'));
        assert.equal(
          poolStorageAft.poolData.unclaimedDaoCommission,
          toWei('0'),
        );
      });
    });
  });
});
