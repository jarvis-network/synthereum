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

const VaultFactory = artifacts.require('SynthereumVaultFactory');
const SynthereumVault = artifacts.require('SynthereumVault');
const PoolMock = artifacts.require('PoolMockForVault');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const Manager = artifacts.require('SynthereumManager');
const Proxy = artifacts.require('TransparentUpgradeableProxy');
const SynthereumPoolRegistry = artifacts.require('SynthereumPoolRegistry');
const VaultRegistry = artifacts.require('SynthereumPublicVaultRegistry');
const PriceFeed = artifacts.require('SynthereumPriceFeed');
const ChainlinkPriceFeed = artifacts.require('SynthereumChainlinkPriceFeed');
const data = require('../../data/test/lendingTestnet.json');

const { toBN, toWei, toHex } = web3Utils;

contract('LP Vault', accounts => {
  let vault,
    factoryVault,
    vaultImpl,
    pool,
    USDC,
    jSynth,
    priceFeed,
    lpToken,
    manager,
    registry,
    vaultRegistry,
    finder;
  let networkId;
  let overCollateralization = toWei('0.1');
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
  let priceSpread = toWei('0.01');
  const maintainer = accounts[1];
  const poolRegistryInterface = web3Utils.stringToHex('PoolRegistry');
  const collateralDecimals = 6;

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

  const applySpread = (
    lpShare,
    positionCollBefore,
    totalShares,
    coverage,
    isDeposit,
  ) => {
    let spreadAmount;
    lpShare = toBN(lpShare);
    if (isDeposit) {
      let maxFrontRun = toBN(positionCollBefore)
        .mul(toBN(priceSpread))
        .div(toBN(coverage).sub(toBN(Math.pow(10, 18))));
      spreadAmount = maxFrontRun
        .mul(toBN(lpShare))
        .div(toBN(totalShares).add(maxFrontRun));
      return {
        coll: lpShare.sub(spreadAmount).toString(),
        fee: spreadAmount.toString(),
      };
    } else {
      spreadAmount = lpShare
        .mul(toBN(priceSpread))
        .mul(toBN(positionCollBefore))
        .div(toBN(coverage).sub(toBN(Math.pow(10, 18))))
        .div(toBN(totalShares));
      return spreadAmount.toString();
    }
  };

  const getRate = (collAmount, spreadFee, userDeposit, lpSupply) => {
    let expectedRate = toBN(collAmount)
      .add(toBN(spreadFee))
      .sub(toBN(userDeposit))
      .mul(toBN(Math.pow(10, 18)))
      .mul(toBN(Math.pow(10, 12)))
      .div(lpSupply);

    return expectedRate;
  };

  before(async () => {
    networkId = await web3.eth.net.getId();
    USDC = await TestnetSelfMintingERC20.at(data[networkId].USDC);
    // lpToken = await TestnetSelfMintingERC20.new(LPName, LPSymbol, 18, {
    //   from: accounts[0],
    // });
    decimals = await USDC.decimals.call();
    manager = await Manager.deployed();

    finder = await SynthereumFinder.deployed();
    let priceFeedAddr = await finder.getImplementationAddress(
      web3Utils.utf8ToHex('PriceFeed'),
    );
    priceFeed = await PriceFeed.at(priceFeedAddr);
    let chainlinkFeed = await ChainlinkPriceFeed.deployed();
    await chainlinkFeed.setPair(
      'jEUR/USDC',
      1,
      chainlinkFeed.address,
      0,
      ZERO_ADDRESS,
      priceSpread,
      { from: maintainer },
    );

    await priceFeed.addOracle('chainlink', chainlinkFeed.address, {
      from: maintainer,
    });
    await priceFeed.setPair('jEUR/USDC', 1, 'chainlink', [], {
      from: maintainer,
    });

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
    await finder.changeImplementationAddress(
      web3Utils.utf8ToHex('Deployer'),
      accounts[0],
      { from: maintainer },
    );

    vaultImpl = await SynthereumVault.new();
    factoryVault = await VaultFactory.new(finder.address, vaultImpl.address);
    vaultRegistry = await VaultRegistry.deployed();

    registry = await SynthereumPoolRegistry.new(finder.address);
    await finder.changeImplementationAddress(
      poolRegistryInterface,
      registry.address,
      { from: maintainer },
    );
    await registry.register(
      'jEUR',
      USDC.address,
      collateralDecimals,
      pool.address,
    );

    // mint collateral to user
    await getUSDC(user1, collateralAllocation);
    await getUSDC(user2, collateralAllocation);
    await getUSDC(user3, collateralAllocation);
    await getUSDC(user4, collateralAllocation);
    await getUSDC(user5, collateralAllocation);
    await getUSDC(mockInterest, collateralAllocation);
  });

  describe('Deployment and initialisation', () => {
    describe('Factory contract', async () => {
      before(async () => {
        let collateralWhiteListInstance =
          await SynthereumCollateralWhitelist.deployed();
        await collateralWhiteListInstance.addToWhitelist(USDC.address, {
          from: maintainer,
        });
        identifierWhiteListInstance =
          await SynthereumIdentifierWhitelist.deployed();
        await identifierWhiteListInstance.addToWhitelist(priceIdentifier, {
          from: maintainer,
        });
      });

      it('Correctly deploys and initialise a new vault through factory', async () => {
        let vaultAddr = await factoryVault.createVault.call(
          LPName,
          LPSymbol,
          pool.address,
          overCollateralization,
          { from: accounts[0] },
        );
        let tx = await factoryVault.createVault(
          LPName,
          LPSymbol,
          pool.address,
          overCollateralization,
          { from: accounts[0] },
        );
        vault = await SynthereumVault.at(vaultAddr);

        assert.equal(await vault.getPool.call(), pool.address);
        assert.equal(await vault.getPoolCollateral.call(), USDC.address);
        assert.equal(
          (await vault.getOvercollateralization.call()).toString(),
          overCollateralization.toString(),
        );
        assert.equal(await vault.name.call(), LPName);
        assert.equal(await vault.symbol.call(), LPSymbol);
        assert.equal(
          (await vault.getRate.call()).toString(),
          toBN(Math.pow(10, 18)),
        );
        assert.equal((await vault.getVersion.call()).toString(), '1');
        let spreadRes = await vault.getSpread.call();
        assert.equal(spreadRes.maxSpreadLong.toString(), priceSpread);
        assert.equal(spreadRes.maxSpreadShort.toString(), priceSpread);
      });

      it('Revert if sender is not synthereum deployer', async () => {
        await truffleAssert.reverts(
          factoryVault.createVault(
            LPName,
            LPSymbol,
            pool.address,
            overCollateralization,
            { from: accounts[1] },
          ),
          'Sender must be Synthereum deployer',
        );
      });
      it('Revert with 0 overcollateralisation specified', async () => {
        await truffleAssert.reverts(
          factoryVault.createVault(LPName, LPSymbol, pool.address, 0, {
            from: accounts[0],
          }),
          'Overcollateral requirement must be bigger than 0%',
        );
      });

      it('Revert if another initialization is tried', async () => {
        await truffleAssert.reverts(
          vault.initialize(
            LPName,
            LPSymbol,
            pool.address,
            overCollateralization,
            finder.address,
          ),
          'Initializable: contract is already initialized',
        );
      });
    });
  });

  describe('Deposit', () => {
    describe('Over collateralised scenario', async () => {
      before(async () => {
        // mock set position being overcollateralised
        await pool.setCoverage(toWei('1.15'));
      });

      it('First deposit - activates LP and correctly deposit', async () => {
        let userBalanceBefore = await USDC.balanceOf.call(user1);
        let userLPBalanceBefore = await vault.balanceOf.call(user1);
        assert.equal(userLPBalanceBefore.toString(), '0');

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        // deposit
        let collateralDeposit = toWei('5', 'gwei');
        await USDC.approve(vault.address, collateralDeposit, { from: user1 });
        let tx = await vault.deposit(collateralDeposit, user1, { from: user1 });
        let expectedUserLP = toBN(collateralDeposit).mul(
          toBN(Math.pow(10, toBN(18).sub(toBN(collateralDecimals)).toString())),
        );

        // check event
        truffleAssert.eventEmitted(tx, 'Deposit', ev => {
          return (
            ev.sender == user1 &&
            ev.netCollateralDeposited.toString() ==
              collateralDeposit.toString() &&
            ev.lpTokensOut.toString() == expectedUserLP.toString() &&
            ev.rate.toString() == toBN(Math.pow(10, 18)) &&
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

        assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());

        // rate should not have changed
        assert.equal((await vault.getRate.call()).toString(), Math.pow(10, 18));

        let discountRes = await vault.getDiscountedRate.call();
        assert.equal(discountRes.rate.toString(), toBN(Math.pow(10, 18)));
        assert.equal(discountRes.discountedRate.toString(), '0');
        assert.equal(discountRes.maxCollateralDiscounted.toString(), '0');
      });

      it('Rate unchanged - user 2 deposit - correctly mint LP tokens', async () => {
        let userBalanceBefore = await USDC.balanceOf.call(user2);
        let userLPBalanceBefore = await vault.balanceOf.call(user2);

        let collBefore = (await pool.positionLPInfo.call(vault.address))
          .actualCollateralAmount;

        assert.equal(userLPBalanceBefore.toString(), '0');

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        // deposit
        let LPTotalSupply = await vault.totalSupply.call();

        let collateralDeposit = toWei('10', 'gwei');
        await USDC.approve(vault.address, collateralDeposit, { from: user2 });
        let tx = await vault.deposit(collateralDeposit, user2, { from: user2 });

        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        // check event
        let lpOut, rate;
        truffleAssert.eventEmitted(tx, 'Deposit', ev => {
          lpOut = ev.lpTokensOut.toString();
          rate = ev.rate.toString();
          return true;
        });

        let collDifference = toBN(actualCollateralAmount).sub(toBN(collBefore));
        assert.equal(collDifference.toString(), collateralDeposit.toString());
        let userActualColl = toBN(lpOut)
          .mul(toBN(rate))
          .div(toBN(Math.pow(10, 12)))
          .div(toBN(Math.pow(10, 18)));

        let spreadAmount = collDifference.sub(userActualColl);
        let expectedSpread = applySpread(
          collateralDeposit,
          collBefore,
          actualCollateralAmount,
          toWei('1.15'),
          true,
        );
        assertWeiDifference(expectedSpread.fee, spreadAmount);

        let expectedColl = toBN(collateralDeposit).sub(spreadAmount);

        assert.equal(userActualColl.toString(), expectedColl.toString());

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

        assert.equal(userLPBalanceAfter.toString(), lpOut.toString());

        LPTotalSupply = await vault.totalSupply.call();
        actualCollateralAmount = (await pool.positionLPInfo.call(vault.address))
          .actualCollateralAmount;

        expectedRate = getRate(actualCollateralAmount, 0, 0, LPTotalSupply);
        assert.equal(
          (await vault.getRate.call()).toString(),
          expectedRate.toString(),
        );
      });

      it('Add interest, Changed rate, new deposit', async () => {
        let LPTotalSupply = await vault.totalSupply.call();

        // mock addition of interest to vault position
        let generatedInterest = toWei('10', 'gwei');
        await USDC.approve(pool.address, generatedInterest, {
          from: mockInterest,
        });
        await pool.addInterestToPosition(generatedInterest, {
          from: mockInterest,
        });

        let collBefore = (await pool.positionLPInfo.call(vault.address))
          .actualCollateralAmount;

        // deposit
        LPTotalSupply = await vault.totalSupply.call();
        let userBalanceBefore = await USDC.balanceOf.call(user3);
        let userLPBalanceBefore = await vault.balanceOf.call(user3);
        assert.equal(userLPBalanceBefore.toString(), '0');

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        let collateralDeposit = toWei('10', 'gwei');
        await USDC.approve(vault.address, collateralDeposit, { from: user3 });
        let tx = await vault.deposit(collateralDeposit, user3, { from: user3 });

        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        let lpOut, rate;
        truffleAssert.eventEmitted(tx, 'Deposit', ev => {
          lpOut = ev.lpTokensOut.toString();
          rate = ev.rate.toString();
          return true;
        });

        let collDifference = toBN(actualCollateralAmount).sub(toBN(collBefore));
        assert.equal(collDifference.toString(), collateralDeposit.toString());
        let userActualColl = toBN(lpOut)
          .mul(toBN(rate))
          .div(toBN(Math.pow(10, 12)))
          .div(toBN(Math.pow(10, 18)));

        let spreadAmount = collDifference.sub(userActualColl);
        let expectedSpread = applySpread(
          collateralDeposit,
          collBefore,
          actualCollateralAmount,
          toWei('1.15'),
          true,
        );
        assertWeiDifference(expectedSpread.fee, spreadAmount);

        let expectedColl = toBN(collateralDeposit).sub(spreadAmount);

        assert.equal(userActualColl.toString(), expectedColl.toString());

        // should be in add liquidity branch as lp is already active
        truffleAssert.eventNotEmitted(tx, 'LPActivated');

        // check
        let userBalanceAfter = await USDC.balanceOf.call(user3);
        let userLPBalanceAfter = await vault.balanceOf.call(user3);
        let vaultBalanceAfter = await USDC.balanceOf.call(vault.address);
        let LPTotalSupplyAfter = await vault.totalSupply.call();

        assert.equal(
          LPTotalSupplyAfter.toString(),
          toBN(LPTotalSupply).add(toBN(lpOut)).toString(),
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

        let expectedUserLP = lpOut;
        assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());

        // rate changed
        LPTotalSupply = await vault.totalSupply.call();

        actualCollateralAmount = (await pool.positionLPInfo.call(vault.address))
          .actualCollateralAmount;

        expectedRate = getRate(actualCollateralAmount, 0, 0, LPTotalSupply);

        assert.equal(
          (await vault.getRate.call()).toString(),
          expectedRate.toString(),
        );
      });

      it('Rejects with 0 amount', async () => {
        await truffleAssert.reverts(
          vault.deposit(0, user1, { from: user1 }),
          'Zero amount',
        );
      });
    });
    describe('Under-collateralised scenario (above liquidation below collateral requirement)', () => {
      let underCollatCoverage = toWei('1.07');

      before(async () => {
        // mock set position being under collateral requirement
        await pool.setCoverage(underCollatCoverage);
      });
      after(async () => {
        // at the end of this suite the position is overcollateralised
        await pool.setCoverage(toWei('1.15'));
      });

      it('Correctly provides rate at discount', async () => {
        let currentRegularRate = await vault.getRate.call();
        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        // mock set collateral expected to be 2.5% above actual collateral on position
        let collateralExpected = toBN(actualCollateralAmount)
          .mul(toBN(overCollateralization))
          .div(toBN(underCollatCoverage).sub(toBN(toWei('1'))));

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
        let actual = await vault.getDiscountedRate.call();
        let discountedRate = actual.discountedRate;
        let maxCollateralAtDiscount = actual.maxCollateralDiscounted;

        let purchaseAmount = toBN(maxCollateralAtDiscount).divn(2);

        let LPTotalSupply = await vault.totalSupply.call();

        // deposit
        let userBalanceBefore = await USDC.balanceOf.call(user4);
        let userLPBalanceBefore = await vault.balanceOf.call(user4);
        assert.equal(userLPBalanceBefore.toString(), '0');
        let expectedUserBalance = toBN(userBalanceBefore).sub(
          toBN(purchaseAmount),
        );

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        await USDC.approve(vault.address, purchaseAmount, { from: user4 });
        let tx = await vault.deposit(purchaseAmount, user4, { from: user4 });

        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        let expectedLPOut = toBN(purchaseAmount)
          .mul(toBN(Math.pow(10, 18)))
          .mul(toBN(Math.pow(10, 12)))
          .div(discountedRate);

        // check event
        truffleAssert.eventEmitted(tx, 'Deposit', ev => {
          return (
            ev.sender == user4 &&
            ev.netCollateralDeposited.toString() == purchaseAmount.toString() &&
            ev.lpTokensOut.toString() == expectedLPOut.toString() &&
            ev.rate.toString() == '0' &&
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
        assert.equal(
          expectedUserBalance.toString(),
          userBalanceAfter.toString(),
        );

        let expectedUserLP = expectedLPOut;
        assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());

        actualCollateralAmount = (await pool.positionLPInfo.call(vault.address))
          .actualCollateralAmount;

        // the discount should have diluted the regular rate
        let expectedNewRegularRate = getRate(
          actualCollateralAmount,
          0,
          0,
          LPTotalSupplyAfter,
        );

        let newRegularRate = await vault.getRate.call();
        assert.equal(
          newRegularRate.toString(),
          expectedNewRegularRate.toString(),
        );

        // discount should be less on less collateral
        let newCollateralExpected = toBN(actualCollateralAmount)
          .mul(toBN(overCollateralization))
          .div(toBN(underCollatCoverage).sub(toBN(toWei('1'))));

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
        let actual = await vault.getDiscountedRate.call();
        let discountedRate = actual.discountedRate;
        let maxCollateralAtDiscount = actual.maxCollateralDiscounted;

        let purchaseAmount = toBN(maxCollateralAtDiscount).muln(2);

        let LPTotalSupply = await vault.totalSupply.call();
        let collBefore = (await pool.positionLPInfo.call(vault.address))
          .actualCollateralAmount;

        // deposit
        let userBalanceBefore = await USDC.balanceOf.call(user5);
        let userLPBalanceBefore = await vault.balanceOf.call(user5);
        assert.equal(userLPBalanceBefore.toString(), '0');

        let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

        await USDC.approve(vault.address, purchaseAmount, { from: user5 });
        let tx = await vault.deposit(purchaseAmount, user5, { from: user5 });
        let expectedUserBalance = toBN(userBalanceBefore).sub(
          toBN(purchaseAmount),
        );

        let lpOut, rate;
        truffleAssert.eventEmitted(tx, 'Deposit', ev => {
          lpOut = ev.lpTokensOut.toString();
          rate = ev.rate.toString();
          return true;
        });

        let actualCollateralAmount = (
          await pool.positionLPInfo.call(vault.address)
        ).actualCollateralAmount;

        // the output is maxCollateral discounted + the remaining on regular rate
        let collDifference = toBN(purchaseAmount).sub(
          toBN(maxCollateralAtDiscount),
        );
        let userActualColl = toBN(lpOut)
          .mul(toBN(rate))
          .div(toBN(Math.pow(10, 12)))
          .div(toBN(Math.pow(10, 18)));

        let spreadAmount = collDifference.sub(userActualColl);
        let expectedSpread = applySpread(
          collDifference,
          toBN(actualCollateralAmount).sub(collDifference),
          actualCollateralAmount,
          toWei('1.10'),
          true,
        );
        // assertWeiDifference(expectedSpread.fee, spreadAmount);

        // should be in add liquidity branch as lp is already active
        truffleAssert.eventNotEmitted(tx, 'LPActivated');

        // check
        let userBalanceAfter = await USDC.balanceOf.call(user5);
        let userLPBalanceAfter = await vault.balanceOf.call(user5);
        let vaultBalanceAfter = await USDC.balanceOf.call(vault.address);
        let LPTotalSupplyAfter = await vault.totalSupply.call();

        assert.equal(
          LPTotalSupplyAfter.toString(),
          toBN(LPTotalSupply).add(toBN(lpOut)).toString(),
        );
        assert.equal(
          vaultBalanceAfter.toString(),
          vaultBalanceBefore.toString(),
        );
        assert.equal(
          expectedUserBalance.toString(),
          userBalanceAfter.toString(),
        );

        let expectedUserLP = lpOut;
        assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());

        actualCollateralAmount = (await pool.positionLPInfo.call(vault.address))
          .actualCollateralAmount;

        // the discount should have diluted the regular rate
        let expectedNewRegularRate = toBN(actualCollateralAmount)
          .mul(toBN(Math.pow(10, 18)))
          .mul(toBN(Math.pow(10, 12)))
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

      let expectedRate = getRate(
        actualCollateralAmount,
        0,
        0,
        totalSupplyLPBefore,
      );

      let currentRate = await vault.getRate.call();
      assert.equal(expectedRate.toString(), currentRate.toString());

      let LPInput = userLPBefore.divn(2);
      let expectedCollateralOut = currentRate
        .mul(LPInput)
        .div(toBN(Math.pow(10, 18)))
        .div(toBN(Math.pow(10, 12)));

      let tx = await vault.withdraw(LPInput, user1, { from: user1 });

      let spread = applySpread(
        LPInput,
        actualCollateralAmount,
        totalSupplyLPBefore,
        toWei('1.15'),
        false,
      );
      let expectedNetCollateralOut = expectedCollateralOut.sub(toBN(spread));

      // check event
      truffleAssert.eventEmitted(tx, 'Withdraw', ev => {
        return (
          ev.sender == user1 &&
          ev.lpTokensBurned.toString() == LPInput.toString() &&
          ev.netCollateralOut.toString() ==
            expectedNetCollateralOut.toString() &&
          ev.rate.toString() == expectedRate.toString()
        );
      });

      let userLPAfter = await vault.balanceOf.call(user1);
      let totalSupplyLPAfter = await vault.totalSupply.call();
      let userCollateralAfter = await USDC.balanceOf.call(user1);

      let expectedUserLP = userLPBefore.sub(LPInput);
      let expectedTotalSupply = totalSupplyLPBefore.sub(LPInput);
      let expectedUserCollateral = userCollateralBefore.add(
        expectedNetCollateralOut,
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

    it('Correctly remove all collateral from vault', async () => {
      let user1LPBefore = await vault.balanceOf.call(user1);
      let user2LPBefore = await vault.balanceOf.call(user2);
      let user3LPBefore = await vault.balanceOf.call(user3);
      let user4LPBefore = await vault.balanceOf.call(user4);
      let user5LPBefore = await vault.balanceOf.call(user5);

      let user1CollateralBefore = await USDC.balanceOf.call(user1);
      let user2CollateralBefore = await USDC.balanceOf.call(user2);
      let user3CollateralBefore = await USDC.balanceOf.call(user3);
      let user4CollateralBefore = await USDC.balanceOf.call(user4);
      let user5CollateralBefore = await USDC.balanceOf.call(user5);

      let totalBefore = toBN(user1CollateralBefore)
        .add(toBN(user2CollateralBefore))
        .add(toBN(user3CollateralBefore))
        .add(toBN(user4CollateralBefore))
        .add(toBN(user5CollateralBefore));

      let positionCollBefore = (await pool.positionLPInfo.call(vault.address))
        .actualCollateralAmount;

      await vault.withdraw(user1LPBefore, user1, { from: user1 });
      await vault.withdraw(user2LPBefore, user2, { from: user2 });
      await vault.withdraw(user3LPBefore, user3, { from: user3 });
      await vault.withdraw(user4LPBefore, user4, { from: user4 });
      await vault.withdraw(user5LPBefore, user5, { from: user5 });

      let totalSupplyLPAfter = await vault.totalSupply.call();
      let positionCollAfter = (await pool.positionLPInfo.call(vault.address))
        .actualCollateralAmount;

      let user1CollateralAfter = await USDC.balanceOf.call(user1);
      let user2CollateralAfter = await USDC.balanceOf.call(user2);
      let user3CollateralAfter = await USDC.balanceOf.call(user3);
      let user4CollateralAfter = await USDC.balanceOf.call(user4);
      let user5CollateralAfter = await USDC.balanceOf.call(user5);

      let total = toBN(user1CollateralAfter)
        .add(toBN(user2CollateralAfter))
        .add(toBN(user3CollateralAfter))
        .add(toBN(user5CollateralAfter))
        .add(toBN(user4CollateralAfter));

      assert.equal(totalSupplyLPAfter.toString(), '0');
      assert.equal(positionCollAfter.toString(), '0');
      assert.equal(
        total.sub(totalBefore).toString(),
        positionCollBefore.toString(),
      );
    });

    it('Correctly allow new deposits after vault is emptied', async () => {
      let userBalanceBefore = await USDC.balanceOf.call(user1);
      let userLPBalanceBefore = await vault.balanceOf.call(user1);
      assert.equal(userLPBalanceBefore.toString(), '0');

      let vaultBalanceBefore = await USDC.balanceOf.call(vault.address);

      // deposit
      let collateralDeposit = toWei('5', 'gwei');
      await USDC.approve(vault.address, collateralDeposit, { from: user1 });
      let tx = await vault.deposit(collateralDeposit, user1, { from: user1 });
      let expectedUserLP = toBN(collateralDeposit).mul(
        toBN(Math.pow(10, toBN(18).sub(toBN(collateralDecimals)).toString())),
      );

      // check event
      truffleAssert.eventEmitted(tx, 'Deposit', ev => {
        return (
          ev.sender == user1 &&
          ev.netCollateralDeposited.toString() ==
            collateralDeposit.toString() &&
          ev.lpTokensOut.toString() == expectedUserLP.toString() &&
          ev.rate.toString() == toBN(Math.pow(10, 18)) &&
          ev.discountedRate.toString() == '0'
        );
      });

      // check
      let userBalanceAfter = await USDC.balanceOf.call(user1);
      let userLPBalanceAfter = await vault.balanceOf.call(user1);
      let vaultBalanceAfter = await USDC.balanceOf.call(vault.address);

      assert.equal(vaultBalanceAfter.toString(), vaultBalanceBefore.toString());
      let expectedUserBalance = toBN(userBalanceBefore).sub(
        toBN(collateralDeposit),
      );
      assert.equal(expectedUserBalance.toString(), userBalanceAfter.toString());

      assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());

      // rate should not have changed
      assert.equal((await vault.getRate.call()).toString(), Math.pow(10, 18));
    });

    it('Rejects with zero amount', async () => {
      await truffleAssert.reverts(
        vault.withdraw(0, user1, { from: user1 }),
        'Zero amount',
      );
    });
  });

  describe('Donation', () => {
    it('Allows anyone to post collateral in the vault as a form of donation', async () => {
      let LPTotalSupply = await vault.totalSupply.call();
      let collBefore = (await pool.positionLPInfo.call(vault.address))
        .actualCollateralAmount;
      let userBalanceBefore = await USDC.balanceOf.call(user1);
      let amount = toWei('10', 'gwei');

      await USDC.approve(vault.address, amount, { from: user1 });
      let tx = await vault.donate(amount, { from: user1 });

      truffleAssert.eventEmitted(tx, 'Donation', ev => {
        return (
          ev.sender == user1 &&
          ev.collateralAmount.toString() == amount.toString()
        );
      });

      let LPTotalSupplyAft = await vault.totalSupply.call();
      let collAft = (await pool.positionLPInfo.call(vault.address))
        .actualCollateralAmount;
      let userBalanceAft = await USDC.balanceOf.call(user1);

      assert.equal(LPTotalSupply.toString(), LPTotalSupplyAft);
      assert.equal(
        collAft.toString(),
        toBN(collBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        userBalanceAft.toString(),
        toBN(userBalanceBefore).sub(toBN(amount)).toString(),
      );
    });

    it('Rejects with zero amount', async () => {
      await truffleAssert.reverts(
        vault.donate(0, { from: user1 }),
        'Zero amount',
      );
    });
  });

  describe('Manager - update of logic and admin', () => {
    let newVaultImpl;
    before(async () => {
      newVaultImpl = await SynthereumVault.new();
      let newVaultFactory = await VaultFactory.new(
        finder.address,
        newVaultImpl.address,
        { from: maintainer },
      );
      await finder.changeImplementationAddress(
        toHex('VaultFactory'),
        newVaultFactory.address,
        { from: maintainer },
      );
    });

    it('Correctly upgrades proxy to new implementation through manager - no extra args', async () => {
      let userLPBalanceBefore = await vault.balanceOf.call(user2);
      let vaultImplAct = await manager.getCurrentVaultImplementation.call(
        vault.address,
      );
      assert.equal(vaultImplAct, vaultImpl.address);

      await manager.upgradePublicVault([vault.address], [Buffer.from([])], {
        from: maintainer,
      });

      let userLPBalanceAfter = await vault.balanceOf.call(user2);
      vaultImplAct = await manager.getCurrentVaultImplementation.call(
        vault.address,
      );
      assert.equal(vaultImplAct, newVaultImpl.address);

      assert.equal(
        userLPBalanceAfter.toString(),
        userLPBalanceBefore.toString(),
      );
    });

    it('Correctly upgrades proxy to new admin address through manager', async () => {
      let newAdmin = accounts[4];

      await manager.changePublicVaultAdmin([vault.address], [newAdmin], {
        from: maintainer,
      });

      let proxy = await Proxy.at(vault.address);
      let actual = await proxy.admin.call({ from: newAdmin });
      assert.equal(actual, newAdmin);
      // new admin should the only one now that can call getAdmin from proxy
    });
  });

  describe('Register/Unregister', async () => {
    let pool1, pool2;
    let deployer = accounts[5];
    before(async () => {
      pool1 = await PoolMock.new(
        1,
        USDC.address,
        'jEUR',
        jSynth.address,
        priceIdentifier,
        {
          from: accounts[0],
        },
      );
      pool2 = await PoolMock.new(
        1,
        USDC.address,
        'jEUR',
        jSynth.address,
        priceIdentifier,
        {
          from: accounts[0],
        },
      );
      await registry.register(
        'jEUR',
        USDC.address,
        collateralDecimals,
        pool1.address,
      );
      await registry.register(
        'jEUR',
        USDC.address,
        collateralDecimals,
        pool2.address,
      );
      await finder.changeImplementationAddress(toHex('Deployer'), deployer, {
        from: accounts[1],
      });
    });

    it('Only deployer can register a new vault and pool', async () => {
      await vaultRegistry.registerVault(pool1.address, vault.address, {
        from: deployer,
      });
      let actualVaults = await vaultRegistry.getVaults(pool1.address);

      assert.equal(actualVaults.length, 1);
      assert.equal(actualVaults[0], vault.address);

      await truffleAssert.reverts(
        vaultRegistry.registerVault(pool1.address, vault.address),
        'Sender must be Synthereum deployer',
      );
    });
    it('Cannot register the same pair two times', async () => {
      await truffleAssert.reverts(
        vaultRegistry.registerVault(pool1.address, vault.address, {
          from: deployer,
        }),
        'Vault already registered',
      );
    });

    it('Only a pool is able to remove his mapped vault', async () => {
      await pool1.removeVaultFromRegistry(vaultRegistry.address, vault.address);
      let actualVaults = await vaultRegistry.getVaults(pool1.address);

      assert.equal(actualVaults.length, 0);

      // reverts if another address tries to remove
      await truffleAssert.reverts(
        vaultRegistry.removeVault(vault.address),
        'Vault not registered',
      );
    });

    it('Only deployer can migrate data when migrating a pool', async () => {
      await vaultRegistry.registerVault(pool1.address, vault.address, {
        from: deployer,
      });
      let actualVaults = await vaultRegistry.getVaults(pool1.address);
      assert.equal(actualVaults.length, 1);
      assert.equal(actualVaults[0], vault.address);
      assert.equal(await vault.getPool(), pool.address);

      await vaultRegistry.migrateVaults(pool1.address, pool2.address, {
        from: deployer,
      });
      actualVaults = await vaultRegistry.getVaults(pool1.address);
      assert.equal(actualVaults.length, 0);

      actualVaults = await vaultRegistry.getVaults(pool2.address);
      assert.equal(actualVaults.length, 1);
      assert.equal(actualVaults[0], vault.address);

      assert.equal(await vault.getPool(), pool2.address);

      // reverts if another address tries to migrate
      await truffleAssert.reverts(
        vaultRegistry.migrateVaults(pool1.address, pool2.address),
        'Sender must be Synthereum deployer',
      );
    });
  });
});
