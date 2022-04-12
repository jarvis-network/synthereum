const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');

const Vault = artifacts.require('Vault');
const PoolMock = artifacts.require('PoolMockForVault');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const data = require('../../data/test/lendingTestnet.json');

const { toBN, toWei, toHex } = web3Utils;

contract('Lending Vault', accounts => {
  let vault, pool, USDC, jSynth;
  let networkId;
  let overCollateralization = toWei('0.05');
  let LPName = 'vault LP';
  let LPSymbol = 'vLP';
  let user1 = accounts[2];
  let user2 = accounts[3];
  let user3 = accounts[4];
  let user4 = accounts[5];
  let mockInterest = accounts[5];
  let collateralAllocation = toWei('100');

  before(async () => {
    networkId = await web3.eth.net.getId();
    USDC = await TestnetSelfMintingERC20.at(data[networkId].USDC);

    jSynth = await SyntheticToken.new('jarvis euro', 'jEUR', 18, {
      from: accounts[0],
    });

    pool = await PoolMock.new(1, USDC.address, 'jEUR', jSynth.address, {
      from: accounts[0],
    });

    vault = await Vault.new();
    await vault.initialize(
      LPName,
      LPSymbol,
      pool.address,
      overCollateralization,
    );

    // mint collateral to user
    await USDC.mint(user1, collateralAllocation);
    await USDC.mint(user2, collateralAllocation);
    await USDC.mint(user3, collateralAllocation);
    await USDC.mint(mockInterest, collateralAllocation);
  });

  describe('Deployment and initialisation', () => {
    it('Correctly initialise the vault', async () => {
      assert.equal(await vault.getPool.call(), pool.address);
      assert.equal(await vault.getPoolCollateral.call(), USDC.address);
      assert.equal(
        (await vault.getOvercollateralisation.call()).toString(),
        overCollateralization.toString(),
      );
      assert.equal(await vault.name.call(), LPName);
      assert.equal(await vault.symbol.call(), LPSymbol);
      assert.equal((await vault.getRate.call()).toString(), toWei('1'));
    });

    it('Revert if another initialization is tried', async () => {
      await truffleAssert.reverts(
        vault.initialize(LPName, LPSymbol, pool.address, overCollateralization),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('Deposit', () => {
    describe('Over collateralised scenario', async () => {
      before(async () => {
        // mock set position being overcollateralised
        await pool.setPositionOvercollateralised(true);
      });

      it('First deposit - activates LP and correctly deposit', async () => {
        let userBalanceBefore = await USDC.balanceOf.call(user1);
        let userLPBalanceBefore = await vault.balanceOf.call(user1);
        assert.equal(userLPBalanceBefore.toString(), '0');

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        // deposit
        let collateralDeposit = toWei('50');
        await USDC.approve(vault.address, collateralDeposit, { from: user1 });
        let tx = await vault.deposit(collateralDeposit, { from: user1 });

        // check event
        truffleAssert.eventEmitted(tx, 'Deposit', ev => {
          return (
            ev.netCollateralDeposited.toString() ==
              collateralDeposit.toString() &&
            ev.lpTokensOut.toString() == collateralDeposit.toString() &&
            ev.rate.toString() == toWei('1') &&
            ev.discountedRate.toString() == '0'
          );
        });

        truffleAssert.eventEmitted(tx, 'LPActivated', ev => {
          return (
            ev.collateralAmount.toString() == collateralDeposit.toString() &&
            ev.overCollateralization.toString() ==
              overCollateralization.toString()
          );
        });

        // check
        let userBalanceAfter = await USDC.balanceOf.call(user1);
        let userLPBalanceAfter = await vault.balanceOf.call(user1);
        let vaultBalanceAfter = await USDC.balanceOf.call(vault.address);

        assert.equal(
          vaultBalanceAfter.toString(),
          vaultBalanceBefore.toString(),
        );
        let expectedUserBalance = toBN(userBalanceBefore).sub(
          toBN(collateralDeposit),
        );
        assert.equal(
          expectedUserBalance.toString(),
          userBalanceAfter.toString(),
        );

        let expectedUserLP = collateralDeposit;
        assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());

        // rate should not have changed
        assert.equal((await vault.getRate.call()).toString(), toWei('1'));
      });

      it('Rate unchanged - user 2 deposit - correctly mint LP tokens', async () => {
        let userBalanceBefore = await USDC.balanceOf.call(user2);
        let userLPBalanceBefore = await vault.balanceOf.call(user2);
        assert.equal(userLPBalanceBefore.toString(), '0');

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        // deposit
        let collateralDeposit = toWei('60');
        await USDC.approve(vault.address, collateralDeposit, { from: user2 });
        let tx = await vault.deposit(collateralDeposit, { from: user2 });

        // check event
        truffleAssert.eventEmitted(tx, 'Deposit', ev => {
          return (
            ev.netCollateralDeposited.toString() ==
              collateralDeposit.toString() &&
            ev.lpTokensOut.toString() == collateralDeposit.toString() &&
            ev.rate.toString() == toWei('1') &&
            ev.discountedRate.toString() == '0'
          );
        });

        // should be in add liquidity branch as lp is already active
        truffleAssert.eventNotEmitted(tx, 'LPActivated');

        // check
        let userBalanceAfter = await USDC.balanceOf.call(user2);
        let userLPBalanceAfter = await vault.balanceOf.call(user2);
        let vaultBalanceAfter = await USDC.balanceOf.call(vault.address);

        assert.equal(
          vaultBalanceAfter.toString(),
          vaultBalanceBefore.toString(),
        );
        let expectedUserBalance = toBN(userBalanceBefore).sub(
          toBN(collateralDeposit),
        );
        assert.equal(
          expectedUserBalance.toString(),
          userBalanceAfter.toString(),
        );

        let expectedUserLP = collateralDeposit;
        assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());

        // rate should not have changed
        assert.equal((await vault.getRate.call()).toString(), toWei('1'));
      });

      it('Changed rate, new deposit', async () => {
        assert.equal((await vault.getRate.call()).toString(), toWei('1'));

        let LPTotalSupply = await vault.totalSupply.call();
        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        // mock addition of interest to vault position
        let generatedInterest = toWei('10');
        await USDC.approve(pool.address, generatedInterest, {
          from: mockInterest,
        });
        await pool.addInterestToPosition(generatedInterest, {
          from: mockInterest,
        });

        // rate should have changed now
        let expectedRate = toBN(actualCollateralAmount).add(
          toBN(generatedInterest),
        );
        expectedRate = toBN(expectedRate)
          .mul(toBN(Math.pow(10, 18)))
          .div(toBN(LPTotalSupply));

        assert.equal(
          (await vault.getRate.call()).toString(),
          expectedRate.toString(),
        );

        // deposit
        let userBalanceBefore = await USDC.balanceOf.call(user3);
        let userLPBalanceBefore = await vault.balanceOf.call(user3);
        assert.equal(userLPBalanceBefore.toString(), '0');

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        let collateralDeposit = toWei('60');
        await USDC.approve(vault.address, collateralDeposit, { from: user3 });
        let tx = await vault.deposit(collateralDeposit, { from: user3 });

        let expectedLPOut = toBN(collateralDeposit)
          .mul(toBN(Math.pow(10, 18)))
          .div(expectedRate);

        // check event
        truffleAssert.eventEmitted(tx, 'Deposit', ev => {
          return (
            ev.netCollateralDeposited.toString() ==
              collateralDeposit.toString() &&
            ev.lpTokensOut.toString() == expectedLPOut.toString() &&
            ev.rate.toString() == expectedRate.toString() &&
            ev.discountedRate.toString() == '0'
          );
        });

        // should be in add liquidity branch as lp is already active
        truffleAssert.eventNotEmitted(tx, 'LPActivated');

        // check
        let userBalanceAfter = await USDC.balanceOf.call(user3);
        let userLPBalanceAfter = await vault.balanceOf.call(user3);
        let vaultBalanceAfter = await USDC.balanceOf.call(vault.address);
        let LPTotalSupplyAfter = await vault.totalSupply.call();

        assert.equal(
          LPTotalSupplyAfter.toString(),
          toBN(LPTotalSupply).add(expectedLPOut).toString(),
        );
        assert.equal(
          vaultBalanceAfter.toString(),
          vaultBalanceBefore.toString(),
        );
        let expectedUserBalance = toBN(userBalanceBefore).sub(
          toBN(collateralDeposit),
        );
        assert.equal(
          expectedUserBalance.toString(),
          userBalanceAfter.toString(),
        );

        let expectedUserLP = expectedLPOut;
        assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());

        // rate should not have changed
        assert.equal(
          (await vault.getRate.call()).toString(),
          expectedRate.toString(),
        );
      });
    });
    describe('Under-collateralised scenario (above liquidation below collateral requirement)', () => {
      before(async () => {
        // mock set position being under collateral requirement
        await pool.setPositionOvercollateralised(false);
      });

      it('Correctly provides rate at discount', async () => {
        let currentRegularRate = await vault.getRate.call();
        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        // mock set collateral expected to be 2.5% above actual collateral on position
        let collateralExpected = toBN(actualCollateralAmount).add(
          toBN(actualCollateralAmount).divn(40),
        );
        let mockUtilization = toBN(collateralExpected)
          .mul(toBN(Math.pow(10, 18)))
          .div(toBN(actualCollateralAmount));

        // mock set the utilization
        await pool.setUtilization(mockUtilization);

        let expectedCollateralDeficit = collateralExpected.sub(
          toBN(actualCollateralAmount),
        );
        let discountPct = expectedCollateralDeficit
          .mul(toBN(Math.pow(10, 18)))
          .div(collateralExpected);

        let expectedDiscountedRate = toBN(currentRegularRate).sub(
          toBN(currentRegularRate)
            .mul(discountPct)
            .div(toBN(Math.pow(10, 18))),
        );

        // check
        let actual = await vault.getDiscountedRate.call();
        assert.equal(
          actual.discountedRate.toString(),
          expectedDiscountedRate.toString(),
        );
        assert.equal(
          actual.maxCollateralDiscounted.toString(),
          expectedCollateralDeficit.toString(),
        );
      });

      it('Allows user to buy a portion of max collateral at discount', async () => {
        let currentRegularRate = await vault.getRate.call();
        let actual = await vault.getDiscountedRate.call();
        let discountedRate = actual.discountedRate;
        let maxCollateralAtDiscount = actual.maxCollateralDiscounted;

        let purchaseAmount = toBN(maxCollateralAtDiscount).divn(2);

        let LPTotalSupply = await vault.totalSupply.call();

        // deposit
        let userBalanceBefore = await USDC.balanceOf.call(user4);
        let userLPBalanceBefore = await vault.balanceOf.call(user4);
        assert.equal(userLPBalanceBefore.toString(), '0');

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        await USDC.approve(vault.address, purchaseAmount, { from: user4 });
        let tx = await vault.deposit(purchaseAmount, { from: user4 });

        let expectedLPOut = toBN(purchaseAmount)
          .mul(toBN(Math.pow(10, 18)))
          .div(discountedRate);

        // check event
        truffleAssert.eventEmitted(tx, 'Deposit', ev => {
          return (
            ev.netCollateralDeposited.toString() == purchaseAmount.toString() &&
            ev.lpTokensOut.toString() == expectedLPOut.toString() &&
            ev.rate.toString() == currentRegularRate.toString() &&
            ev.discountedRate.toString() == discountedRate.toString()
          );
        });

        // should be in add liquidity branch as lp is already active
        truffleAssert.eventNotEmitted(tx, 'LPActivated');

        // check
        let userBalanceAfter = await USDC.balanceOf.call(user4);
        let userLPBalanceAfter = await vault.balanceOf.call(user4);
        let vaultBalanceAfter = await USDC.balanceOf.call(vault.address);
        let LPTotalSupplyAfter = await vault.totalSupply.call();

        assert.equal(
          LPTotalSupplyAfter.toString(),
          toBN(LPTotalSupply).add(expectedLPOut).toString(),
        );
        assert.equal(
          vaultBalanceAfter.toString(),
          vaultBalanceBefore.toString(),
        );
        let expectedUserBalance = toBN(userBalanceBefore).sub(
          toBN(purchaseAmount),
        );
        assert.equal(
          expectedUserBalance.toString(),
          userBalanceAfter.toString(),
        );

        let expectedUserLP = expectedLPOut;
        assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());

        // rate should not have changed
        // assert.equal(
        //   (await vault.getRate.call()).toString(),
        //   expectedRate.toString(),
        // );
      });
    });
  });

  describe('Withdraw', () => {});
});
