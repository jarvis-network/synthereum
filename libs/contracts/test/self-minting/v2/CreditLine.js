// Libraries and helpers
const {
  interfaceName,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { assert } = require('chai');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toWei, hexToUtf8, toBN, utf8ToHex } = web3Utils;

// Contracts to test
const CreditLine = artifacts.require('SynthereumCreditLine');
const CreditLineLib = artifacts.require('SynthereumCreditLineLib');

const MockOnchainOracle = artifacts.require('MockOnChainOracle');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const SynthereumManager = artifacts.require('SynthereumManager');

const SynthereumFinder = artifacts.require('SynthereumFinder');
const CreditLineControllerMock = artifacts.require('CreditLineControllerMock');

contract('Synthereum CreditLine ', function (accounts) {
  const contractDeployer = accounts[0];
  const maintainers = accounts[1];
  const sponsor = accounts[2];
  const tokenHolder = accounts[3];
  const other = accounts[4];
  const collateralOwner = accounts[5];
  const beneficiary = accounts[6];
  let feePercentage = toBN(toWei('0.002'));
  let overCollateralizationFactor = toBN(toWei('1.2'));
  let feeRecipient = accounts[7];
  let Fee = {
    feePercentage: feePercentage,
    feeRecipients: [feeRecipient],
    feeProportions: [1],
    totalFeeProportions: [1],
  };
  let capMintAmount = toBN(toWei('1000000'));

  // Contracts
  let collateral;
  let creditLine;
  let tokenCurrency;
  let identifierWhitelist;
  let mockOracle, mockOnchainOracle;
  let timer;
  let store;
  let creditLineParams;
  let roles;
  let synthereumFinderInstance;
  let creditLineControllerInstance;
  let synthereumManagerInstance;

  // Initial constant values
  const initialPositionTokens = toWei('80');
  const initialPositionCollateral = toWei('100');
  const syntheticName = 'Test Synthetic Token';
  const syntheticSymbol = 'SYNTH';
  const startTimestamp = Math.floor(Date.now() / 1000);
  const priceFeedIdentifier = web3.utils.padRight(utf8ToHex('JRT/EUR'), 64);
  const startingPrice = toBN(toWei('1.02'));
  const minSponsorTokens = toWei('5');

  // Conveniently asserts expected collateral and token balances, assuming that
  // there is only one synthetic token holder, the sponsor. Also assumes no
  // precision loss from `getCollateral()` coming from the fee multiplier.
  const checkBalances = async (
    expectedSponsorTokens,
    expectedSponsorCollateral,
    feeAmount,
  ) => {
    const positionData = await creditLine.positions.call(sponsor);
    const sponsorCollateral = positionData.rawCollateral;
    assert.equal(
      sponsorCollateral.toString(),
      expectedSponsorCollateral.toString(),
    );
    // The below assertion only holds if the sponsor holds all of the tokens outstanding.
    assert.equal(
      positionData.tokensOutstanding.toString(),
      expectedSponsorTokens.toString(),
    );
    assert.equal(
      (await tokenCurrency.balanceOf.call(sponsor)).toString(),
      expectedSponsorTokens.toString(),
    );

    assert.equal(
      (
        await creditLine.globalPositionData.call()
      ).rawTotalPositionCollateral.toString(),
      expectedSponsorCollateral.toString(),
    );

    assert.equal(
      (
        await creditLine.globalPositionData.call()
      ).totalTokensOutstanding.toString(),
      expectedSponsorTokens.toString(),
    );
    assert.equal(
      await collateral.balanceOf.call(creditLine.address),
      expectedSponsorCollateral.add(feeAmount).toString(),
    );
  };

  const checkFeeRecipients = async expectedFeeAmount => {
    const feeRecipientBalanceBefore = await collateral.balanceOf.call(
      feeRecipient,
    );
    // claim fees and check
    await creditLine.claimFee({ from: feeRecipient });
    const feeRecipientBalanceAfter = await collateral.balanceOf.call(
      feeRecipient,
    );

    assert.equal(
      feeRecipientBalanceBefore.add(expectedFeeAmount).toString(),
      feeRecipientBalanceAfter.toString(),
    );
  };

  const expectNoExcessCollateralToTrim = async () => {
    let collateralTrimAmount = await creditLine.trimExcess.call(
      collateral.address,
    );
    await creditLine.trimExcess(collateral.address);
    let beneficiaryCollateralBalance = await collateral.balanceOf.call(
      beneficiary,
    );

    assert.equal(collateralTrimAmount.toString(), '0');
    assert.equal(beneficiaryCollateralBalance.toString(), '0');
  };

  const calculateFeeAmount = collateralAmount => {
    const feeAmount = collateralAmount
      .mul(Fee.feePercentage)
      .div(toBN(Math.pow(10, 18)));
    return feeAmount;
  };

  before(async () => {
    // deploy and link library
    creditLineLib = await CreditLineLib.deployed();
    await CreditLine.link(creditLineLib);
  });

  beforeEach(async function () {
    // set roles
    roles = {
      admin: accounts[0],
      maintainers: [accounts[1]],
    };

    // Represents WETH or some other token that the sponsor and contracts don't control.
    collateral = await TestnetSelfMintingERC20.new('test', 'tsc', 18);
    await collateral.allocateTo(sponsor, toWei('100000000'), {
      from: collateralOwner,
    });
    await collateral.allocateTo(other, toWei('100000000'), {
      from: collateralOwner,
    });

    tokenCurrency = await SyntheticToken.new(
      syntheticName,
      syntheticSymbol,
      18,
      {
        from: contractDeployer,
      },
    );

    // Create identifier whitelist and register the price tracking ticker with it.
    identifierWhitelist = await IdentifierWhitelist.deployed();
    await identifierWhitelist.addSupportedIdentifier(priceFeedIdentifier, {
      from: contractDeployer,
    });

    // Create a mockOracle and finder. Register the mockMoracle with the finder.
    synthereumFinderInstance = await SynthereumFinder.deployed();
    mockOnchainOracle = await MockOnchainOracle.new({
      from: contractDeployer,
    });
    const mockOracleInterfaceName = utf8ToHex('PriceFeed');
    await synthereumFinderInstance.changeImplementationAddress(
      mockOracleInterfaceName,
      mockOnchainOracle.address,
      { from: maintainers },
    );
    // set oracle price
    await mockOnchainOracle.setPrice(priceFeedIdentifier, startingPrice);

    financialContractsAdmin = accounts[0]; // await FinancialContractsAdmin.deployed();
    // addressWhitelistInstance = await AddressWhitelist.deployed();

    creditLineParams = {
      collateralAddress: collateral.address,
      tokenAddress: tokenCurrency.address,
      priceFeedIdentifier: priceFeedIdentifier,
      minSponsorTokens: { rawValue: minSponsorTokens.toString() },
      excessTokenBeneficiary: beneficiary,
      version: 2,
      synthereumFinder: synthereumFinderInstance.address,
    };

    synthereumManagerInstance = await SynthereumManager.deployed();

    creditLine = await CreditLine.new(creditLineParams, roles, {
      from: contractDeployer,
    });
    creditLineControllerInstance = await CreditLineControllerMock.new();
    await synthereumFinderInstance.changeImplementationAddress(
      utf8ToHex('CreditLineController'),
      creditLineControllerInstance.address,
      { from: maintainers },
    );
    await creditLineControllerInstance.setCapMintAmount(
      [creditLine.address],
      [capMintAmount],
      { from: maintainers },
    );
    await creditLineControllerInstance.setOvercollateralization(
      [creditLine.address],
      [overCollateralizationFactor],
      { from: maintainers },
    );
    await creditLineControllerInstance.setFeePercentage(
      [creditLine.address],
      [Fee.feePercentage],
      { from: maintainers },
    );
    await creditLineControllerInstance.setFeeRecipients(
      [creditLine.address],
      [Fee.feeRecipients],
      [Fee.feeProportions],
      { from: maintainers },
    );
    // Give contract owner permissions.
    await tokenCurrency.addMinter(creditLine.address);
    await tokenCurrency.addBurner(creditLine.address);
  });

  afterEach(async () => {
    await expectNoExcessCollateralToTrim();
  });

  it('Correct deployment and variable assignment', async function () {
    // PricelessPosition variables
    assert.equal(
      await creditLine.collateralCurrency.call(),
      collateral.address,
    );
    assert.equal(await creditLine.tokenCurrency.call(), tokenCurrency.address);
    assert.equal(
      hexToUtf8(await creditLine.priceIdentifier.call()),
      hexToUtf8(priceFeedIdentifier),
    );

    // Synthetic token and synthereum parameters
    assert.equal(await tokenCurrency.name.call(), syntheticName);
    assert.equal(await tokenCurrency.symbol.call(), syntheticSymbol);
    assert.equal(await creditLine.version.call(), 2);
    assert.equal(
      await creditLine.collateralCurrency.call(),
      collateral.address,
    );
    assert.equal(await creditLine.tokenCurrencySymbol.call(), syntheticSymbol);
    assert.equal(
      await creditLine.synthereumFinder.call(),
      synthereumFinderInstance.address,
    );
    const returnedFee = await creditLine.getFeeInfo.call();
    assert.equal(returnedFee.feePercentage.toString(), Fee.feePercentage);
    assert.equal(returnedFee.feeRecipients[0], Fee.feeRecipients[0]);
    assert.equal(returnedFee.feeProportions[0], 1);
    assert.equal(returnedFee.totalFeeProportions, 1);
    assert.equal(
      (await creditLine.getCapMintAmount.call()).toString(),
      capMintAmount.toString(),
    );
  });

  it('Lifecycle', async function () {
    // Create the initial creditLine.
    const createTokens = toBN(toWei('100'));
    const createCollateral = toBN(toWei('150'));
    let expectedSponsorTokens = toBN(createTokens);
    let feeAmount = calculateFeeAmount(createCollateral);
    let expectedSponsorCollateral = createCollateral.sub(feeAmount);

    // Fails without approving collateral.
    await truffleAssert.reverts(
      creditLine.create(createCollateral, createTokens, {
        from: sponsor,
      }),
      'ERC20: transfer amount exceeds allowance',
    );
    await collateral.approve(creditLine.address, createCollateral, {
      from: sponsor,
    });
    const actualFee = await creditLine.create.call(
      createCollateral,
      createTokens,
      { from: sponsor },
    );
    assert.equal(
      feeAmount.toString(),
      actualFee.toString(),
      'Wrong fee output',
    );
    const tx = await creditLine.create(createCollateral, createTokens, {
      from: sponsor,
    });
    truffleAssert.eventEmitted(tx, 'PositionCreated', ev => {
      return (
        ev.sponsor == sponsor &&
        ev.collateralAmount == createCollateral.sub(actualFee).toString() &&
        ev.tokenAmount == createTokens.toString() &&
        ev.feeAmount == feeAmount.toString()
      );
    });
    truffleAssert.eventEmitted(tx, 'NewSponsor', ev => {
      return ev.sponsor == sponsor;
    });

    // check balances and fee distribution is ok
    await checkBalances(
      expectedSponsorTokens,
      expectedSponsorCollateral,
      feeAmount,
    );
    await checkFeeRecipients(feeAmount);

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Deposit.
    const depositCollateral = toWei('50');
    expectedSponsorCollateral = expectedSponsorCollateral.add(
      toBN(depositCollateral),
    );
    // Fails without approving collateral.
    await truffleAssert.reverts(
      creditLine.deposit(depositCollateral, { from: sponsor }),
      'ERC20: transfer amount exceeds allowance',
    );
    await collateral.approve(creditLine.address, depositCollateral, {
      from: sponsor,
    });
    // Cannot deposit 0 collateral.
    await truffleAssert.reverts(
      creditLine.deposit('0', { from: sponsor }),
      'Invalid collateral amount',
    );
    await creditLine.deposit(depositCollateral, { from: sponsor });
    await checkBalances(
      expectedSponsorTokens,
      expectedSponsorCollateral,
      toBN(0),
    );

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Withdraw.
    const withdrawCollateral = toWei('20');
    expectedSponsorCollateral = expectedSponsorCollateral.sub(
      toBN(withdrawCollateral),
    );
    let sponsorInitialBalance = await collateral.balanceOf.call(sponsor);
    // Cannot withdraw 0 collateral.
    await truffleAssert.reverts(
      creditLine.withdraw('0', { from: sponsor }),
      'Invalid collateral amount',
    );
    // Cannot withdraw more than balance. (The position currently has 150 + 50 collateral).
    await truffleAssert.reverts(
      creditLine.withdraw(toWei('201'), { from: sponsor }),
    );
    await creditLine.withdraw(withdrawCollateral, { from: sponsor });
    let sponsorFinalBalance = await collateral.balanceOf.call(sponsor);
    assert.equal(
      sponsorFinalBalance.sub(sponsorInitialBalance).toString(),
      withdrawCollateral,
    );
    await checkBalances(
      expectedSponsorTokens,
      expectedSponsorCollateral,
      toBN(0),
    );

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Redeem 50% of the tokens for 50% of the collateral.
    const redeemTokens = toBN(toWei('50'));
    expectedSponsorTokens = expectedSponsorTokens.sub(toBN(redeemTokens));
    expectedSponsorCollateral = expectedSponsorCollateral.divn(2);
    // Fails without approving token.
    await truffleAssert.reverts(
      creditLine.redeem(redeemTokens, { from: sponsor }),
      'ERC20: transfer amount exceeds allowance',
    );
    await tokenCurrency.approve(creditLine.address, redeemTokens, {
      from: sponsor,
    });
    sponsorInitialBalance = await collateral.balanceOf.call(sponsor);

    // Check redeem return value and event.
    expectedFeeAmount = calculateFeeAmount(expectedSponsorCollateral);

    const res = await creditLine.redeem.call(redeemTokens, { from: sponsor });
    let amountWithdrawn = res.amountWithdrawn;
    let redeemFee = res.feeAmount;

    let expectedWithdrawAmount = expectedSponsorCollateral.sub(redeemFee);
    assert.equal(
      amountWithdrawn,
      expectedWithdrawAmount.toString(),
      'Wrong redeemed output collateral',
    );
    assert.equal(
      expectedFeeAmount.toString(),
      redeemFee,
      'Wrong redeem output fee',
    );
    let redemptionResult = await creditLine.redeem(redeemTokens, {
      from: sponsor,
    });
    truffleAssert.eventEmitted(redemptionResult, 'Redeem', ev => {
      return (
        ev.sponsor == sponsor &&
        ev.collateralAmount == expectedWithdrawAmount.toString() &&
        ev.tokenAmount == redeemTokens.toString() &&
        ev.feeAmount == expectedFeeAmount.toString()
      );
    });

    sponsorFinalBalance = await collateral.balanceOf.call(sponsor);
    assert.equal(
      sponsorFinalBalance.sub(sponsorInitialBalance).toString(),
      expectedSponsorCollateral.sub(redeemFee).toString(),
    );
    await checkBalances(
      expectedSponsorTokens,
      expectedSponsorCollateral,
      redeemFee,
    );
    await checkFeeRecipients(redeemFee);

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Create additional.
    const createAdditionalTokens = toBN(toWei('10'));
    const createAdditionalCollateral = toBN(toWei('110'));
    feeAmount = calculateFeeAmount(createAdditionalCollateral);
    expectedSponsorTokens = expectedSponsorTokens.add(
      toBN(createAdditionalTokens),
    );
    expectedSponsorCollateral = expectedSponsorCollateral.add(
      toBN(createAdditionalCollateral).sub(feeAmount),
    );
    await collateral.approve(creditLine.address, createAdditionalCollateral, {
      from: sponsor,
    });
    // Check that create fails if missing Minter role.
    await creditLine.create(
      createAdditionalCollateral,
      createAdditionalTokens,
      { from: sponsor },
    );
    await checkBalances(
      expectedSponsorTokens,
      expectedSponsorCollateral,
      feeAmount,
    );
    await checkFeeRecipients(feeAmount);

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Redeem full.
    const redeemRemainingTokens = toBN(toWei('60'));
    feeAmount = calculateFeeAmount(expectedSponsorCollateral);
    await tokenCurrency.approve(creditLine.address, redeemRemainingTokens, {
      from: sponsor,
    });
    sponsorInitialBalance = await collateral.balanceOf.call(sponsor);
    redemptionResult = await creditLine.redeem(redeemRemainingTokens, {
      from: sponsor,
    });
    expectedNetSponsorCollateral = expectedSponsorCollateral.sub(feeAmount);
    truffleAssert.eventEmitted(redemptionResult, 'Redeem', ev => {
      return (
        ev.sponsor == sponsor &&
        ev.collateralAmount == expectedNetSponsorCollateral.toString() &&
        ev.tokenAmount == redeemRemainingTokens.toString() &&
        ev.feeAmount == feeAmount.toString()
      );
    });
    truffleAssert.eventEmitted(redemptionResult, 'EndedSponsorPosition', ev => {
      return ev.sponsor == sponsor;
    });

    sponsorFinalBalance = await collateral.balanceOf.call(sponsor);
    assert.equal(
      sponsorFinalBalance.sub(sponsorInitialBalance).toString(),
      expectedNetSponsorCollateral.toString(),
    );
    await checkBalances(toBN('0'), toBN('0'), feeAmount);
    await checkFeeRecipients(feeAmount);

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();
  });

  it('Cannot withdraw collateral if position gets undercollateralised', async function () {
    // Create the initial creditLine.
    const createTokens = toBN(toWei('100'));
    const createCollateral = toBN(toWei('150'));

    await collateral.approve(creditLine.address, createCollateral, {
      from: sponsor,
    });
    await creditLine.create(createCollateral, createTokens, {
      from: sponsor,
    });

    let feeAmount = calculateFeeAmount(createCollateral);

    // Cannot withdraw full collateral because the position would go under collateralized
    await truffleAssert.reverts(
      creditLine.withdraw(createCollateral.sub(feeAmount), {
        from: sponsor,
      }),
      'CR is not sufficiently high after the withdraw - try less amount',
    );
  });

  it('Non sponsor can use depositTo', async function () {
    await collateral.approve(creditLine.address, toWei('1000'), {
      from: other,
    });
    await collateral.approve(creditLine.address, toWei('1000'), {
      from: sponsor,
    });

    const numTokens = toWei('10');
    const collateralAmount = toWei('20');

    await creditLine.create(collateralAmount, numTokens, {
      from: sponsor,
    });

    let feeAmount = calculateFeeAmount(toBN(collateralAmount));

    // Other makes a deposit to the sponsor's account.
    let depositCollateral = toWei('1');
    await creditLine.depositTo(sponsor, depositCollateral, { from: other });

    assert.equal(
      (await creditLine.positions.call(sponsor)).rawCollateral.toString(),
      toBN(depositCollateral)
        .add(toBN(collateralAmount))
        .sub(feeAmount)
        .toString(),
    );
    assert.equal(
      (await creditLine.positions.call(other)).rawCollateral.toString(),
      '0',
    );
  });

  it("Non sponsor can't deposit, redeem, repay, or withdraw", async function () {
    await tokenCurrency.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });

    // Can't deposit without first creating a creditLine.
    await truffleAssert.reverts(
      creditLine.deposit(toWei('1'), { from: sponsor }),
      'Position has no collateral',
    );

    // Can't request a withdrawal without first creating a creditLine.
    await truffleAssert.reverts(
      creditLine.withdraw(toWei('1'), { from: sponsor }),
      'Position has no collateral',
    );

    // can't repay without first creating a creditLine
    await truffleAssert.reverts(
      creditLine.repay(toWei('1'), { from: sponsor }),
      'Position has no collateral',
    );

    // Even if the "sponsor" acquires a token somehow, they can't redeem.
    await collateral.approve(creditLine.address, toWei('1000'), {
      from: other,
    });
    await creditLine.create(toWei('10'), toWei('5'), {
      from: other,
    });
    await tokenCurrency.transfer(sponsor, toWei('1'), { from: other });
    await truffleAssert.reverts(
      creditLine.redeem(toWei('1'), { from: sponsor }),
      'Position has no collateral',
    );
  });

  it("Can't redeem more than position size", async function () {
    await tokenCurrency.approve(creditLine.address, toWei('1000'), {
      from: sponsor,
    });
    await collateral.approve(creditLine.address, toWei('1000'), {
      from: other,
    });
    await collateral.approve(creditLine.address, toWei('1000'), {
      from: sponsor,
    });

    const numTokens = toWei('7');
    const numCombinedTokens = toWei('14');
    await creditLine.create(toWei('10'), numTokens, {
      from: other,
    });
    await creditLine.create(toWei('10'), numTokens, {
      from: sponsor,
    });

    await tokenCurrency.transfer(sponsor, numTokens, { from: other });
    await truffleAssert.reverts(
      creditLine.redeem(numCombinedTokens, {
        from: sponsor,
      }),
      'Invalid token amount',
    );
    await creditLine.redeem(numTokens, {
      from: sponsor,
    });
    await truffleAssert.reverts(
      creditLine.redeem(numTokens, { from: sponsor }),
      'Position has no collateral',
    );
  });

  it('Existing sponsor can use depositTo on other account', async function () {
    await creditLineControllerInstance.setFeePercentage(
      [creditLine.address],
      [toWei('0')],
      { from: maintainers },
    );
    await collateral.approve(creditLine.address, toWei('1000'), {
      from: other,
    });
    await collateral.approve(creditLine.address, toWei('1000'), {
      from: sponsor,
    });

    const numTokens = toWei('7');
    await creditLine.create(toWei('10'), numTokens, {
      from: other,
    });
    await creditLine.create(toWei('10'), numTokens, {
      from: sponsor,
    });

    // Other makes a deposit to the sponsor's account despite having their own position.
    await creditLine.depositTo(sponsor, toWei('1'), { from: other });

    assert.equal(
      (await creditLine.positions.call(sponsor)).rawCollateral.toString(),
      toWei('11'),
    );
    assert.equal(
      (await creditLine.positions.call(other)).rawCollateral.toString(),
      toWei('10'),
    );
  });

  it('Sponsor use depositTo on own account', async function () {
    await creditLineControllerInstance.setFeePercentage(
      [creditLine.address],
      [toWei('0')],
      { from: maintainers },
    );
    await collateral.approve(creditLine.address, toWei('1000'), {
      from: sponsor,
    });

    const numTokens = toWei('7');
    await creditLine.create(toWei('10'), numTokens, {
      from: sponsor,
    });

    // Sponsor makes a deposit to their own account.
    await creditLine.depositTo(sponsor, toWei('1'), { from: sponsor });

    assert.equal(
      (await creditLine.positions(sponsor)).rawCollateral.toString(),
      toWei('11'),
    );
    await creditLineControllerInstance.setFeePercentage(
      [creditLine.address],
      [Fee.feePercentage],
      { from: maintainers },
    );
  });

  it('Sponsor can use repay to decrease their debt', async function () {
    await collateral.approve(creditLine.address, toWei('1000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(creditLine.address, toWei('1000'), {
      from: sponsor,
    });

    let inputCollateral = toWei('20');
    let outputTokens = toWei('12');
    await creditLine.create(inputCollateral, outputTokens, {
      from: sponsor,
    });
    let feeAmount = calculateFeeAmount(toBN(inputCollateral));

    const initialSponsorTokens = await tokenCurrency.balanceOf.call(sponsor);
    const initialSponsorTokenDebt = toBN(
      (await creditLine.positions.call(sponsor)).tokensOutstanding.rawValue,
    );
    const initialTotalTokensOutstanding = toBN(
      (await creditLine.globalPositionData.call()).totalTokensOutstanding
        .rawValue,
    );

    let repayTokens = toWei('6');
    let unlockedCollateral = toBN(toWei('20')).sub(feeAmount).divn(2);

    const repayResult = await creditLine.repay(repayTokens, {
      from: sponsor,
    });
    let repayFeeAmount = calculateFeeAmount(unlockedCollateral);

    // Event is correctly emitted.
    truffleAssert.eventEmitted(repayResult, 'Repay', ev => {
      return (
        ev.sponsor == sponsor &&
        ev.numTokensRepaid.toString() == repayTokens &&
        ev.newTokenCount.toString() ==
          toBN(outputTokens).sub(toBN(repayTokens)).toString() &&
        ev.feeAmount.toString() == repayFeeAmount.toString()
      );
    });

    const expectedCollAmount = toBN(inputCollateral)
      .sub(feeAmount)
      .sub(repayFeeAmount);
    assert.equal(
      expectedCollAmount.toString(),
      (await creditLine.positions.call(sponsor)).rawCollateral.toString(),
      'Wrong collateral result',
    );
    const tokensPaid = initialSponsorTokens.sub(
      await tokenCurrency.balanceOf(sponsor),
    );
    const tokenDebtDecreased = initialSponsorTokenDebt.sub(
      toBN(
        (await creditLine.positions.call(sponsor)).tokensOutstanding.rawValue,
      ),
    );
    const totalTokensOutstandingDecreased = initialTotalTokensOutstanding.sub(
      toBN(
        (await creditLine.globalPositionData.call()).totalTokensOutstanding
          .rawValue,
      ),
    );

    // Tokens paid back to contract,the token debt decrease and decrease in outstanding should all equal 40 tokens.
    assert.equal(tokensPaid.toString(), repayTokens);
    assert.equal(tokenDebtDecreased.toString(), repayTokens);
    assert.equal(totalTokensOutstandingDecreased.toString(), repayTokens);

    // Can not request to repay more than their token balance.
    assert.equal(
      (await creditLine.positions.call(sponsor)).tokensOutstanding.rawValue,
      toBN(outputTokens).sub(toBN(repayTokens)),
    );
    await truffleAssert.reverts(
      creditLine.repay(toWei('65'), { from: sponsor }),
      'Invalid token amount',
    );

    // Can not repay to position less than minimum sponsor size. Minimum sponsor size is 5 wei. Repaying 60 - 3 wei
    // would leave the position at a size of 2 wei, which is less than acceptable minimum.
    await truffleAssert.reverts(
      creditLine.repay(toBN(toWei('2')).toString(), {
        from: sponsor,
      }),
      'Below minimum sponsor position',
    );

    // Can repay up to the minimum sponsor size
    await creditLine.repay(toBN(toWei('1')), { from: sponsor });

    assert.equal(
      (await creditLine.positions.call(sponsor)).tokensOutstanding.rawValue,
      minSponsorTokens,
    );

    // As at the minimum sponsor size even removing 1 wei wll reverts.
    await truffleAssert.reverts(
      creditLine.repay('1', { from: sponsor }),
      'Below minimum sponsor position',
    );
  });

  it('Emergency shutdown: lifecycle', async function () {
    await creditLineControllerInstance.setFeePercentage(
      [creditLine.address],
      [toWei('0')],
      { from: maintainers },
    );
    // Create one position with 100 synthetic tokens to mint with 150 tokens of collateral. For this test say the
    // collateral is WETH with a value of 1USD and the synthetic is some fictional stock or commodity.
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });
    const numTokens = toWei('100');
    const amountCollateral = toWei('150');
    await creditLine.create(amountCollateral, numTokens, {
      from: sponsor,
    });

    // Transfer half the tokens from the sponsor to a tokenHolder. IRL this happens through the sponsor selling tokens.
    const tokenHolderTokens = toWei('50');
    await tokenCurrency.transfer(tokenHolder, tokenHolderTokens, {
      from: sponsor,
    });

    // Before the token sponsor has called emergencyShutdown should be disable settleEmergencyShutdown
    await truffleAssert.reverts(
      creditLine.settleEmergencyShutdown({ from: sponsor }),
      'Contract not emergency shutdown',
    );

    // Should reverts if emergency shutdown initialized by non financial admin or synthereum manager.
    await truffleAssert.reverts(
      creditLine.emergencyShutdown({ from: other }),
      'Caller must be a Synthereum manager',
    );

    // Synthereum manager can initiate emergency shutdown.
    const emergencyShutdownPrice = await mockOnchainOracle.getLatestPrice(
      priceFeedIdentifier,
    );
    const emergencyShutdownTx = await synthereumManagerInstance.emergencyShutdown(
      [creditLine.address],
      { from: maintainers },
    );

    // // // check event
    // let emergencyShutdownTimestamp;
    // truffleAssert.eventEmitted(
    //   emergencyShutdownTx,
    //   'EmergencyShutdown',
    //   ev => {
    //     emergencyShutdownTimestamp = ev.shutdownTimestamp;
    //     return (
    //       ev.caller == synthereumFinderInstance.address &&
    //       ev.settlementPrice == emergencyShutdownPrice
    //     );
    //   },
    // );

    // assert.equal(
    //   (await creditLine.positionManagerData.call()).emergencyShutdownTimestamp,
    //   emergencyShutdownTimestamp,
    // );
    assert.equal(
      (await creditLine.emergencyShutdownPrice.call()).toString(),
      emergencyShutdownPrice.toString(),
    );

    // Emergency shutdown should not be able to be called a second time.
    await truffleAssert.reverts(
      synthereumManagerInstance.emergencyShutdown([creditLine.address], {
        from: maintainers,
      }),
      'Contract emergency shutdown',
    );

    // All contract functions should also blocked as emergency shutdown.
    await truffleAssert.reverts(
      creditLine.create(toWei('1'), toWei('1'), {
        from: sponsor,
      }),
      'Contract emergency shutdown',
    );
    await truffleAssert.reverts(
      creditLine.deposit(toWei('1'), { from: sponsor }),
      'Contract emergency shutdown',
    );
    await truffleAssert.reverts(
      creditLine.withdraw(toWei('1'), { from: sponsor }),
      'Contract emergency shutdown',
    );
    await truffleAssert.reverts(
      creditLine.redeem(toWei('1'), { from: sponsor }),
      'Contract emergency shutdown',
    );
    await truffleAssert.reverts(
      creditLine.repay(toWei('2'), { from: sponsor }),
      'Contract emergency shutdown',
    );

    // Token holders (`sponsor` and `tokenHolder`) should now be able to withdraw post emergency shutdown.
    // From the token holder's perspective, they are entitled to the value of their tokens, notated in the underlying.
    // They have 50 tokens settled at a price of 1.1 should yield 55 units of underling (or 55 USD as underlying is WETH).
    const tokenHolderInitialCollateral = await collateral.balanceOf(
      tokenHolder,
    );
    const tokenHolderInitialSynthetic = await tokenCurrency.balanceOf(
      tokenHolder,
    );
    assert.equal(tokenHolderInitialSynthetic, tokenHolderTokens);

    // Approve the tokens to be moved by the contract and execute the settlement.
    await tokenCurrency.approve(
      creditLine.address,
      tokenHolderInitialSynthetic,
      {
        from: tokenHolder,
      },
    );

    const settleTx = await creditLine.settleEmergencyShutdown({
      from: tokenHolder,
    });

    const tokenHolderFinalCollateral = await collateral.balanceOf(tokenHolder);
    const tokenHolderFinalSynthetic = await tokenCurrency.balanceOf(
      tokenHolder,
    );
    const settledCollateral = tokenHolderInitialSynthetic
      .mul(toBN(emergencyShutdownPrice))
      .div(toBN(Math.pow(10, 18)));

    truffleAssert.eventEmitted(settleTx, 'SettleEmergencyShutdown', ev => {
      return (
        ev.caller == tokenHolder &&
        ev.tokensBurned == tokenHolderTokens.toString() &&
        ev.collateralReturned == settledCollateral.toString()
      );
    });
    assert.equal(
      tokenHolderFinalCollateral.sub(tokenHolderInitialCollateral).toString(),
      settledCollateral.toString(),
    );

    // The token holder should have no synthetic positions left after settlement.
    assert.equal(tokenHolderFinalSynthetic, 0);

    // If the tokenHolder tries to withdraw again they should get no additional tokens; all have been withdrawn (same as normal expiratory).
    const tokenHolderInitialCollateral_secondWithdrawal = await collateral.balanceOf(
      tokenHolder,
    );
    const tokenHolderInitialSynthetic_secondWithdrawal = await tokenCurrency.balanceOf(
      tokenHolder,
    );
    assert.equal(tokenHolderInitialSynthetic, tokenHolderTokens);
    await tokenCurrency.approve(
      creditLine.address,
      tokenHolderInitialSynthetic,
      { from: tokenHolder },
    );
    await creditLine.settleEmergencyShutdown({ from: tokenHolder });
    const tokenHolderFinalCollateral_secondWithdrawal = await collateral.balanceOf(
      tokenHolder,
    );
    const tokenHolderFinalSynthetic_secondWithdrawal = await tokenCurrency.balanceOf(
      tokenHolder,
    );
    assert.equal(
      tokenHolderInitialCollateral_secondWithdrawal.toString(),
      tokenHolderFinalCollateral_secondWithdrawal.toString(),
    );
    assert.equal(
      tokenHolderInitialSynthetic_secondWithdrawal.toString(),
      tokenHolderFinalSynthetic_secondWithdrawal.toString(),
    );

    // For the sponsor, they are entitled to the underlying value of their remaining synthetic tokens + the excess collateral
    // in their position at time of settlement. The sponsor had 150 units of collateral in their position and the final TRV
    // of their synthetics they sold is 110. Their redeemed amount for this excess collateral is the difference between the two.
    // The sponsor also has 50 synthetic tokens that they did not sell.
    // This makes their expected redemption = 150 - 110 + 50 * 1.1 = 95
    const sponsorInitialCollateral = await collateral.balanceOf(sponsor);
    const sponsorInitialSynthetic = await tokenCurrency.balanceOf(sponsor);

    // Approve tokens to be moved by the contract and execute the settlement.
    await tokenCurrency.approve(creditLine.address, sponsorInitialSynthetic, {
      from: sponsor,
    });
    await creditLine.settleEmergencyShutdown({
      from: sponsor,
    });
    const sponsorFinalCollateral = await collateral.balanceOf(sponsor);
    const sponsorFinalSynthetic = await tokenCurrency.balanceOf(sponsor);

    // The token Sponsor should gain the value of their synthetics in underlying
    // + their excess collateral from the over collateralization in their position
    let sponsorDebt = toBN(numTokens)
      .mul(toBN(emergencyShutdownPrice))
      .div(toBN(Math.pow(10, 18)));
    let tokensLiquidationRepayAmount = sponsorInitialSynthetic
      .mul(toBN(emergencyShutdownPrice))
      .div(toBN(Math.pow(10, 18)));
    let expectedTotalSponsorCollateralReturned = toBN(amountCollateral)
      .sub(sponsorDebt)
      .add(tokensLiquidationRepayAmount);

    assert.equal(
      sponsorFinalCollateral.toString(),
      sponsorInitialCollateral
        .add(expectedTotalSponsorCollateralReturned)
        .toString(),
    );

    // The token Sponsor should have no synthetic positions left after settlement.
    assert.equal(sponsorFinalSynthetic, 0);
  });

  it('Oracle swap post shutdown', async function () {
    await creditLineControllerInstance.setFeePercentage(
      [creditLine.address],
      [toWei('0')],
      { from: maintainers },
    );
    // Approvals
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(creditLine.address, toWei('100000'), {
      from: tokenHolder,
    });
    await tokenCurrency.approve(creditLine.address, toWei('100000'), {
      from: other,
    });

    // Create one position with 200 synthetic tokens to mint with 300 tokens of collateral. For this test say the
    // collateral is WETH with a value of 1USD and the synthetic is some fictional stock or commodity.
    const amountCollateral = toWei('300');
    const numTokens = toWei('200');
    await creditLine.create(amountCollateral, numTokens, {
      from: sponsor,
    });

    // Transfer 100 the tokens from the sponsor to two separate holders. IRL this happens through the sponsor selling
    // tokens.
    const tokenHolderTokens = toWei('100');
    await tokenCurrency.transfer(tokenHolder, tokenHolderTokens, {
      from: sponsor,
    });
    await tokenCurrency.transfer(other, tokenHolderTokens, {
      from: sponsor,
    });

    // Emergency shutdown contract to enable settlement.
    await synthereumManagerInstance.emergencyShutdown([creditLine.address], {
      from: maintainers,
    });

    // Token holder should receive 120 collateral tokens for their 100 synthetic tokens.
    let initialCollateral = await collateral.balanceOf.call(tokenHolder);
    await creditLine.settleEmergencyShutdown({ from: tokenHolder });
    let collateralPaid = (await collateral.balanceOf.call(tokenHolder)).sub(
      initialCollateral,
    );

    let emergencyShutdownPrice = await mockOnchainOracle.getLatestPrice(
      priceFeedIdentifier,
    );
    assert.equal(
      collateralPaid.toString(),
      toBN(tokenHolderTokens)
        .mul(emergencyShutdownPrice)
        .div(toBN(Math.pow(10, 18)))
        .toString(),
    );

    // Create new oracle, replace it in the finder, and push a different price to it.
    const newMockOracle = await MockOnchainOracle.new({
      from: contractDeployer,
    });
    await synthereumFinderInstance.changeImplementationAddress(
      utf8ToHex('PriceFeed'),
      newMockOracle.address,
      {
        from: maintainers,
      },
    );

    // Settle emergency shutdown should still work even if the new oracle has no price.
    initialCollateral = await collateral.balanceOf.call(sponsor);
    await creditLine.settleEmergencyShutdown({ from: sponsor });
    let collateralPaidSponsor = (await collateral.balanceOf.call(sponsor)).sub(
      initialCollateral,
    );

    assert.equal(
      collateralPaidSponsor.toString(),
      toBN(amountCollateral)
        .sub(
          toBN(numTokens)
            .mul(emergencyShutdownPrice)
            .div(toBN(Math.pow(10, 18))),
        )
        .toString(),
    );

    // set new oracle price
    await newMockOracle.setPrice(priceFeedIdentifier, toWei('1.1'));

    // Second token holder should receive the same payout as the first despite the oracle price being changed.
    initialCollateral = await collateral.balanceOf.call(other);
    await creditLine.settleEmergencyShutdown({ from: other });
    let collateralPaidSecond = (await collateral.balanceOf.call(other)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid.toString(), collateralPaidSecond.toString());
  });

  it('Oracle price can resolve to 0', async function () {
    await creditLineControllerInstance.setFeePercentage(
      [creditLine.address],
      [toWei('0')],
      { from: maintainers },
    );
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(creditLine.address, toWei('100000'), {
      from: tokenHolder,
    });

    // For the price to resolve to 0 the outcome is likely a binary event (1 for true, 0 for false.)
    await creditLine.create(toWei('300'), toWei('200'), {
      from: sponsor,
    });
    await tokenCurrency.transfer(tokenHolder, toWei('100'), {
      from: sponsor,
    });

    // Push a settlement price into the mock oracle, say price is 0. This means that
    // each token debt is worth 0 and the sponsor should get back their full collateral, even though they dont have all
    // the tokens. The token holder should get nothing.
    await mockOnchainOracle.setPrice(priceFeedIdentifier, toWei('0'));
    await synthereumManagerInstance.emergencyShutdown([creditLine.address], {
      from: maintainers,
    });

    // Token holder should receive 0 collateral tokens for their 100 synthetic tokens as the price is 0.
    let initialCollateral = await collateral.balanceOf.call(tokenHolder);
    await creditLine.settleEmergencyShutdown({ from: tokenHolder });
    let collateralPaid = (await collateral.balanceOf(tokenHolder)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid.toString(), toWei('0'));

    // Settle emergency from the sponsor should give them back all their collateral, as token debt is worth 0.
    initialCollateral = await collateral.balanceOf.call(sponsor);
    await creditLine.settleEmergencyShutdown({ from: sponsor });
    collateralPaid = (await collateral.balanceOf.call(sponsor)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid.toString(), toWei('300'));
  });

  describe('Liquidation', () => {
    let liquidationRewardPct = toBN(toWei('0.2'));
    let createTokens, createCollateral;
    let liquidatorCollateral, liquidatorTokens;

    beforeEach(async () => {
      await creditLineControllerInstance.setFeePercentage(
        [creditLine.address],
        [toWei('0')],
        { from: maintainers },
      );

      // Create the initial creditLine.
      createTokens = toBN(toWei('1100'));
      createCollateral = toBN(toWei('1400'));

      await collateral.approve(creditLine.address, createCollateral, {
        from: sponsor,
      });
      await creditLine.create(createCollateral, createTokens, {
        from: sponsor,
      });

      // create liquidator position to have tokens
      liquidatorCollateral = toBN(toWei('10000'));
      liquidatorTokens = toBN(toWei('2000'));

      await collateral.approve(creditLine.address, liquidatorCollateral, {
        from: other,
      });
      await creditLine.create(liquidatorCollateral, liquidatorTokens, {
        from: other,
      });

      // set liquidator percentage
      await creditLineControllerInstance.setLiquidationRewardPercentage(
        [creditLine.address],
        [{ rawValue: liquidationRewardPct.toString() }],
        { from: maintainers },
      );
    });

    it('Correctly liquidates an undercollateralised amount, position capitalised', async () => {
      // change price - position is under collateral requirement but still cover the debt
      const updatedPrice = toBN(toWei('1.1'));
      await mockOnchainOracle.setPrice(priceFeedIdentifier, updatedPrice);

      const collateralRequirement = createTokens
        .mul(updatedPrice)
        .div(toBN(Math.pow(10, 18)))
        .mul(overCollateralizationFactor)
        .div(toBN(Math.pow(10, 18)));
      assert.equal(
        collateralRequirement.sub(createCollateral) > 0,
        true,
        'Not undercollateralised',
      );

      // let inversePrice = toBN(toWei('1')).div(updatedPrice);
      const liquidationTokens = toBN(toWei('40'));

      let liquidatedCollateralPortion = liquidationTokens
        .mul(createCollateral)
        .div(createTokens);
      const liquidatedTokensValue = liquidationTokens
        .mul(updatedPrice)
        .div(toBN(Math.pow(10, 18)));

      const isCapitalised = liquidatedCollateralPortion.gt(
        liquidatedTokensValue,
      );
      let expectedLiquidatorReward = isCapitalised
        ? liquidatedCollateralPortion
            .sub(liquidatedTokensValue)
            .mul(liquidationRewardPct)
            .div(toBN(Math.pow(10, 18)))
        : toBN(0);

      let expectedLiquidatedCollateral = isCapitalised
        ? liquidatedTokensValue
        : liquidatedTokensValue.gt(liquidatedCollateralPortion)
        ? liquidatedCollateralPortion
        : liquidatedTokensValue;

      let liquidatorCollateralBalanceBefore = await collateral.balanceOf.call(
        other,
      );
      let liquidatorTokenBalanceBefore = await tokenCurrency.balanceOf.call(
        other,
      );

      // someone liquidates
      await tokenCurrency.approve(creditLine.address, liquidationTokens, {
        from: other,
      });
      let tx = await creditLine.liquidate(sponsor, liquidationTokens, {
        from: other,
      });

      // check event
      truffleAssert.eventEmitted(tx, 'Liquidation', ev => {
        return (
          ev.sponsor == sponsor &&
          ev.liquidator == other &&
          ev.liquidatedTokens.toString() == liquidationTokens.toString() &&
          ev.liquidatedCollateral.toString() ==
            expectedLiquidatedCollateral.toString()
        );
      });

      // check balances
      let liquidatorCollateralBalanceAfter = await collateral.balanceOf.call(
        other,
      );
      let liquidatorTokenBalanceAfter = await tokenCurrency.balanceOf.call(
        other,
      );

      // somehow there is precision loss in reward calculation and mismatch from chain results, so will trim it to assert true
      assert.equal(
        liquidatorCollateralBalanceAfter.toString().substr(0, 6),
        liquidatorCollateralBalanceBefore
          .add(expectedLiquidatedCollateral)
          .add(expectedLiquidatorReward)
          .toString()
          .substr(0, 6),
      );
      assert.equal(
        liquidatorTokenBalanceAfter.toString(),
        liquidatorTokenBalanceBefore.sub(liquidationTokens).toString(),
      );

      // check sponsor position
      let {
        tokensOutstanding,
        rawCollateral,
      } = await creditLine.positions.call(sponsor);
      tokensOutstanding = toBN(tokensOutstanding.rawValue);
      rawCollateral = toBN(rawCollateral.rawValue);
      assert.equal(
        tokensOutstanding.toString(),
        createTokens.sub(liquidationTokens).toString(),
      );
      assert.equal(
        rawCollateral.toString(),
        createCollateral.sub(expectedLiquidatedCollateral).toString(),
      );
    });

    it('Fully liquidates an undercollateralised amount, position capitalised', async () => {
      // change price - position is under collateral requirement but still cover the debt
      const updatedPrice = toBN(toWei('1.1'));
      await mockOnchainOracle.setPrice(priceFeedIdentifier, updatedPrice);

      const collateralRequirement = createTokens
        .mul(updatedPrice)
        .div(toBN(Math.pow(10, 18)))
        .mul(overCollateralizationFactor)
        .div(toBN(Math.pow(10, 18)));
      assert.equal(
        collateralRequirement.sub(createCollateral) > 0,
        true,
        'Not undercollateralised',
      );

      // let inversePrice = toBN(toWei('1')).div(updatedPrice);
      const liquidationTokens = toBN(toWei('1000'));

      let liquidatedCollateralPortion = liquidationTokens
        .mul(createCollateral)
        .div(createTokens);
      const liquidatedTokensValue = liquidationTokens
        .mul(updatedPrice)
        .div(toBN(Math.pow(10, 18)));

      const isCapitalised = liquidatedCollateralPortion.gt(
        liquidatedTokensValue,
      );
      let expectedLiquidatorReward = isCapitalised
        ? liquidatedCollateralPortion
            .sub(liquidatedTokensValue)
            .mul(liquidationRewardPct)
            .div(toBN(Math.pow(10, 18)))
        : toBN(0);

      let expectedLiquidatedCollateral = isCapitalised
        ? liquidatedTokensValue
        : liquidatedTokensValue.gt(liquidatedCollateralPortion)
        ? liquidatedCollateralPortion
        : liquidatedTokensValue;

      let liquidatorCollateralBalanceBefore = await collateral.balanceOf.call(
        other,
      );
      let liquidatorTokenBalanceBefore = await tokenCurrency.balanceOf.call(
        other,
      );

      // someone liquidates
      await tokenCurrency.approve(creditLine.address, liquidationTokens, {
        from: other,
      });
      let tx = await creditLine.liquidate(sponsor, liquidationTokens, {
        from: other,
      });

      // check event
      truffleAssert.eventEmitted(tx, 'Liquidation', ev => {
        return (
          ev.sponsor == sponsor &&
          ev.liquidator == other &&
          ev.liquidatedTokens.toString() == liquidationTokens.toString() &&
          ev.liquidatedCollateral.toString() ==
            expectedLiquidatedCollateral.toString()
        );
      });

      // check balances
      let liquidatorCollateralBalanceAfter = await collateral.balanceOf.call(
        other,
      );
      let liquidatorTokenBalanceAfter = await tokenCurrency.balanceOf.call(
        other,
      );

      // somehow there is precision loss in reward calculation and mismatch from chain results, so will trim it to assert true
      assert.equal(
        liquidatorCollateralBalanceAfter.toString().substr(0, 6),
        liquidatorCollateralBalanceBefore
          .add(expectedLiquidatedCollateral)
          .add(expectedLiquidatorReward)
          .toString()
          .substr(0, 6),
      );
      assert.equal(
        liquidatorTokenBalanceAfter.toString(),
        liquidatorTokenBalanceBefore.sub(liquidationTokens).toString(),
      );

      // check sponsor position
      let {
        tokensOutstanding,
        rawCollateral,
      } = await creditLine.positions.call(sponsor);
      tokensOutstanding = toBN(tokensOutstanding.rawValue);
      rawCollateral = toBN(rawCollateral.rawValue);
      assert.equal(
        tokensOutstanding.toString(),
        createTokens.sub(liquidationTokens).toString(),
      );
      assert.equal(
        rawCollateral.toString(),
        createCollateral.sub(expectedLiquidatedCollateral).toString(),
      );
    });

    it('Correctly liquidates an undercollateralised amount, position undercapitalised', async () => {
      // change price - position is under collateral requirement and cant fully cover debt
      const updatedPrice = toBN(toWei('1.5'));
      await mockOnchainOracle.setPrice(priceFeedIdentifier, updatedPrice);

      const collateralRequirement = createTokens
        .mul(updatedPrice)
        .div(toBN(Math.pow(10, 18)))
        .mul(overCollateralizationFactor)
        .div(toBN(Math.pow(10, 18)));
      assert.equal(
        collateralRequirement.sub(createCollateral) > 0,
        true,
        'Not undercollateralised',
      );

      // let inversePrice = toBN(toWei('1')).div(updatedPrice);
      const liquidationTokens = toBN(toWei('270'));

      let liquidatedCollateralPortion = liquidationTokens
        .mul(createCollateral)
        .div(createTokens);
      const liquidatedTokensValue = liquidationTokens
        .mul(updatedPrice)
        .div(toBN(Math.pow(10, 18)));
      const isCapitalised = liquidatedCollateralPortion.gt(
        liquidatedTokensValue,
      );
      let expectedLiquidatorReward = isCapitalised
        ? liquidatedCollateralPortion
            .sub(liquidatedTokensValue)
            .mul(liquidationRewardPct)
            .div(toBN(Math.pow(10, 18)))
        : toBN(0);

      let expectedLiquidatedCollateral = isCapitalised
        ? liquidatedTokensValue
        : liquidatedTokensValue.gt(createCollateral)
        ? createCollateral
        : liquidatedTokensValue;

      let liquidatorCollateralBalanceBefore = await collateral.balanceOf.call(
        other,
      );
      let liquidatorTokenBalanceBefore = await tokenCurrency.balanceOf.call(
        other,
      );

      // someone liquidates
      await tokenCurrency.approve(creditLine.address, liquidationTokens, {
        from: other,
      });
      let tx = await creditLine.liquidate(sponsor, liquidationTokens, {
        from: other,
      });

      // check event
      truffleAssert.eventEmitted(tx, 'Liquidation', ev => {
        return (
          ev.sponsor == sponsor &&
          ev.liquidator == other &&
          ev.liquidatedTokens.toString() == liquidationTokens.toString() &&
          ev.liquidatedCollateral.toString() ==
            expectedLiquidatedCollateral.toString()
        );
      });

      // check balances
      let liquidatorCollateralBalanceAfter = await collateral.balanceOf.call(
        other,
      );
      let liquidatorTokenBalanceAfter = await tokenCurrency.balanceOf.call(
        other,
      );

      // somehow there is precision loss in reward calculation and mismatch from chain results, so will trim it to assert true
      assert.equal(
        liquidatorCollateralBalanceAfter.toString().substr(0, 6),
        liquidatorCollateralBalanceBefore
          .add(expectedLiquidatedCollateral)
          .add(expectedLiquidatorReward)
          .toString()
          .substr(0, 6),
      );
      assert.equal(
        liquidatorTokenBalanceAfter.toString(),
        liquidatorTokenBalanceBefore.sub(liquidationTokens).toString(),
      );

      // check sponsor position
      let {
        tokensOutstanding,
        rawCollateral,
      } = await creditLine.positions.call(sponsor);
      tokensOutstanding = toBN(tokensOutstanding.rawValue);
      rawCollateral = toBN(rawCollateral.rawValue);
      assert.equal(
        tokensOutstanding.toString(),
        createTokens.sub(liquidationTokens).toString(),
      );
      assert.equal(
        rawCollateral.toString(),
        createCollateral.sub(expectedLiquidatedCollateral).toString(),
      );
    });
  });

  it('Cannot create position smaller than min sponsor size', async function () {
    // Attempt to create position smaller than 5 wei tokens (the min sponsor position size)
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });

    await truffleAssert.reverts(
      creditLine.create('40', '4', { from: sponsor }),
      'Below minimum sponsor position',
    );
  });

  it('Cannot reduce position size below min sponsor size', async function () {
    // Attempt to redeem a position smaller s.t. the resulting position is less than 5 wei tokens (the min sponsor
    // position size)
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });

    await creditLine.create(toWei('40'), toWei('20'), {
      from: sponsor,
    });

    await truffleAssert.reverts(
      creditLine.redeem(toWei('16'), { from: sponsor }),
      'Below minimum sponsor position',
    );
  });

  it('Can withdraw excess collateral', async function () {
    // Attempt to redeem a position smaller s.t. the resulting position is less than 5 wei tokens (the min sponsor
    // position size)
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });

    await creditLine.create(toWei('40'), toWei('20'), {
      from: sponsor,
    });

    // Transfer extra collateral in.
    await collateral.transfer(creditLine.address, toWei('10'), {
      from: sponsor,
    });
    let excessCollateral = await creditLine.trimExcess.call(collateral.address);
    await creditLine.trimExcess(collateral.address);
    let beneficiaryCollateralBalance = await collateral.balanceOf.call(
      beneficiary,
    );
    assert.equal(excessCollateral.toString(), toWei('10'));
    assert.equal(beneficiaryCollateralBalance.toString(), toWei('10'));
    await collateral.transfer(sponsor, toWei('10'), { from: beneficiary });

    // Transfer extra tokens in.
    await tokenCurrency.transfer(creditLine.address, '10', {
      from: sponsor,
    });
    let excessTokens = await creditLine.trimExcess.call(tokenCurrency.address);
    await creditLine.trimExcess(tokenCurrency.address);
    let beneficiaryTokenBalance = await tokenCurrency.balanceOf.call(
      beneficiary,
    );
    assert.equal(excessTokens.toString(), '10');
    assert.equal(beneficiaryTokenBalance.toString(), '10');

    // Redeem still succeeds.
    await tokenCurrency.transfer(sponsor, '10', { from: beneficiary });
    await creditLine.redeem('20', { from: sponsor });
  });

  it('Can not delete a sponsor position externally', async () => {
    await collateral.approve(creditLine.address, initialPositionCollateral, {
      from: sponsor,
    });
    await creditLine.create(
      initialPositionCollateral.toString(),
      initialPositionTokens.toString(),
      { from: sponsor },
    );
    await truffleAssert.reverts(
      creditLine.deleteSponsorPosition(sponsor, { from: other }),
      'Only the contract can invoke this function',
    );
  });

  it('Revert if overcome mint limit', async () => {
    await creditLineControllerInstance.setCapMintAmount(
      [creditLine.address],
      [toWei('50')],
      { from: maintainers },
    );
    await collateral.approve(creditLine.address, toWei('100'), {
      from: sponsor,
    });
    await truffleAssert.reverts(
      creditLine.create(toWei('100'), toWei('80'), {
        from: sponsor,
      }),
      'Total amount minted overcomes mint limit',
    );
  });
});
