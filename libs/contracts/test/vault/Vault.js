const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumCollateralWhitelist = artifacts.require(
  'SynthereumCollateralWhitelist',
);
const SynthereumIdentifierWhitelist = artifacts.require(
  'SynthereumIdentifierWhitelist',
);
const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');
const IUniswapRouter = artifacts.require('IUniswapV2Router02');

const VaultFactory = artifacts.require('SynthereumMultiLPVaultFactory');
const Vault = artifacts.require('Vault');
const PoolMock = artifacts.require('PoolMockForVault');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const data = require('../../data/test/lendingTestnet.json');

const { toBN, toWei, toHex } = web3Utils;

contract('Lending Vault', accounts => {
  let vault, factoryVault, pool, USDC, jSynth;
  let networkId;
  let overCollateralization = toWei('0.05');
  let LPName = 'vault LP';
  let LPSymbol = 'vLP';
  let user1 = accounts[2];
  let user2 = accounts[3];
  let user3 = accounts[4];
  let user4 = accounts[5];
  let user5 = accounts[6];
  let mockInterest = accounts[7];
  let collateralAllocation = toWei('50', 'gwei');
  let priceIdentifier = toHex('jEUR/USDC');
  const maintainer = accounts[1];

  const getUSDC = async (recipient, collateralAmount) => {
    let NativeWrapperAddr = data[networkId].NativeWrapper;

    let deadline = (await web3.eth.getBlock('latest')).timestamp + 60000;

    const nativeAmount = web3.utils.toWei('100000');
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
      [NativeWrapperAddr, USDC.address],
      recipient,
      deadline,
      { from: recipient, value: nativeAmount },
    );
  };

  before(async () => {
    networkId = await web3.eth.net.getId();
    USDC = await TestnetSelfMintingERC20.at(data[networkId].USDC);
    finder = await SynthereumFinder.deployed();

    jSynth = await SyntheticToken.new('jarvis euro', 'jEUR', 18, {
      from: accounts[0],
    });

    pool = await PoolMock.new(
      1,
      USDC.address,
      'jEUR',
      jSynth.address,
      priceIdentifier,
      {
        from: accounts[0],
      },
    );

    vault = await Vault.new();
    await vault.initialize(
      LPName,
      LPSymbol,
      pool.address,
      overCollateralization,
    );

    factoryVault = await VaultFactory.new(vault.address, finder.address);

    // mint collateral to user
    await getUSDC(user1, collateralAllocation);
    await getUSDC(user2, collateralAllocation);
    await getUSDC(user3, collateralAllocation);
    await getUSDC(user4, collateralAllocation);
    await getUSDC(user5, collateralAllocation);
    await getUSDC(mockInterest, collateralAllocation);
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

    describe('Factory contract', async () => {
      before(async () => {
        await finder.changeImplementationAddress(
          web3Utils.utf8ToHex('Deployer'),
          accounts[0],
          { from: maintainer },
        );

        let collateralWhiteListInstance = await SynthereumCollateralWhitelist.deployed();
        await collateralWhiteListInstance.addToWhitelist(USDC.address, {
          from: maintainer,
        });
        identifierWhiteListInstance = await SynthereumIdentifierWhitelist.deployed();
        await identifierWhiteListInstance.addToWhitelist(priceIdentifier, {
          from: maintainer,
        });
      });

      it('Correctly deploys and initialise a new vault through factory', async () => {
        let name = 'factoryVaault';
        let symbol = 'fcv';
        let overCollateralization = toWei('0.1');
        let vaultAddr = await factoryVault.createVault.call(
          name,
          symbol,
          pool.address,
          overCollateralization,
          { from: accounts[0] },
        );
        let tx = await factoryVault.createVault(
          name,
          symbol,
          pool.address,
          overCollateralization,
          { from: accounts[0] },
        );
        let newVault = await Vault.at(vaultAddr);

        // check event
        truffleAssert.eventEmitted(tx, 'CreatedVault', ev => {
          return (ev.vaultAddress = vaultAddr && ev.deployer == accounts[0]);
        });
        truffleAssert;
        assert.equal(await newVault.getPool.call(), pool.address);
        assert.equal(await newVault.getPoolCollateral.call(), USDC.address);
        assert.equal(
          (await newVault.getOvercollateralisation.call()).toString(),
          overCollateralization.toString(),
        );
        assert.equal(await newVault.name.call(), name);
        assert.equal(await newVault.symbol.call(), symbol);
        assert.equal((await newVault.getRate.call()).toString(), toWei('1'));
      });

      it('Revert with bad pool (identifier and collateral not whitelisted)', async () => {
        let badCollateralPool = await PoolMock.new(
          1,
          accounts[5],
          'jEUR',
          jSynth.address,
          priceIdentifier,
          {
            from: accounts[0],
          },
        );
        await truffleAssert.reverts(
          factoryVault.createVault(
            'name',
            'symbol',
            badCollateralPool.address,
            overCollateralization,
            { from: accounts[0] },
          ),
          'Collateral not supported',
        );

        let badIdPool = await PoolMock.new(
          1,
          USDC.address,
          'jEUR',
          jSynth.address,
          toHex('jEUR/EUR'),
          {
            from: accounts[0],
          },
        );
        await truffleAssert.reverts(
          factoryVault.createVault(
            'name',
            'symbol',
            badIdPool.address,
            overCollateralization,
            { from: accounts[0] },
          ),
          'Identifier not supported',
        );
      });
      it('Revert if sender is not synthereum deployer', async () => {
        await truffleAssert.reverts(
          factoryVault.createVault(
            'name',
            'symbol',
            pool.address,
            overCollateralization,
            { from: accounts[1] },
          ),
          'Sender must be Synthereum deployer',
        );
      });
      it('Revert without name or symbol', async () => {
        await truffleAssert.reverts(
          factoryVault.createVault(
            '',
            'symbol',
            pool.address,
            overCollateralization,
            { from: accounts[0] },
          ),
          'Missing LP token name',
        );
        await truffleAssert.reverts(
          factoryVault.createVault(
            'name',
            '',
            pool.address,
            overCollateralization,
            { from: accounts[0] },
          ),
          'Missing LP token symbol',
        );
      });
      it('Revert with 0 overcollateralisation specified', async () => {
        await truffleAssert.reverts(
          factoryVault.createVault('name', 'symbol', pool.address, 0, {
            from: accounts[0],
          }),
          'Overcollateral requirement must be bigger than 0%',
        );
      });
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
        let collateralDeposit = toWei('5', 'gwei');
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
        let collateralDeposit = toWei('10', 'gwei');
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
        let generatedInterest = toWei('10', 'gwei');
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

        let collateralDeposit = toWei('10', 'gwei');
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

      it('Rejects with 0 amount', async () => {
        await truffleAssert.reverts(
          vault.deposit(0, { from: user1 }),
          'Zero amount',
        );
      });
    });
    describe('Under-collateralised scenario (above liquidation below collateral requirement)', () => {
      before(async () => {
        // mock set position being under collateral requirement
        await pool.setPositionOvercollateralised(false);
      });
      after(async () => {
        // at the end of this suite the position is overcollateralised
        await pool.setPositionOvercollateralised(true);
      });

      let mockUtilization;
      it('Correctly provides rate at discount', async () => {
        let currentRegularRate = await vault.getRate.call();
        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        // mock set collateral expected to be 2.5% above actual collateral on position
        let collateralExpected = toBN(actualCollateralAmount).add(
          toBN(actualCollateralAmount).divn(40),
        );
        mockUtilization = toBN(collateralExpected)
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

        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        // the discount should have diluted the regular rate
        expectedNewRegularRate = toBN(actualCollateralAmount)
          .mul(toBN(Math.pow(10, 18)))
          .div(toBN(LPTotalSupplyAfter));
        let newRegularRate = await vault.getRate.call();
        assert.equal(
          newRegularRate.toString(),
          expectedNewRegularRate.toString(),
        );

        // discount should be less on less collateral
        let newCollateralExpected = toBN(mockUtilization)
          .mul(toBN(actualCollateralAmount))
          .div(toBN(Math.pow(10, 18)));
        let expectedNewCollateralDeficit = newCollateralExpected.sub(
          toBN(actualCollateralAmount),
        );
        let discountPct = expectedNewCollateralDeficit
          .mul(toBN(Math.pow(10, 18)))
          .div(newCollateralExpected);

        let expectedNewDiscountedRate = toBN(newRegularRate).sub(
          toBN(newRegularRate)
            .mul(discountPct)
            .div(toBN(Math.pow(10, 18))),
        );

        assert.equal(
          (await vault.getDiscountedRate.call()).discountedRate.toString(),
          expectedNewDiscountedRate.toString(),
        );
        assert.equal(
          (
            await vault.getDiscountedRate.call()
          ).maxCollateralDiscounted.toString(),
          expectedNewCollateralDeficit.toString(),
        );
      });

      it('Allows user to buy more collateral than in discount, with rate split', async () => {
        let currentRegularRate = await vault.getRate.call();
        let actual = await vault.getDiscountedRate.call();
        let discountedRate = actual.discountedRate;
        let maxCollateralAtDiscount = actual.maxCollateralDiscounted;

        let purchaseAmount = toBN(maxCollateralAtDiscount).muln(2);

        let LPTotalSupply = await vault.totalSupply.call();

        // deposit
        let userBalanceBefore = await USDC.balanceOf.call(user5);
        let userLPBalanceBefore = await vault.balanceOf.call(user5);
        assert.equal(userLPBalanceBefore.toString(), '0');

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        await USDC.approve(vault.address, purchaseAmount, { from: user5 });
        let tx = await vault.deposit(purchaseAmount, { from: user5 });

        // the output is maxCollateral discounted + the remaining on regular rate
        let remainingCollateral = toBN(purchaseAmount).sub(
          toBN(maxCollateralAtDiscount),
        );
        let expectedLPOut = toBN(maxCollateralAtDiscount)
          .mul(toBN(Math.pow(10, 18)))
          .div(discountedRate);
        expectedLPOut = expectedLPOut.add(
          remainingCollateral
            .mul(toBN(Math.pow(10, 18)))
            .div(currentRegularRate),
        );

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
        let userBalanceAfter = await USDC.balanceOf.call(user5);
        let userLPBalanceAfter = await vault.balanceOf.call(user5);
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

        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        // the discount should have diluted the regular rate
        expectedNewRegularRate = toBN(actualCollateralAmount)
          .mul(toBN(Math.pow(10, 18)))
          .div(toBN(LPTotalSupplyAfter));
        let newRegularRate = await vault.getRate.call();
        assert.equal(
          newRegularRate.toString(),
          expectedNewRegularRate.toString(),
        );
      });
    });
  });

  describe('Withdraw', () => {
    it('Correctly calculate collateral to withdraw - burn LP tokens', async () => {
      let userLPBefore = await vault.balanceOf.call(user1);
      let totalSupplyLPBefore = await vault.totalSupply.call();
      let userCollateralBefore = await USDC.balanceOf.call(user1);

      let actualCollateralAmount = (
        await pool.positionLPInfo.call(vault.address)
      ).actualCollateralAmount;

      let expectedRate = toBN(actualCollateralAmount)
        .mul(toBN(Math.pow(10, 18)))
        .div(totalSupplyLPBefore);
      let currentRate = await vault.getRate.call();
      assert.equal(expectedRate.toString(), currentRate.toString());

      let LPInput = userLPBefore.divn(2);
      let expectedCollateralOut = currentRate
        .mul(LPInput)
        .div(toBN(Math.pow(10, 18)));

      let tx = await vault.withdraw(LPInput, { from: user1 });

      // check event
      truffleAssert.eventEmitted(tx, 'Withdraw', ev => {
        return (
          ev.lpTokensBurned.toString() == LPInput.toString() &&
          ev.netCollateralOut.toString() == expectedCollateralOut.toString() &&
          ev.rate.toString() == expectedRate.toString()
        );
      });

      let userLPAfter = await vault.balanceOf.call(user1);
      let totalSupplyLPAfter = await vault.totalSupply.call();
      let userCollateralAfter = await USDC.balanceOf.call(user1);

      let expectedUserLP = userLPBefore.sub(LPInput);
      let expectedTotalSupply = totalSupplyLPBefore.sub(LPInput);
      let expectedUserCollateral = userCollateralBefore.add(
        expectedCollateralOut,
      );

      assert.equal(userLPAfter.toString(), expectedUserLP.toString());
      assert.equal(
        totalSupplyLPAfter.toString(),
        expectedTotalSupply.toString(),
      );
      assert.equal(
        userCollateralAfter.toString(),
        expectedUserCollateral.toString(),
      );
    });

    it('Rejects with zero amount', async () => {
      await truffleAssert.reverts(
        vault.withdraw(0, { from: user1 }),
        'Zero amount',
      );
    });
  });
});
