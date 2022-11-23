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
    await getUSDC(toBN(deposit).add(toBN(borrow)).toString(), from);
    await USDCInstance.approve(cUSDC.address, deposit, { from });
    await cUSDC.mint(deposit, { from });
    await cUSDC.borrow(borrow, { from });

    // produce more blocks and interest
    await network.provider.send('evm_increaseTime', [
      getRandomInt(36000, 24 * 7 * 36000),
    ]);
    await network.provider.send('evm_mine');

    // repay all debt
    await USDCInstance.increaseAllowance(cUSDC.address, deposit, { from });
    await cUSDC.repayBorrow(borrow, {
      from,
    });
    await network.provider.send('evm_increaseTime', [5]);
    await network.provider.send('evm_mine');
  };

  const getUSDC = async (collateralAmount, recipient) => {
    let NativeWrapperAddr = data[networkId].NativeWrapper;

    let deadline = (await web3.eth.getBlock('latest')).timestamp + 60000;

    const nativeAmount = web3.utils.toWei('10');

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
  });

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

  describe('Compound module', () => {
    const user = accounts[2];
    let amountMint = '100';
    let amountFirstDeposit = '10';

    it('First deposit- Correctly deposits and update values', async () => {
      await getUSDC(amountMint, user);
      let userUSDCBefore = await USDCInstance.balanceOf.call(user);

      let exchangeRate = await cUSDC.exchangeRateCurrent.call();
      let userCUSDCBefore = await cUSDC.balanceOf.call(user);
      let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);
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

      let expectedCUSDCOut = toBN(amountFirstDeposit)
        .mul(toBN(Math.pow(10, 18)))
        .div(exchangeRate);
      let userUSDCAfter = await USDCInstance.balanceOf.call(user);
      let userCUSDCAfter = await cUSDC.balanceOf.call(user);
      let poolCUSDCAfter = await cUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);

      // check return values to pool
      assert.equal(
        returnValues.tokensOut.toString(),
        amountFirstDeposit.toString(),
      );
      assert.equal(
        returnValues.tokensTransferred.toString(),
        expectedCUSDCOut.toString(),
      );
      assert.equal(returnValues.poolInterest.toString(), '0');
      assert.equal(returnValues.daoInterest.toString(), '0');

      // check tokens have moved correctly
      assert.equal(
        userUSDCAfter.toString(),
        userUSDCBefore.sub(toBN(amountFirstDeposit)).toString(),
      );
      assert.equal(userCUSDCBefore.toString(), userCUSDCAfter.toString());
      assert.equal(
        poolCUSDCAfter.toString(),
        poolCUSDCBefore.add(expectedCUSDCOut).toString(),
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
      let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);
      let poolUnderlyingBefore = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );
      let userCUSDCBefore = await cUSDC.balanceOf.call(user);

      // borrow on compound to generate interest
      await openCDP('1000', '40', accounts[3]);

      let generatedInterest = await proxy.getAccumulatedInterest.call(
        poolMock.address,
      );

      let exchangeRate = await cUSDC.exchangeRateCurrent.call();
      let userUSDCBefore = await USDCInstance.balanceOf.call(user);
      let poolStorageBefore = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      let poolUSDCBefore = await USDCInstance.balanceOf.call(poolMock.address);

      // deposit to trigger interest split update
      let amountDeposit = '10';
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

      let expectedCUSDCOut = toBN(amountDeposit)
        .mul(toBN(Math.pow(10, 18)))
        .div(exchangeRate);

      let userUSDCAfter = await USDCInstance.balanceOf.call(user);
      let userCUSDCAfter = await cUSDC.balanceOf.call(user);
      let poolCUSDCAfter = await cUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);
      let poolUnderlyingAfter = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      let expectedInterest = poolUnderlyingAfter
        .sub(poolUnderlyingBefore)
        .sub(toBN(amountDeposit));
      let expectedDaoInterest = expectedInterest
        .mul(toBN(daoInterestShare))
        .div(toBN(Math.pow(10, 18)));
      let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

      // check return values to pool
      assert.equal(returnValues.tokensOut.toString(), amountDeposit.toString());
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
      assert.equal(
        generatedInterest.poolInterest.toString(),
        expectedPoolInterest.toString(),
      );

      // check tokens have moved correctly
      assert.equal(
        userUSDCAfter.toString(),
        userUSDCBefore.sub(toBN(amountDeposit)).toString(),
      );
      assert.equal(userCUSDCBefore.toString(), userCUSDCAfter.toString());
      assert.equal(
        poolCUSDCAfter.toString(),
        poolCUSDCBefore.add(expectedCUSDCOut).toString(),
      );
      assert.equal(poolUSDCBefore.toString(), poolUSDCAfter.toString());

      // check pool storage update on proxy
      let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
        .add(expectedPoolInterest)
        .add(toBN(amountDeposit))
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
      let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);
      let poolUnderlyingBefore = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      // borrow on compound to generate interest
      await openCDP('1000', '40', accounts[3]);

      let amountWithdraw = '1';
      let exchangeRate = await cUSDC.exchangeRateCurrent.call();
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
      await poolMock.withdraw(amountWithdraw, user, cUSDC.address, {
        from: user,
      });

      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );

      let USDCOut = toBN(amountWithdraw)
        .mul(exchangeRate)
        .div(toBN(Math.pow(10, 18)));

      let userUSDCAfter = await USDCInstance.balanceOf.call(user);
      let userCUSDCAfter = await cUSDC.balanceOf.call(user);
      let poolCUSDCAfter = await cUSDC.balanceOf.call(poolMock.address);
      let poolUSDCAfter = await USDCInstance.balanceOf.call(poolMock.address);
      let poolUnderlyingAfter = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      let expectedInterest = poolUnderlyingAfter
        .add(toBN(USDCOut))
        .sub(poolUnderlyingBefore);

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
        USDCOut.toString(),
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
        userUSDCBefore.add(toBN(returnValues.tokensTransferred)).toString(),
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
        .sub(toBN(USDCOut))
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

      // borrow on compound to generate interest
      await openCDP('1000', '40', accounts[3]);

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
      await network.provider.send('evm_increaseTime', [1]);
      await network.provider.send('evm_mine');

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
        .sub(poolUnderlyingBefore);
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
      assert.equal(
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
      let exchangeRate = await cUSDC.exchangeRateCurrent.call();

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
      assert.equal(res.interestTokenAmount.toString(), expectedOut.toString());
      assert.equal(res.interestTokenAddr.toString(), cUSDC.address);
    });

    it('Let a pool update his own state without moving collateral', async () => {
      let poolCUSDCBefore = await cUSDC.balanceOf.call(poolMock.address);
      let poolUnderlyingBefore = await cUSDC.balanceOfUnderlying.call(
        poolMock.address,
      );

      // borrow on compound to generate interest
      await openCDP('1000', '40', accounts[3]);

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

      let expectedInterest = poolUnderlyingAfter.sub(poolUnderlyingBefore);
      let expectedDaoInterest = expectedInterest
        .mul(toBN(daoInterestShare))
        .div(toBN(Math.pow(10, 18)));
      let expectedPoolInterest = expectedInterest.sub(expectedDaoInterest);

      // check return values to pool
      assert.equal(returnValues.tokensOut.toString(), '0');
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
        await openCDP('1000', '40', accounts[3]);

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
        let expectedInterest = poolUnderlyingAfter.sub(poolUnderlyingBefore);

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
          toBN(poolUnderlyingAfter)
            .sub(toBN(expectedDaoInterest))
            .sub(toBN(poolStorageBefore.unclaimedDaoCommission))
            .sub(toBN(poolStorageBefore.unclaimedDaoJRT))
            .toString(),
        );
        assert.equal(
          returnValues.poolInterest.toString(),
          expectedPoolInterest.toString(),
        );

        // check pool storage update on proxy
        let expectedCollateral = toBN(poolStorageBefore.collateralDeposited)
          .add(toBN(returnValues.poolInterest))
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
        await truffleAssert.reverts(
          poolMock.migrateLendingModule(
            cUSDC.address,
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
