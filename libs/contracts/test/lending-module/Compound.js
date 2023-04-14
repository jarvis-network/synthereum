const { artifacts, contract } = require('hardhat');
const { assert, AssertionError } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');
const LendingModule = artifacts.require('CompoundModule');
const PoolMock = artifacts.require('PoolLendingMock');
const LendingProxy = artifacts.require('LendingManager');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const LendingStorageManager = artifacts.require('LendingStorageManager');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const SynthereumFactoryVersioning = artifacts.require(
  'SynthereumFactoryVersioning',
);
const IUniswapRouter = artifacts.require('IUniswapV2Router02');

const CToken = artifacts.require('ICompoundToken');
const JRTSWAP = artifacts.require('UniV2JRTSwapModule');
const data = require('../../data/test/lendingTestnet.json');
const { createVariableDeclaration } = require('typescript');

const { toBN, toWei, toHex } = web3Utils;

contract('Compound Lending module - Venus protocol integration', accounts => {
  let finder, poolMock, module, proxy, storageManager, networkId, expiration;
  let cUSDC,
    USDC,
    USDCInstance,
    JRT,
    JRTInstance,
    compoundInstance,
    factoryVers;
  const maintainer = accounts[1];
  const admin = accounts[0];
  const Roles = { admin, maintainer };
  const daoInterestShare = toWei('0.4');
  const jrtShare = toWei('0.5');
  const commissionShare = toWei('0.5');

  const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  };

  const openCDP = async (deposit, borrow, from) => {
    for (let i = 0; i < 2; i++) {
      await getUSDC(toBN(deposit).add(toBN(borrow)).toString(), from);
      await USDCInstance.approve(cUSDC.address, deposit, { from });
      await cUSDC.mint(deposit, { from });
      await cUSDC.borrow(borrow, { from });
      // produce more blocks and interest
      // await network.provider.send('evm_increaseTime', [
      //   1,
      // ]);
      // for (let i = 0; i < 3; i++) {
      //   await network.provider.send('evm_mine');
      // }
    }
  };

  const repay = async from => {
    // repay all debt
    let debt = (await cUSDC.borrowBalanceCurrent.call(from)).toString();
    await USDCInstance.increaseAllowance(cUSDC.address, debt, { from });
    await cUSDC.repayBorrow(debt, {
      from,
    });
  };

  const getUSDC = async (collateralAmount, recipient) => {
    let NativeWrapperAddr = data[networkId].NativeWrapper;

    let deadline = (await web3.eth.getBlock('latest')).timestamp + 60000;

    const nativeAmount = web3.utils.toWei('1000');

    let uniswapInstance = await IUniswapRouter.at(
      data[networkId].JRTSwapRouter,
    );
    await uniswapInstance.swapExactETHForTokens(
      collateralAmount,
      [NativeWrapperAddr, USDC],
      accounts[10],
      deadline,
      { from: recipient, value: nativeAmount },
    );

    await USDCInstance.transfer(recipient, collateralAmount, {
      from: accounts[10],
    });
  };

  const assertWeiDifference = (expectedAmount, actualAmount) => {
    expectedAmount = toBN(expectedAmount);
    actualAmount = toBN(actualAmount);

    let assertion = expectedAmount.eq(actualAmount);
    assertion =
      assertion || expectedAmount.add(toBN(toWei('1', 'wei'))).eq(actualAmount);
    assertion =
      assertion || expectedAmount.sub(toBN(toWei('1', 'wei'))).eq(actualAmount);

    assert.equal(assertion, true);
  };

  const initializeLendingProtocol = async lendingId => {
    if (lendingId == 'venus') {
      const aggregators = [
        '0x97371dF4492605486e23Da797fA68e55Fc38a13f',
        '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
        '0xc907E116054Ad103354f2D350FD2514433D57F6f',
        '0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D',
        '0xF9680D99D6C9589e2a93a78A04A279e509205945',
        '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7',
        '0x0A6513e40db6EB1b165753AD52E80663aeA50545',
        '0xd8d483d813547CfB624b8Dc33a00F2fcbCd2D428',
        '0x5d37E4b374E6907de8Fc7fb33EE3b0af403C7403',
        '0x73366Fe0AA0Ded304479862808e02506FE556a98',
      ];
      for (let j = 0; j < aggregators.length; j++) {
        const slot = web3.utils.soliditySha3(
          web3.utils.hexToNumberString(aggregators[j]),
          3,
        );
        await network.provider.send('hardhat_setStorageAt', [
          '0x1c312b14c129EabC4796b0165A2c470b659E5f01',
          slot.replace('0x0', '0x'),
          web3.utils.padLeft(
            web3.utils.numberToHex(web3.utils.toBN(web3.utils.toWei('1'))),
            64,
          ),
        ]);
      }
    }
  };

  before(async () => {
    networkId = await web3.eth.net.getId();
    finder = await SynthereumFinder.deployed();
    factoryVers = await SynthereumFactoryVersioning.deployed();
    storageManager = await LendingStorageManager.new(finder.address);
    proxy = await LendingProxy.new(finder.address, Roles);
    cUSDC = await CToken.at(data[networkId].cUSDC);
    USDC = data[networkId].USDC;
    USDCInstance = await TestnetSelfMintingERC20.at(USDC);

    JRT = data[networkId].JRT;
    JRTInstance = await TestnetSelfMintingERC20.at(JRT);

    jEUR = await SyntheticToken.new('jarvis euro', 'jEUR', 18, {
      from: accounts[0],
    });
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
    await finder.changeImplementationAddress(
      web3Utils.utf8ToHex('JarvisToken'),
      JRT,
      { from: maintainer },
    );
    await factoryVers.setFactory(
      web3Utils.utf8ToHex('PoolFactory'),
      1,
      maintainer,
      { from: maintainer },
    );

    // REGISTER AND SETUP CONTRACTS
    let args = web3.eth.abi.encodeParameters(
      ['address'],
      [data[networkId].Comptroller],
    );

    let lendingInfo = {
      lendingModule: module.address,
      args,
    };
    await proxy.setLendingModule('venus', lendingInfo, {
      from: maintainer,
    });

    await storageManager.setPoolStorage(
      'venus',
      poolMock.address,
      USDC,
      cUSDC.address,
      daoInterestShare,
      jrtShare,
      { from: maintainer },
    );

    await initializeLendingProtocol('venus');
  });

  // beforeEach(async () => {
  //   await openCDP('1000', '900', accounts[3]);
  // })

  it('Correctly initialise storage', async () => {
    let poolStorage = await storageManager.getPoolData.call(poolMock.address);
    assert.equal(poolStorage.lendingInfo.lendingModule, module.address);
    assert.equal(poolStorage.poolData.collateral, USDC);
    assert.equal(poolStorage.poolData.interestBearingToken, cUSDC.address);
    assert.equal(
      poolStorage.poolData.daoInterestShare.toString(),
      daoInterestShare.toString(),
    );
    assert.equal(
      poolStorage.poolData.jrtBuybackShare.toString(),
      jrtShare.toString(),
    );

    let expectedShare = await storageManager.getShares(poolMock.address);
    assert.equal(expectedShare.jrtBuybackShare.toString(), jrtShare.toString());
    assert.equal(
      expectedShare.daoInterestShare.toString(),
      daoInterestShare.toString(),
    );

    let expectedBearingToken = await storageManager.getInterestBearingToken.call(
      poolMock.address,
    );
    let moduleBearingToken = await module.getInterestBearingToken.call(
      USDC,
      poolStorage.lendingInfo.args,
    );
    assert.equal(expectedBearingToken, cUSDC.address);
    assert.equal(moduleBearingToken, cUSDC.address);
  });

  // THE rate returned in returnValues is different from the one used in tx
  describe('Compound module', () => {
    const user = accounts[5];
    let amountMint = toWei('500', 'mwei');
    let amountFirstDeposit = toWei('300', 'mwei');

    it('First deposit- Correctly deposits and update values', async () => {
      await getUSDC(amountMint, user);
      let userUSDCBefore = await USDCInstance.balanceOf.call(user);

      let userCUSDCBefore = await cUSDC.balanceOf.call(user);
      let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);

      await USDCInstance.approve(poolMock.address, amountFirstDeposit, {
        from: user,
      });
      let returnValues = await poolMock.deposit.call(amountFirstDeposit, USDC, {
        from: user,
      });
      let poolUnderlyingBefore = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );
      let exchangeRate = await cUSDC.exchangeRateCurrent.call();

      await poolMock.deposit(amountFirstDeposit, USDC, { from: user });
      let poolUnderlyingAfter = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      await openCDP(toWei('100', 'mwei'), toWei('90', 'mwei'), accounts[3]);

      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      let expectedCUSDCOut = toBN(amountFirstDeposit)
        .mul(toBN(Math.pow(10, 18)))
        .div(exchangeRate);

      let userUSDCAfter = await USDCInstance.balanceOf.call(user);
      let userCUSDCAfter = await cUSDC.balanceOf.call(user);
      let poolCUSDCAfter = await cUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

      let expectedDeposit = poolUnderlyingAfter.sub(poolUnderlyingBefore);

      // check return values to pool
      assertWeiDifference(
        returnValues.tokensOut.toString(),
        expectedDeposit.toString(),
      );

      // exact rate can't be retrieved
      let assertion = expectedCUSDCOut.gt(returnValues.tokensTransferred);
      assert.equal(assertion, true);
      assert.equal(returnValues.poolInterest.toString(), '0');
      assert.equal(returnValues.daoInterest.toString(), '0');

      // check tokens have moved correctly
      assert.equal(
        userUSDCAfter.toString(),
        userUSDCBefore.sub(toBN(amountFirstDeposit)).toString(),
      );
      assert.equal(userCUSDCBefore.toString(), userCUSDCAfter.toString());

      assertion = poolCUSDCBefore.add(expectedCUSDCOut).gt(poolCUSDCAfter);
      assert.equal(assertion, true);
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      assert.equal(
        poolStorage.collateralDeposited.toString(),
        expectedDeposit.toString(),
      );
      assert.equal(poolStorage.unclaimedDaoJRT.toString(), '0');
      assert.equal(poolStorage.unclaimedDaoCommission.toString(), '0');
    });

    it('Subsequent deposit- Correctly deposits and update values, interest', async () => {
      let userCUSDCBefore = await cUSDC.balanceOf.call(user);

      let userUSDCBefore = await USDCInstance.balanceOf.call(user);
      let poolStorageBefore = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);

      // deposit to trigger interest split update
      let amountDeposit = toWei('100', 'mwei');
      await USDCInstance.approve(poolMock.address, amountDeposit, {
        from: user,
      });

      let returnValues = await poolMock.deposit.call(amountDeposit, USDC, {
        from: user,
      });
      let exchangeRate = await cUSDC.exchangeRateCurrent.call();

      let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);

      await repay(accounts[3]);

      // borrow on compound to generate interest
      // await openCDP(toWei('10', 'mwei'), toWei('9', 'mwei'), accounts[3]);
      let poolUnderlyingBefore = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );
      await poolMock.deposit(amountDeposit, USDC, { from: user });
      let poolCUSDCAfter = await cUSDC.balanceOf.call(poolMock.address);
      let poolUnderlyingAfter = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      let generatedInterest = await proxy.getAccumulatedInterest.call(
        poolMock.address,
      );

      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      let userUSDCAfter = await USDCInstance.balanceOf.call(user);
      let userCUSDCAfter = await cUSDC.balanceOf.call(user);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

      let expectedCUSDCOut = toBN(amountDeposit)
        .mul(toBN(Math.pow(10, 18)))
        .div(exchangeRate);

      let expectedDeposit = poolUnderlyingAfter
        .sub(poolUnderlyingBefore)
        .sub(generatedInterest[0])
        .sub(generatedInterest[1])
        .sub(generatedInterest[2]);
      assertWeiDifference(
        returnValues.tokensOut.toString(),
        expectedDeposit.toString(),
      );

      let expectedInterest = poolUnderlyingAfter
        .sub(toBN(amountDeposit))
        .sub(toBN(poolStorageBefore.collateralDeposited));

      let expectedDaoInterest = expectedInterest
        .mul(toBN(daoInterestShare))
        .div(toBN(Math.pow(10, 18)));
      let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

      // check return values to pool
      assert.equal(
        returnValues.tokensTransferred.toString(),
        expectedCUSDCOut.toString(),
      );
      assert.equal(
        returnValues.poolInterest.toString(),
        expectedPoolInterest.toString(),
      );
      assert.equal(
        returnValues.daoInterest.toString(),
        expectedDaoInterest.toString(),
      );

      // check tokens have moved correctly
      assert.equal(
        userUSDCAfter.toString(),
        userUSDCBefore.sub(toBN(amountDeposit)).toString(),
      );
      assert.equal(userCUSDCBefore.toString(), userCUSDCAfter.toString());
      assertion = poolCUSDCBefore.add(expectedCUSDCOut).gt(poolCUSDCAfter);
      assert.equal(assertion, true);
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(expectedPoolInterest)
        .add(toBN(returnValues.tokensOut))
        .toString();
      assert.equal(
        poolStorage.collateralDeposited.toString(),
        expectedCollateral,
      );

      let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
        .add(
          toBN(returnValues.daoInterest)
            .mul(toBN(jrtShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();
      assert.equal(poolStorage.unclaimedDaoJRT, expectedUnclaimedJRT);

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

    it('Reverts if msg.sender is not a registered pool', async () => {
      await truffleAssert.reverts(
        proxy.deposit(10, { from: user }),
        'Not existing pool',
      );
    });

    it('Reverts if not enough collateral is sent to proxy', async () => {
      await truffleAssert.reverts(
        poolMock.depositShouldRevert(10, { from: user }),
        'Wrong balance',
      );
    });

    it('Withdraw - Correctly withdraw and update values, interest', async () => {
      let amountWithdraw = toWei('50', 'mwei');
      let userCUSDCBefore = await cUSDC.balanceOf.call(user);
      let userUSDCBefore = await USDCInstance.balanceOf.call(user);
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);
      let poolStorageBefore = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      // withdraw
      let returnValues = await poolMock.withdraw.call(
        amountWithdraw,
        user,
        cUSDC.address,
        {
          from: user,
        },
      );
      let exchangeRate = await cUSDC.exchangeRateCurrent.call();

      let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);
      let poolUnderlyingBefore = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );
      await poolMock.withdraw(amountWithdraw, user, cUSDC.address, {
        from: user,
      });
      await repay(accounts[3]);

      let poolUnderlyingAfter = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );
      let poolCUSDCAfter = await cUSDC.balanceOf.call(poolMock.address);

      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      let USDCOut = toBN(amountWithdraw)
        .mul(exchangeRate)
        .div(toBN(Math.pow(10, 18)));

      let userUSDCAfter = await USDCInstance.balanceOf.call(user);
      let userCUSDCAfter = await cUSDC.balanceOf.call(user);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

      let expectedInterest = poolUnderlyingAfter
        .add(toBN(USDCOut))
        .sub(toBN(poolStorageBefore.collateralDeposited));

      let expectedDaoInterest = expectedInterest
        .mul(toBN(daoInterestShare))
        .div(toBN(Math.pow(10, 18)));

      let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

      // check return values to pool
      assert.equal(returnValues.tokensOut.toString(), USDCOut.toString());
      assert.equal(
        returnValues.tokensTransferred.toString(),
        USDCOut.toString(),
      );
      assertWeiDifference(
        returnValues.poolInterest.toString(),
        expectedPoolInterest.toString(),
      );
      assert.equal(
        returnValues.daoInterest.toString(),
        expectedDaoInterest.toString(),
      );

      // check tokens have moved correctly
      assert.equal(
        userUSDCAfter.toString(),
        userUSDCBefore.add(toBN(returnValues.tokensOut)).toString(),
      );
      assert.equal(userCUSDCBefore.toString(), userCUSDCAfter.toString());
      assert.equal(
        poolCUSDCAfter.toString(),
        poolCUSDCBefore.sub(toBN(amountWithdraw)).toString(),
      );
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(expectedPoolInterest)
        .sub(toBN(returnValues.tokensOut))
        .toString();
      assertWeiDifference(
        poolStorage.collateralDeposited.toString(),
        expectedCollateral,
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

    it('Reverts if msg.sender is not a registered pool', async () => {
      await truffleAssert.reverts(
        proxy.withdraw(10, user, { from: user }),
        'Not existing pool',
      );
    });

    it('Reverts if not enough aToken is sent to proxy', async () => {
      await truffleAssert.reverts(
        poolMock.withdrawShouldRevert(10, user, { from: user }),
      );
    });

    it('Correctly claim commissions', async () => {
      let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);
      let poolUnderlyingBefore = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      // sets recipient
      let commissionReceiver = accounts[4];
      await finder.changeImplementationAddress(
        web3Utils.utf8ToHex('CommissionReceiver'),
        commissionReceiver,
        { from: maintainer },
      );
      let exchangeRate = await cUSDC.exchangeRateCurrent.call();
      let commissionUSDCBefore = await USDCInstance.balanceOf.call(
        commissionReceiver,
      );
      let poolStorageBefore = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);

      // claim commission
      let amount = toBN(poolStorageBefore.unclaimedDaoCommission);

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
      let poolCUSDCAfter = await cUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);
      let poolUnderlyingAfter = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      let expectedCUSDCOut = toBN(amount)
        .mul(toBN(Math.pow(10, 18)))
        .div(exchangeRate);

      let expectedInterest = poolUnderlyingAfter
        .add(toBN(amount))
        .sub(toBN(poolStorageBefore.collateralDeposited));
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
        poolCUSDCAfter.toString(),
        poolCUSDCBefore.sub(toBN(expectedCUSDCOut)).toString(),
      );
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(toBN(expectedPoolInterest))
        .toString();
      assertWeiDifference(
        poolStorage.collateralDeposited.toString(),
        expectedCollateral,
      );

      let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
        .add(
          toBN(expectedDaoInterest)
            .mul(toBN(jrtShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();
      assert.equal(poolStorage.unclaimedDaoJRT, expectedUnclaimedJRT);

      let expectedDaoCommisson = toBN(expectedDaoInterest)
        .mul(toBN(commissionShare))
        .div(toBN(Math.pow(10, 18)));

      assert.equal(expectedDaoCommisson, poolStorage.unclaimedDaoCommission);
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
        .unclaimedDaoCommission;
      amount = toBN(amount).addn(10);

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

    // it('Correctly claim and swap to JRT', async () => {
    //   let jrtSwap = await JRTSWAP.new();
    //   await proxy.addSwapProtocol(jrtSwap.address, { from: maintainer });
    //   await proxy.setSwapModule(USDC, jrtSwap.address, { from: maintainer });

    //   let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);

    //   // borrow on compound to generate interest
    //   await openCDP('100000000', '40000000', accounts[3]);

    //   // sets recipient
    //   let buybackReceiver = accounts[5];
    //   await finder.changeImplementationAddress(
    //     web3Utils.utf8ToHex('BuybackProgramReceiver'),
    //     buybackReceiver,
    //     { from: maintainer },
    //   );

    //   let receiverJRTBefore = await JRTInstance.balanceOf.call(buybackReceiver);

    //   let poolStorageBefore = await storageManager.getPoolStorage.call(
    //     poolMock.address,
    //   );
    //   let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);

    //   // claim commission
    //   let amount = poolStorageBefore.unclaimedDaoJRT;
    //   let expiration = (await web3.eth.getBlock('latest')).timestamp + 60000;
    //   let encodedParams = web3.eth.abi.encodeParameters(
    //     [
    //       {
    //         SwapParams: {
    //           routerAddress: 'address',
    //           tokenSwapPath: 'address[]',
    //           expiration: 'uint256',
    //           minTokensOut: 'uint256',
    //         },
    //       },
    //     ],
    //     [
    //       {
    //         routerAddress: data[networkId].JRTSwapRouter,
    //         tokenSwapPath: [USDC, JRT],
    //         expiration,
    //         minTokensOut: 0,
    //       },
    //     ],
    //   );
    //   let tx = await proxy.batchBuyback(
    //     [poolMock.address],
    //     [amount],
    //     USDC,
    //     encodedParams,
    //     {
    //       from: maintainer,
    //     },
    //   );
    //   await network.provider.send('evm_increaseTime', [1]);
    //   await network.provider.send('evm_mine');

    //   let JRTOut;
    //   truffleAssert.eventEmitted(tx, 'BatchBuyback', ev => {
    //     JRTOut = ev.JRTOut;
    //     return (
    //       ev.collateralIn.toString() == amount.toString() &&
    //       ev.receiver == buybackReceiver
    //     );
    //   });

    //   let poolStorage = await storageManager.getPoolStorage.call(
    //     poolMock.address,
    //   );
    //   let receiverJRTAfter = await JRTInstance.balanceOf.call(buybackReceiver);

    //   let poolCUSDCAfter = await cUSDC.balanceOf.call(poolMock.address);
    //   let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

    //   let expectedInterest = poolCUSDCAfter
    //     .add(toBN(amount))
    //     .sub(poolCUSDCBefore);
    //   let expectedDaoInterest = expectedInterest
    //     .mul(toBN(daoInterestShare))
    //     .div(toBN(Math.pow(10, 18)));
    //   let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

    //   // check tokens have moved correctly
    //   assert.equal(
    //     receiverJRTAfter.toString(),
    //     receiverJRTBefore.add(toBN(JRTOut)).toString(),
    //   );
    //   // interest has been added to pool
    //   assert.equal(
    //     poolCUSDCAfter.toString(),
    //     poolCUSDCBefore
    //       .add(toBN(expectedInterest))
    //       .sub(toBN(amount))
    //       .toString(),
    //   );
    //   assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

    //   // check pool storage update on proxy
    //   let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
    //     .add(toBN(expectedPoolInterest))
    //     .toString();
    //   assert.equal(
    //     poolStorage.collateralDeposited.toString(),
    //     expectedCollateral,
    //   );

    //   let expectedUnclaimedJRT = toBN(expectedDaoInterest)
    //     .mul(toBN(jrtShare))
    //     .div(toBN(Math.pow(10, 18)))
    //     .toString();
    //   assert.equal(poolStorage.unclaimedDaoJRT, expectedUnclaimedJRT);

    //   let expectedDaoCommisson = toBN(poolStorageBefore.unclaimedDaoCommission)
    //     .add(
    //       toBN(expectedDaoInterest)
    //         .mul(toBN(commissionShare))
    //         .div(toBN(Math.pow(10, 18))),
    //     )
    //     .toString();

    //   assert.equal(
    //     poolStorage.unclaimedDaoCommission,
    //     expectedDaoCommisson,
    //   );
    // });

    // it('Reverts if msg.sender is not maintainer', async () => {
    //   await truffleAssert.reverts(
    //     proxy.batchBuyback([poolMock.address], [10], USDC, toHex(0), {
    //       from: user,
    //     }),
    //     'Sender must be the maintainer',
    //   );
    // });

    // it('Reverts if number of pools and amount mismatch', async () => {
    //   await truffleAssert.reverts(
    //     proxy.batchBuyback([poolMock.address], [10, 20], USDC, toHex(0), {
    //       from: maintainer,
    //     }),
    //     'Invalid call',
    //   );
    // });

    // it('Reverts if pool has different collateral', async () => {
    //   await truffleAssert.reverts(
    //     proxy.batchBuyback([poolMock.address], [10], cUSDC.address, toHex(0), {
    //       from: maintainer,
    //     }),
    //     'Collateral mismatch',
    //   );
    // });

    it('Provides collateral to interest token conversion', async () => {
      let amount = toWei('10');
      let exchangeRate = (
        await cUSDC.getAccountSnapshot.call(poolMock.address)
      )[3];

      // passed as exact transfer to do
      let res = await proxy.collateralToInterestToken.call(
        poolMock.address,
        amount,
        { from: user },
      );
      let expectedOut = toBN(amount)
        .mul(toBN(Math.pow(10, 18)))
        .div(exchangeRate);
      assert.equal(res.interestTokenAmount.toString(), expectedOut.toString());
      assert.equal(res.interestTokenAddr.toString(), cUSDC.address);

      expectedOut = toBN(amount)
        .mul(exchangeRate)
        .div(toBN(Math.pow(10, 18)));
      // passed as exact transfer to receive
      res = await proxy.interestTokenToCollateral.call(
        poolMock.address,
        amount,
        { from: user },
      );
      assert.equal(res.collateralAmount.toString(), expectedOut.toString());
      assert.equal(res.interestTokenAddr.toString(), cUSDC.address);
    });

    it('Let a pool update his own state without moving collateral', async () => {
      let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);
      let poolUnderlyingBefore = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      // // borrow on compound to generate interest
      // await openCDP('1000', '40', accounts[3]);

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

      let poolCUSDCAfter = await cUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);
      let poolUnderlyingAfter = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      let expectedInterest = poolUnderlyingAfter.sub(
        toBN(poolStorageBefore.collateralDeposited),
      );
      let expectedDaoInterest = expectedInterest
        .mul(toBN(daoInterestShare))
        .div(toBN(Math.pow(10, 18)));
      let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

      // check return values to pool
      assert.equal(returnValues.tokensOut.toString(), '0');
      assertWeiDifference(
        returnValues.poolInterest.toString(),
        expectedPoolInterest.toString(),
      );
      assert.equal(
        returnValues.daoInterest.toString(),
        expectedDaoInterest.toString(),
      );

      // check tokens have moved correctly
      assert.equal(
        poolUnderlyingAfter.toString(),
        poolUnderlyingBefore
          .add(toBN(returnValues.poolInterest))
          .add(toBN(returnValues.daoInterest))
          .toString(),
      );

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(expectedPoolInterest)
        .toString();
      assertWeiDifference(
        poolStorage.collateralDeposited.toString(),
        expectedCollateral,
      );

      let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
        .add(
          toBN(returnValues.daoInterest)
            .mul(toBN(jrtShare))
            .div(toBN(Math.pow(10, 18))),
        )
        .toString();
      assert.equal(poolStorage.unclaimedDaoJRT, expectedUnclaimedJRT);

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

    it('Revert if msg.sender is not a registered pool', async () => {
      await truffleAssert.reverts(
        proxy.updateAccumulatedInterest({
          from: user,
        }),
        'Not existing pool',
      );
    });

    context('Migrations', () => {
      it('Correctly migrate lending module', async () => {
        let poolUnderlyingBefore = await cUSDC.balanceOfUnderlying.call(
          poolMock.address,
        );
        let poolUSDCBefore = await USDCInstance.balanceOf.call(
          poolMock.address,
        );

        // borrow on compound to generate interest
        // await openCDP('1000', '40', accounts[3]);

        // deploy new module
        newModule = await LendingModule.new();

        // set new module args and id
        let args = web3.eth.abi.encodeParameters(
          ['address', 'address'],
          [data[networkId].AaveV3, ZERO_ADDRESS],
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
        let amount = await cUSDC.balanceOf.call(poolMock.address);
        let returnValues = await poolMock.migrateLendingModule.call(
          cUSDC.address,
          'new',
          cUSDC.address,
          amount,
        );
        await poolMock.migrateLendingModule(
          cUSDC.address,
          'new',
          cUSDC.address,
          amount,
        );

        let poolUnderlyingAfter = await cUSDC.balanceOfUnderlying.call(
          poolMock.address,
        );
        let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);
        let poolStorage = await storageManager.getPoolData.call(
          poolMock.address,
        );
        let expectedInterest = toBN(poolUnderlyingAfter).sub(
          toBN(poolStorageBefore.collateralDeposited),
        );

        let expectedDaoInterest = expectedInterest
          .mul(toBN(daoInterestShare))
          .div(toBN(Math.pow(10, 18)));

        let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

        // check return values to pool
        assert.equal(
          returnValues.prevTotalCollateral.toString(),
          poolStorageBefore.collateralDeposited.toString(),
        );
        assert(
          returnValues.actualTotalCollateral.toString(),
          toBN(poolUnderlyingAfter)
            .sub(toBN(expectedDaoInterest))
            .sub(toBN(poolStorageBefore.unclaimedDaoCommission))
            .sub(toBN(poolStorageBefore.unclaimedDaoJRT))
            .toString(),
        );
        assertWeiDifference(
          returnValues.poolInterest.toString(),
          expectedPoolInterest.toString(),
        );

        // check pool storage update on proxy
        let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
          .add(expectedInterest)
          .toString();
        assert.equal(
          poolStorage.poolData.collateralDeposited.toString(),
          expectedCollateral,
        );

        let expectedUnclaimedDao = toBN(returnValues.actualTotalCollateral)
          .sub(toBN(returnValues.prevTotalCollateral))
          .sub(toBN(returnValues.poolInterest));

        let expectedUnclaimedJRT = toBN(poolStorageBefore.unclaimedDaoJRT)
          .add(
            expectedDaoInterest.mul(toBN(jrtShare)).div(toBN(Math.pow(10, 18))),
          )
          .toString();
        assert.equal(
          poolStorage.poolData.unclaimedDaoJRT.toString(),
          expectedUnclaimedJRT,
        );

        let expectedDaoCommisson = toBN(
          poolStorageBefore.unclaimedDaoCommission,
        )
          .add(
            expectedDaoInterest
              .mul(toBN(commissionShare))
              .div(toBN(Math.pow(10, 18))),
          )
          .toString();
        assert.equal(
          poolStorage.poolData.unclaimedDaoCommission.toString(),
          expectedDaoCommisson,
        );

        // check lending module changed
        assert.equal(poolStorage.lendingInfo.lendingModule, newModule.address);
        assert.equal(poolStorage.poolData.interestBearingToken, cUSDC.address);
      });

      it('Reverts if msg.sender is not a registered pool', async () => {
        await truffleAssert.reverts(
          proxy.migrateLendingModule('compound', accounts[5], 10, {
            from: user,
          }),
          'Not existing pool',
        );
      });

      it('Reverts if new bearing token is not set and new lending module reverts', async () => {
        let newLendingInfo = {
          lendingModule: proxy.address,
          args: '0x0000',
        };
        await proxy.setLendingModule('test', newLendingInfo, {
          from: maintainer,
        });
        await truffleAssert.reverts(
          poolMock.migrateLendingModule(cUSDC.address, 'test', ZERO_ADDRESS, 1),
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
        await proxy.migratePool(poolMock.address, newPool.address, {
          from: maintainer,
        });

        await truffleAssert.reverts(
          storageManager.getPoolData.call(poolMock.address),
          'Not existing pool',
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
      });
    });
  });
});
