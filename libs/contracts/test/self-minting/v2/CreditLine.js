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

// Other UMA related contracts and mocks
const Store = artifacts.require('Store');
const MockOracle = artifacts.require('MockOracle');
const MockOnchainOracle = artifacts.require('MockOnChainOracle');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const TestnetERC20 = artifacts.require('TestnetERC20');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const SynthereumManager = artifacts.require('SynthereumManager');
const Timer = artifacts.require('Timer');

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
  let overCollateralizationFactor = toBN(toWei('1.1'));
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
  const initialPositionTokens = toBN(toWei('1000'));
  const initialPositionCollateral = toBN(toWei('1'));
  const initalFeeAmount = initialPositionCollateral
    .mul(feePercentage)
    .div(toBN(Math.pow(10, 18)));
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

  // const expectNoExcessCollateralToTrim = async () => {
  //   let collateralTrimAmount = await creditLine.trimExcess.call(
  //     collateral.address,
  //   );
  //   await creditLine.trimExcess(collateral.address);
  //   let beneficiaryCollateralBalance = await collateral.balanceOf.call(
  //     beneficiary,
  //   );

  //   assert.equal(collateralTrimAmount.toString(), '0');
  //   assert.equal(beneficiaryCollateralBalance.toString(), '0');
  // };

  // const expectAndDrainExcessCollateral = async () => {
  //   // Drains the collateral from the contract and transfers it all back to the sponsor account to leave the beneficiary empty.
  //   await creditLine.trimExcess(collateral.address);
  //   let beneficiaryCollateralBalance = await collateral.balanceOf.call(
  //     beneficiary,
  //   );
  //   collateral.transfer(sponsor, beneficiaryCollateralBalance.toString(), {
  //     from: beneficiary,
  //   });

  //   // Assert that nonzero collateral was drained.
  //   assert.notEqual(beneficiaryCollateralBalance.toString(), '0');
  // };

  // const getGCR = async contract => {
  //   const totalTokens = await contract.totalTokensOutstanding.call();
  //   const totalNetCollateral = await contract.totalPositionCollateral.call();
  //   return totalNetCollateral.mul(toBN(Math.pow(10, 18))).div(totalTokens);
  // };

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
    collateral = await TestnetSelfMintingERC20.deployed();
    await collateral.allocateTo(sponsor, toWei('1000000'), {
      from: collateralOwner,
    });
    await collateral.allocateTo(other, toWei('1000000'), {
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

  // TODO
  // afterEach(async () => {
  //   await expectNoExcessCollateralToTrim();
  // });

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
    assert.equal(
      returnedFee.Fee.feePercentage.toString(),
      Fee.Fee.feePercentage,
    );
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
          ev.collateralAmount == createCollateral.toString() &&
          ev.tokenAmount == createTokens.toString(),
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
    // await expectNoExcessCollateralToTrim();

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
    // await expectNoExcessCollateralToTrim();

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
    // await expectNoExcessCollateralToTrim();

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
    // await expectNoExcessCollateralToTrim();

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
    // await expectNoExcessCollateralToTrim();

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
    // await expectNoExcessCollateralToTrim();
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

    const numTokens = toWei('1');
    const collateralAmount = toWei('2');

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

    const numTokens = toWei('0.7');
    const numCombinedTokens = toWei('1.4');
    await creditLine.create(toWei('1'), numTokens, {
      from: other,
    });
    await creditLine.create(toWei('1'), numTokens, {
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

    const numTokens = toWei('0.7');
    await creditLine.create(toWei('1'), numTokens, {
      from: other,
    });
    await creditLine.create(toWei('1'), numTokens, {
      from: sponsor,
    });

    // Other makes a deposit to the sponsor's account despite having their own position.
    await creditLine.depositTo(sponsor, toWei('1'), { from: other });

    assert.equal(
      (await creditLine.positions.call(sponsor)).rawCollateral.toString(),
      toWei('2'),
    );
    assert.equal(
      (await creditLine.positions.call(other)).rawCollateral.toString(),
      toWei('1'),
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

    const numTokens = toWei('0.7');
    await creditLine.create(toWei('1'), numTokens, {
      from: sponsor,
    });

    // Sponsor makes a deposit to their own account.
    await creditLine.depositTo(sponsor, toWei('1'), { from: sponsor });

    assert.equal(
      (await creditLine.positions(sponsor)).rawCollateral.toString(),
      toWei('2'),
    );
    await creditLineControllerInstance.setFeePercentage(
      [creditLine.address],
      [Fee.feePercentage],
      { from: maintainers },
    );
  });

  it.only('Sponsor can use repay to decrease their debt', async function () {
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

  it.only('Emergency shutdown: lifecycle', async function () {
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
    console.log(await creditLine.positionManagerData.call());
    const emergencyShutdownTx = await synthereumManagerInstance.emergencyShutdown(
      [creditLine.address],
      { from: maintainers },
    );
    console.log(emergencyShutdownTx);
    // // check event
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
    console.log(await creditLine.positionManagerData.call());
    console.log(
      await creditLine.positionManagerData
        .call()
        .emergencyShutdownPrice.toString(),
    );
    assert.equal(
      (await creditLine.emergencyShutdownPrice.call()).toString(),
      emergencyShutdownPrice.toString(),
    );

    // Emergency shutdown should not be able to be called a second time.
    await truffleAssert.reverts(
      synthereumManagerInstance.emergencyShutdown([creditLine.address], {
        from: maintainers,
      }),
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

    await creditLine.settleEmergencyShutdown({ from: tokenHolder });

    const tokenHolderFinalCollateral = await collateral.balanceOf(tokenHolder);
    const tokenHolderFinalSynthetic = await tokenCurrency.balanceOf(
      tokenHolder,
    );
    const settledCollateral = tokenHolderInitialSynthetic.mul(
      toBN(emergencyShutdownPrice),
    );
    assert.equal(
      tokenHolderFinalCollateral.sub(tokenHolderInitialCollateral),
      settledCollateral,
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
    // Excess collateral = 150 - 100 * 1.1 = 40
    const expectedSponsorCollateralUnderlying = toBN(toWei('40'));
    // Value of remaining synthetic tokens = 50 * 1.1 = 55
    const expectedSponsorCollateralSynthetic = toBN(toWei('55'));
    const expectedTotalSponsorCollateralReturned = expectedSponsorCollateralUnderlying.add(
      expectedSponsorCollateralSynthetic,
    );
    assert.equal(
      sponsorFinalCollateral.sub(sponsorInitialCollateral).toString(),
      expectedTotalSponsorCollateralReturned,
    );

    // The token Sponsor should have no synthetic positions left after settlement.
    assert.equal(sponsorFinalSynthetic, 0);
  });

  it('Financial admin can call emergency shutdown', async function () {
    // Create one position with 100 synthetic tokens to mint with 150 tokens of collateral. For this test say the
    // collateral is WETH with a value of 1USD and the synthetic is some fictional stock or commodity.
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });
    const numTokens = toWei('100');
    const amountCollateral = toWei('150');
    await creditLine.create(amountCollateral, numTokens, Fee.feePercentage, {
      from: sponsor,
    });

    // Transfer half the tokens from the sponsor to a tokenHolder. IRL this happens through the sponsor selling tokens.
    const tokenHolderTokens = toWei('50');
    await tokenCurrency.transfer(tokenHolder, tokenHolderTokens, {
      from: sponsor,
    });

    // Some time passes and the UMA token holders decide that Emergency shutdown needs to occur.
    const shutdownTimestamp = Number(await creditLine.getCurrentTime()) + 1000;
    await creditLine.setCurrentTime(shutdownTimestamp);

    // Pool can initiate emergency shutdown.
    await financialContractsAdmin.callEmergencyShutdown(creditLine.address);
    assert.equal(
      (await creditLine.creditLineData.call()).emergencyShutdownTimestamp,
      shutdownTimestamp,
    );
    assert.equal(
      (await creditLine.emergencyShutdownPrice.call()).toString(),
      0,
    );
  });

  describe('Precision loss as a result of regular fees is handled as expected', () => {
    beforeEach(async () => {
      // Create a new position with:
      // - 30 collateral
      // - 20 synthetic tokens (10 held by token holder, 10 by sponsor)
      await collateral.approve(creditLine.address, '100000', {
        from: sponsor,
      });
      const numTokens = '20';
      const amountCollateral = '30';
      await creditLine.create(amountCollateral, numTokens, Fee.feePercentage, {
        from: sponsor,
      });
      await tokenCurrency.approve(creditLine.address, numTokens, {
        from: sponsor,
      });

      // Setting the regular fee to 4 % per second will result in a miscalculated cumulativeFeeMultiplier after 1 second
      // because of the intermediate calculation in `payRegularFees()` for calculating the `feeAdjustment`: ( fees paid ) / (total collateral)
      // = 0.033... repeating, which cannot be represented precisely by a fixed point.
      // --> 0.04 * 30 wei = 1.2 wei, which gets truncated to 1 wei, so 1 wei of fees are paid
      const regularFee = toWei('0.04');
      await store.setFixedOracleFeePerSecondPerPfc({ rawValue: regularFee });

      // Advance the contract one second and make the contract pay its regular fees
      let startTime = await creditLine.getCurrentTime();
      await creditLine.setCurrentTime(startTime.addn(1));
      await creditLine.payRegularFees();

      // Set the store fees back to 0 to prevent fee multiplier from changing for remainder of the test.
      await store.setFixedOracleFeePerSecondPerPfc({ rawValue: '0' });
    });
    it('Fee multiplier is set properly with precision loss, and fees are paid as expected', async () => {
      // Absent any rounding errors, `getCollateral` should return (initial-collateral - final-fees) = 30 wei - 1 wei = 29 wei.
      // But, because of the use of mul and div in payRegularFees(), getCollateral() will return slightly less
      // collateral than expected. When calculating the new `feeAdjustment`, we need to calculate the %: (fees paid / pfc), which is
      // 1/30. However, 1/30 = 0.03333... repeating, which cannot be represented in FixedPoint. Normally div() would floor
      // this value to 0.033....33, but divCeil sets this to 0.033...34. A higher `feeAdjustment` causes a lower `adjustment` and ultimately
      // lower `totalPositionCollateral` and `positionAdjustment` values.
      let collateralAmount = await creditLine.getCollateral(sponsor);
      assert.isTrue(toBN(collateralAmount.rawValue).lt(toBN('29')));
      assert.equal(
        (
          await creditLine.feePayerData.call()
        ).cumulativeFeeMultiplier.toString(),
        toWei('0.966666666666666666').toString(),
      );

      // The actual amount of fees paid to the store is as expected = 1 wei.
      // At this point, the store should have +1 wei, the contract should have 29 wei but the position will show 28 wei
      // because `(30 * 0.966666666666666666 = 28.999...98)`. `30` is the rawCollateral and if the fee multiplier were correct,
      // then `totalPositionCollateral` would be `(30 * 0.966666666666666666...) = 29`.
      assert.equal(
        (await collateral.balanceOf(creditLine.address)).toString(),
        '29',
      );
      assert.equal(
        (await creditLine.totalPositionCollateral.call()).toString(),
        '28',
      );
      assert.equal(
        (
          await creditLine.globalPositionData.call()
        ).rawTotalPositionCollateral.rawValue.toString(),
        '30',
      );

      // Drain excess collateral left because of precesion loss.
      await expectAndDrainExcessCollateral();
    });
    it('settleEmergencyShutdown() returns the same amount of collateral that totalPositionCollateral is decreased by', async () => {
      // Emergency shutdown the contract
      const emergencyShutdownTime = await creditLine.getCurrentTime();
      await synthereumManagerInstance.emergencyShutdown([creditLine.address], {
        from: maintainers,
      });

      // Push a settlement price into the mock oracle to simulate a DVM vote. Say settlement occurs at 1.2 Stock/USD for the price
      // feed. With 20 units of outstanding tokens this results in a token redemption value of: TRV = 20 * 1.2 = 24 USD.
      const redemptionPrice = 1.2;
      const redemptionPriceWei = toWei(redemptionPrice.toString());
      await mockOracle.pushPrice(
        priceFeedIdentifier,
        emergencyShutdownTime.toNumber(),
        redemptionPriceWei,
      );

      // Transfer half the tokens from the sponsor to a tokenHolder. IRL this happens through the sponsor selling tokens.
      const tokenHolderTokens = '10';
      await tokenCurrency.transfer(tokenHolder, tokenHolderTokens, {
        from: sponsor,
      });
      await tokenCurrency.approve(creditLine.address, tokenHolderTokens, {
        from: tokenHolder,
      });

      // The token holder is entitled to the value of their tokens, notated in the underlying.
      // They have 10 tokens settled at a price of 1.2 should yield 12 units of collateral.
      // So, `rawCollateral` is decreased by (`12 / 0.966666666666666666 ~= 12.4`) which gets truncated to 12.
      // Before `settleEmergencyShutdown` is called, `totalPositionCollateral = rawCollateral * cumulativeFeeMultiplier = 30 * 0.966666666666666666 = 28`.
      // After `settleEmergencyShutdown`, `rawCollateral -= 12`, so the new `totalPositionCollateral = `(30-12) * 0.966666666666666666 = 17.4` which is truncated to 17.
      // So, due to precision loss, `totalPositionCollateral` is only decreased by 11, but it should be 12 without errors.
      // From the user's POV, they will see their balance decrease by 11, so we should send them 11 collateral not 12.

      const tokenHolderInitialCollateral = await collateral.balanceOf.call(
        tokenHolder,
      );
      await creditLine.settleEmergencyShutdown({ from: tokenHolder });
      const tokenHolderFinalCollateral = await collateral.balanceOf.call(
        tokenHolder,
      );
      const tokenHolderFinalSynthetic = await tokenCurrency.balanceOf.call(
        tokenHolder,
      );

      // The token holder should gain the value of their synthetic tokens in underlying.
      const expectedTokenHolderFinalCollateral = '11';
      assert.equal(
        tokenHolderFinalCollateral.sub(tokenHolderInitialCollateral),
        expectedTokenHolderFinalCollateral,
      );
      assert.equal(
        (await collateral.balanceOf.call(creditLine.address)).toString(),
        '18',
      );
      assert.equal(
        (await creditLine.totalPositionCollateral.call()).toString(),
        '17',
      );
      assert.equal(
        (
          await creditLine.globalPositionData.call()
        ).rawTotalPositionCollateral.rawValue.toString(),
        '18',
      );

      // The token holder should have no synthetic positions left after settlement.
      assert.equal(tokenHolderFinalSynthetic, 0);

      // The sponsor is entitled to the underlying value of their remaining synthetic tokens + the excess collateral
      // in their position at time of settlement - final fees. But we'll see that the "excess" collateral displays error
      // due to precision loss.
      const sponsorInitialCollateral = await collateral.balanceOf.call(sponsor);
      await creditLine.settleEmergencyShutdown({ from: sponsor });
      const sponsorFinalCollateral = await collateral.balanceOf.call(sponsor);
      const sponsorFinalSynthetic = await tokenCurrency.balanceOf.call(sponsor);

      // The token Sponsor should gain the value of their synthetics in underlying
      // + their excess collateral from the over collateralization in their position.
      // Excess collateral should be = rawCollateral - fees - tokensOutstanding * price = 30 - 1 - (20 * 1.2) = 5
      // However, recall that `totalPositionCollateral = (30 * 0.966666666666666666 = 28.999...98)` which gets truncated to 28.
      // So, the excess collateral becomes 28 - (20 * 1.2) = 4
      // The value of the remaining synthetic tokens = 10 * 1.2 = 12.
      // So, we will attempt to withdraw (12 + 4) tokens from the contract.
      // We need to decrease `rawCollateral` by `16 / 0.966666666666666666 ~= 16.5`
      // which gets truncated to 16.
      // Recall previously that rawCollateral was last set to 18, so `totalPositionCollateral = (18-16) * 0.966666666666666666 ~= 1.97`
      // which gets truncated to 1.
      // The previous totalPositionCollateral was 17, so we will withdraw (17-1) = 16 tokens instead of the 17 as the user expected.
      assert.equal(
        (await creditLine.totalPositionCollateral()).toString(),
        '1',
      );
      assert.equal(
        (
          await creditLine.globalPositionData.call()
        ).rawTotalPositionCollateral.rawValue.toString(),
        '2',
      );
      const expectedSponsorCollateralSynthetic = toBN('11');
      const expectedSponsorCollateralUnderlying = toBN('5');
      const expectedTotalSponsorCollateralReturned = expectedSponsorCollateralUnderlying.add(
        expectedSponsorCollateralSynthetic,
      );
      assert.equal(
        sponsorFinalCollateral.sub(sponsorInitialCollateral).toString(),
        expectedTotalSponsorCollateralReturned.toString(),
      );

      // The token Sponsor should have no synthetic positions left after settlement.
      assert.equal(sponsorFinalSynthetic, 0);

      // The contract should have a small remainder of 2 collateral tokens due to rounding errors:
      // We started with 30, paid 1 in final fees, returned 11 to the token holder, and 16 to the sponsor:
      // (30 - 1 - 11 - 16 = 2)
      assert.equal(
        (await collateral.balanceOf.call(creditLine.address)).toString(),
        '2',
      );
      assert.equal(
        (await creditLine.totalPositionCollateral.call()).toString(),
        '1',
      );

      // Last check is that after redemption the position in the positions mapping is still removed despite leaving collateral dust.
      const sponsorsPosition = await creditLine.positions.call(sponsor);
      assert.equal(sponsorsPosition.rawCollateral.rawValue, 0);
      assert.equal(sponsorsPosition.tokensOutstanding.rawValue, 0);
      assert.equal(
        sponsorsPosition.withdrawalRequestPassTimestamp.toString(),
        0,
      );
      assert.equal(sponsorsPosition.withdrawalRequestAmount.rawValue, 0);

      // Drain excess collateral left because of precision loss.
      await expectAndDrainExcessCollateral();
    });
    it('withdraw() returns the same amount of collateral that totalPositionCollateral is decreased by', async () => {
      // The sponsor requests to withdraw 12 collateral.
      // So, `rawCollateral` is decreased by (`12 / 0.966666666666666666 ~= 12.4`) which gets truncated to 12.
      // Before `withdraw` is called, `totalPositionCollateral = rawCollateral * cumulativeFeeMultiplier = 30 * 0.966666666666666666 = 28`.
      // After `settleEmergencyShutdown`, `rawCollateral -= 12`, so the new `totalPositionCollateral = `(30-12) * 0.966666666666666666 = 17.4` which is truncated to 17.
      // So, due to precision loss, `totalPositionCollateral` is only decreased by 11, but it should be 12 without errors.
      // From the user's POV, they will see their balance decrease by 11, so we should send them 11 collateral not 12.
      const initialCollateral = await collateral.balanceOf.call(sponsor);
      await creditLine.requestWithdrawal('12', { from: sponsor });
      let startTime = await creditLine.getCurrentTime();
      await creditLine.setCurrentTime(startTime.addn(withdrawalLiveness));
      await creditLine.withdrawPassedRequest({ from: sponsor });
      const finalCollateral = await collateral.balanceOf.call(sponsor);

      // The sponsor should gain their requested amount minus precision loss.
      const expectedFinalCollateral = '11';
      assert.equal(
        finalCollateral.sub(initialCollateral),
        expectedFinalCollateral,
      );
      assert.equal(
        (await collateral.balanceOf.call(creditLine.address)).toString(),
        '18',
      );
      assert.equal(
        (await creditLine.totalPositionCollateral()).toString(),
        '17',
      );
      assert.equal(
        (
          await creditLine.globalPositionData.call()
        ).rawTotalPositionCollateral.toString(),
        '18',
      );

      // Drain excess collateral left because of precesion loss.
      await expectAndDrainExcessCollateral();
    });
    it('redeem() returns the same amount of collateral that totalPositionCollateral is decreased by', async () => {
      // The sponsor requests to redeem 9 tokens. (9/20 = 0.45) tokens should result in a proportional redemption of the totalPositionCollateral,
      // which as you recall is 28 post-fees. So, we expect to redeem (0.45 * 28 = 12.6) collateral which gets truncated to 12.
      // So, `rawCollateral` is decreased by (`12 / 0.966666666666666666 ~= 12.4`) which gets truncated to 12.
      // Before `withdraw` is called, `totalPositionCollateral = rawCollateral * cumulativeFeeMultiplier = 30 * 0.966666666666666666 = 28`.
      // After `settleEmergencyShutdown`, `rawCollateral -= 12`, so the new `totalPositionCollateral = `(30-12) * 0.966666666666666666 = 17.4` which is truncated to 17.
      // So, due to precision loss, `totalPositionCollateral` is only decreased by 11, but it should be 12 without errors.
      // From the user's POV, they will see their balance decrease by 11, so we should send them 11 collateral not 12.
      const initialCollateral = await collateral.balanceOf.call(sponsor);
      await creditLine.redeem('9', Fee.feePercentage, { from: sponsor });
      const finalCollateral = await collateral.balanceOf.call(sponsor);

      // The sponsor should gain their requested amount minus precision loss.
      assert.equal(finalCollateral.sub(initialCollateral), '11');
      assert.equal(
        (await collateral.balanceOf.call(creditLine.address)).toString(),
        '18',
      );
      assert.equal(
        (await creditLine.totalPositionCollateral()).toString(),
        '17',
      );
      assert.equal(
        (
          await creditLine.globalPositionData.call()
        ).rawTotalPositionCollateral.toString(),
        '18',
      );

      // Expected number of synthetic tokens are burned.
      assert.equal(
        (await tokenCurrency.balanceOf.call(sponsor)).toString(),
        '11',
      );

      // Drain excess collateral left because of precesion loss.
      await expectAndDrainExcessCollateral();
    });
  });

  it('Oracle swap post shutdown', async function () {
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
    await creditLine.create(amountCollateral, numTokens, Fee.feePercentage, {
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
    const emergencyShutdownTime = await creditLine.getCurrentTime();
    await synthereumManagerInstance.emergencyShutdown([creditLine.address], {
      from: maintainers,
    });

    // Push a settlement price into the mock oracle to simulate a DVM vote. Say settlement occurs at 1.2 Stock/USD for the price
    // feed. With 200 units of outstanding tokens this results in a token redemption value of: TRV = 200 * 1.2 = 240 USD.
    await mockOracle.pushPrice(
      priceFeedIdentifier,
      emergencyShutdownTime,
      toWei('1.2'),
    );

    // Token holder should receive 120 collateral tokens for their 100 synthetic tokens.
    let initialCollateral = await collateral.balanceOf.call(tokenHolder);
    await creditLine.settleEmergencyShutdown({ from: tokenHolder });
    let collateralPaid = (await collateral.balanceOf.call(tokenHolder)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('120'));

    // Create new oracle, replace it in the finder, and push a different price to it.
    const newMockOracle = await MockOracle.new(finder.address, timer.address);
    const mockOracleInterfaceName = web3.utils.padRight(
      utf8ToHex(interfaceName.Oracle),
      64,
    );
    await finder.changeImplementationAddress(
      mockOracleInterfaceName,
      newMockOracle.address,
      {
        from: contractDeployer,
      },
    );

    // Settle emergency shutdown should still work even if the new oracle has no price.
    initialCollateral = await collateral.balanceOf.call(sponsor);
    await creditLine.settleEmergencyShutdown({ from: sponsor });
    collateralPaid = (await collateral.balanceOf.call(sponsor)).sub(
      initialCollateral,
    );

    // Sponsor should have received 300 - 240 = 60 collateral tokens.
    assert.equal(collateralPaid, toWei('60'));

    // Push a different price to the new oracle to ensure the contract still uses the old price.
    await newMockOracle.requestPrice(
      priceFeedIdentifier,
      emergencyShutdownTime,
    );
    await newMockOracle.pushPrice(
      priceFeedIdentifier,
      emergencyShutdownTime,
      toWei('0.8'),
    );

    // Second token holder should receive the same payout as the first despite the oracle price being changed.
    initialCollateral = await collateral.balanceOf.call(other);
    await creditLine.settleEmergencyShutdown({ from: other });
    collateralPaid = (await collateral.balanceOf.call(other)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('120'));
  });

  it('Oracle price can resolve to 0', async function () {
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
    await creditLine.create(toWei('300'), toWei('200'), Fee.feePercentage, {
      from: sponsor,
    });
    await tokenCurrency.transfer(tokenHolder, toWei('100'), {
      from: sponsor,
    });

    // Emergency shutdown contract to enable settlement.
    const emergencyShutdownTime = await creditLine.getCurrentTime();
    await synthereumManagerInstance.emergencyShutdown([creditLine.address], {
      from: maintainers,
    });
    // Push a settlement price into the mock oracle to simulate a DVM vote. Say settlement occurs at 0. This means that
    // each token debt is worth 0 and the sponsor should get back their full collateral, even though they dont have all
    // the tokens. The token holder should get nothing.
    await mockOracle.pushPrice(
      priceFeedIdentifier,
      emergencyShutdownTime,
      toWei('0'),
    );

    // Token holder should receive 0 collateral tokens for their 100 synthetic tokens as the price is 0.
    let initialCollateral = await collateral.balanceOf.call(tokenHolder);
    await creditLine.settleEmergencyShutdown({ from: tokenHolder });
    let collateralPaid = (await collateral.balanceOf(tokenHolder)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('0'));

    // Settle emergency from the sponsor should give them back all their collateral, as token debt is worth 0.
    initialCollateral = await collateral.balanceOf.call(sponsor);
    await creditLine.settleEmergencyShutdown({ from: sponsor });
    collateralPaid = (await collateral.balanceOf.call(sponsor)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('300'));
  });

  it('Oracle price can resolve less than 0', async function () {
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
    await creditLine.create(toWei('300'), toWei('200'), Fee.feePercentage, {
      from: sponsor,
    });
    await tokenCurrency.transfer(tokenHolder, toWei('100'), {
      from: sponsor,
    });

    // Emergency shutdown contract to enable settlement.
    const emergencyShutdownTime = await creditLine.getCurrentTime();
    await synthereumManagerInstance.emergencyShutdown([creditLine.address], {
      from: maintainers,
    });
    // Push a settlement price into the mock oracle to simulate a DVM vote. Say settlement occurs at valu eless than 0. This means that
    // each token debt is worth 0 and the sponsor should get back their full collateral, even though they dont have all
    // the tokens. The token holder should get nothing.
    await mockOracle.pushPrice(
      priceFeedIdentifier,
      emergencyShutdownTime,
      toWei('-0.1'),
    );

    // Token holder should receive 0 collateral tokens for their 100 synthetic tokens as the price is 0.
    let initialCollateral = await collateral.balanceOf.call(tokenHolder);
    await creditLine.settleEmergencyShutdown({ from: tokenHolder });
    let collateralPaid = (await collateral.balanceOf(tokenHolder)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('0'));

    // Settle emergency from the sponsor should give them back all their collateral, as token debt is worth 0.
    initialCollateral = await collateral.balanceOf.call(sponsor);
    await creditLine.settleEmergencyShutdown({ from: sponsor });
    collateralPaid = (await collateral.balanceOf.call(sponsor)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('300'));
  });

  it('Undercapitalized contract', async function () {
    await creditLineControllerInstance.setDaoFee(creditLine.address, {
      feePercentage: '0',
      feeRecipient: daoFeeRecipient,
    });
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: other,
    });
    await tokenCurrency.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(creditLine.address, toWei('100000'), {
      from: other,
    });
    await tokenCurrency.approve(creditLine.address, toWei('100000'), {
      from: tokenHolder,
    });

    // Create one undercapitalized sponsor and one overcollateralized sponsor.
    await creditLine.create(toWei('50'), toWei('100'), Fee.feePercentage, {
      from: sponsor,
    });
    await creditLine.create(toWei('150'), toWei('100'), Fee.feePercentage, {
      from: other,
    });

    // Transfer 150 tokens to the token holder and leave the overcollateralized sponsor with 25.
    await tokenCurrency.transfer(tokenHolder, toWei('75'), {
      from: other,
    });
    await tokenCurrency.transfer(tokenHolder, toWei('75'), {
      from: sponsor,
    });

    // Emergency shutdown contract to enable settlement.
    const emergencyShutdownTime = await creditLine.getCurrentTime();
    await synthereumManagerInstance.emergencyShutdown([creditLine.address], {
      from: maintainers,
    });
    // Settle the price to 1, meaning the overcollateralized sponsor has 50 units of excess collateral.
    await mockOracle.pushPrice(
      priceFeedIdentifier,
      emergencyShutdownTime,
      toWei('1'),
    );

    // Token holder is the first to settle -- they should receive the entire value of their tokens (100) because they
    // were first.
    let startingBalance = await collateral.balanceOf.call(tokenHolder);
    await creditLine.settleEmergencyShutdown({
      from: tokenHolder,
    });
    assert.equal(
      (await collateral.balanceOf.call(tokenHolder)).toString(),
      startingBalance.add(toBN(toWei('150'))),
    );

    // The overcollateralized sponsor should see a haircut because they settled later.
    // The overcollateralized sponsor is owed 75 because of the 50 in excess collateral and the 25 in tokens.
    // But there's only 50 left in the contract, so we should see only 50 paid out.
    startingBalance = await collateral.balanceOf.call(other);
    await creditLine.settleEmergencyShutdown({ from: other });
    assert.equal(
      (await collateral.balanceOf.call(other)).toString(),
      startingBalance.add(toBN(toWei('50'))).toString(),
    );

    // The undercapitalized sponsor should get nothing even though they have tokens because the contract has no more collateral.
    startingBalance = await collateral.balanceOf(sponsor);
    await creditLine.settleEmergencyShutdown({ from: sponsor });
    assert.equal(
      (await collateral.balanceOf.call(sponsor)).toString(),
      startingBalance.add(toBN('0')),
    );
    await creditLineControllerInstance.setDaoFee(creditLine.address, {
      feePercentage: Fee.feePercentage.toString(),
      feeRecipient: daoFeeRecipient,
    });
  });

  it('Cannot create position smaller than min sponsor size', async function () {
    // Attempt to create position smaller than 5 wei tokens (the min sponsor position size)
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });

    await truffleAssert.reverts(
      creditLine.create('40', '4', Fee.feePercentage, { from: sponsor }),
      'Below minimum sponsor position',
    );
  });

  it('Cannot reduce position size below min sponsor size', async function () {
    // Attempt to redeem a position smaller s.t. the resulting position is less than 5 wei tokens (the min sponsor
    // position size)
    await collateral.approve(creditLine.address, toWei('100000'), {
      from: sponsor,
    });

    await creditLine.create('40', '20', Fee.feePercentage, {
      from: sponsor,
    });

    await truffleAssert.reverts(
      creditLine.redeem('16', Fee.feePercentage, { from: sponsor }),
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

    await creditLine.create('40', '20', Fee.feePercentage, {
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
    await creditLine.redeem('20', Fee.feePercentage, { from: sponsor });
  });

  it('Non-standard ERC20 delimitation', async function () {
    // To test non-standard ERC20 token delimitation a new ERC20 token is created which has 6 decimal points of precision.
    // A new priceless position manager is then created and and set to use this token as collateral. To generate values
    // which represent the appropriate scaling for USDC, .muln(1e6) is used over toWei as the latter scaled by 1e18.

    // Create a test net token with non-standard delimitation like USDC (6 decimals) and mint tokens.
    const USDCToken = await TestnetERC20.new('USDC', 'USDC', 6);
    // await addressWhitelistInstance.addToWhitelist(USDCToken.address);
    await USDCToken.allocateTo(sponsor, toWei('100'));

    const nonStandardToken = await SyntheticToken.new(
      syntheticName,
      syntheticSymbol,
      18,
    );

    let newcreditLineData = creditLineParams;
    newcreditLineData.collateralAddress = USDCToken.address;
    newcreditLineData.tokenAddress = nonStandardToken.address;

    let customcreditLine = await SelfMintingPerpetualcreditLineMultiParty.new(
      newcreditLineData,
    );
    await creditLineControllerInstance.setCapMintAmount(
      customcreditLine.address,
      capMintAmount,
    );
    await creditLineControllerInstance.setCapDepositRatio(
      customcreditLine.address,
      capDepositRatio,
    );
    await creditLineControllerInstance.setDaoFee(customcreditLine.address, {
      feePercentage: Fee.feePercentage.toString(),
      feeRecipient: daoFeeRecipient,
    });
    tokenCurrency = await SyntheticToken.at(
      await customcreditLine.tokenCurrency.call(),
    );
    await nonStandardToken.addMinter(customcreditLine.address);
    await nonStandardToken.addBurner(customcreditLine.address);

    // Token currency and collateral have same # of decimals.
    assert.equal((await tokenCurrency.decimals()).toString(), 18);

    // Create the initial custom creditLine position. 100 synthetics backed by 150 collat
    const createTokens = toWei('100').toString();
    // The collateral is delimited by the same number of decimals. 150 * 1e6
    const createCollateral = toBN('150').muln(1000000).toString();
    let expectedSponsorTokens = toBN(createTokens);
    let expectedContractCollateral = toBN(createCollateral);

    await USDCToken.approve(customcreditLine.address, createCollateral, {
      from: sponsor,
    });
    await customcreditLine.create(
      createCollateral,
      createTokens,
      Fee.feePercentage,
      { from: sponsor },
    );

    // The balances minted should equal that expected from the create function.
    assert.equal(
      (await USDCToken.balanceOf(customcreditLine.address)).toString(),
      expectedContractCollateral.toString(),
    );
    assert.equal(
      (await tokenCurrency.balanceOf(sponsor)).toString(),
      expectedSponsorTokens.toString(),
    );

    // Deposit an additional 50 USDC to the position. Sponsor now has 200 USDC as collateral.
    const depositCollateral = toBN('50').muln(1000000).toString();
    expectedContractCollateral = expectedContractCollateral.add(
      toBN(depositCollateral),
    );
    await USDCToken.approve(customcreditLine.address, depositCollateral, {
      from: sponsor,
    });
    await customcreditLine.deposit(depositCollateral, { from: sponsor });

    // The balances should reflect the additional collateral added.
    assert.equal(
      (await USDCToken.balanceOf.call(customcreditLine.address)).toString(),
      expectedContractCollateral.toString(),
    );
    assert.equal(
      (await tokenCurrency.balanceOf.call(sponsor)).toString(),
      expectedSponsorTokens.toString(),
    );
    assert.equal(
      (await customcreditLine.getCollateral.call(sponsor)).toString(),
      expectedContractCollateral.toString(),
    );
    assert.equal(
      (
        await customcreditLine.positions.call(sponsor)
      ).tokensOutstanding.toString(),
      expectedSponsorTokens.toString(),
    );
    assert.equal(
      (await customcreditLine.totalPositionCollateral()).toString(),
      expectedContractCollateral.toString(),
    );
    assert.equal(
      (
        await customcreditLine.globalPositionData.call()
      ).totalTokensOutstanding.rawValue.toString(),
      expectedSponsorTokens.toString(),
    );

    // By matching collateral and synthetic precision, we can assume that oracle price requests will always resolve to 18 decimals.
    // The two cases that need to be tested are responding to dispute requests and settlement.
    // Dispute and liquidation is tested in `Liquidatable.js`. Here we test settlement.

    // Transfer half the tokens from the sponsor to a tokenHolder. IRL this happens through the sponsor selling tokens.
    // Sponsor now has 50 synthetics and 200 collateral. Note that synthetic tokens are still represented with 1e18 base.
    const tokenHolderTokens = toWei('50').toString();
    await tokenCurrency.transfer(tokenHolder, tokenHolderTokens, {
      from: sponsor,
    });

    // To settle positions the DVM needs to be to be queried to get the price at the settlement time.
    const emergencyShutdownTime = await creditLine.getCurrentTime.call();
    await synthereumManagerInstance.emergencyShutdown(
      [customcreditLine.address],
      { from: maintainers },
    );
    // Push a settlement price into the mock oracle to simulate a DVM vote. Say settlement occurs at 1.2 Stock/USD for the price
    // feed. With 100 units of outstanding tokens this results in a token redemption value of: TRV = 100 * 1.2 = 120 USD.
    const redemptionPrice = toBN(toWei('1.2')); // 1.2*1e18
    await mockOracle.pushPrice(
      priceFeedIdentifier,
      emergencyShutdownTime,
      redemptionPrice.toString(),
    );

    // From the token holders, they are entitled to the value of their tokens, notated in the underlying.
    // They have 50 tokens settled at a price of 1.2 should yield 60 units of underling (or 60 USD as underlying is WETH).
    const tokenHolderInitialCollateral = await USDCToken.balanceOf.call(
      tokenHolder,
    );
    const tokenHolderInitialSynthetic = await tokenCurrency.balanceOf.call(
      tokenHolder,
    );
    assert.equal(tokenHolderInitialSynthetic, tokenHolderTokens);

    // Approve the tokens to be moved by the contract and execute the settlement.
    await tokenCurrency.approve(
      customcreditLine.address,
      tokenHolderInitialSynthetic,
      {
        from: tokenHolder,
      },
    );

    let settleEmergencyShutdownResult = await customcreditLine.settleEmergencyShutdown(
      {
        from: tokenHolder,
      },
    );
    const tokenHolderFinalCollateral = await USDCToken.balanceOf(tokenHolder);
    const tokenHolderFinalSynthetic = await tokenCurrency.balanceOf(
      tokenHolder,
    );

    // The token holder should gain the value of their synthetic tokens in underlying.
    // The value in underlying is the number of tokens they held in the beginning * settlement price as TRV
    // When redeeming 50 tokens at a price of 1.2 we expect to receive 60 collateral tokens (50 * 1.2)
    // This should be denominated in units of USDC and as such again scaled by 1e6
    const expectedTokenHolderFinalCollateral = toBN('60').muln(1e6);
    assert.equal(
      tokenHolderFinalCollateral.sub(tokenHolderInitialCollateral).toString(),
      expectedTokenHolderFinalCollateral.toString(),
    );

    // The token holder should have no synthetic positions left after settlement.
    assert.equal(tokenHolderFinalSynthetic, 0);

    // Check the event returned the correct values
    truffleAssert.eventEmitted(
      settleEmergencyShutdownResult,
      'SettleEmergencyShutdown',
      ev => {
        return (
          ev.caller == tokenHolder &&
          ev.collateralReturned ==
            tokenHolderFinalCollateral
              .sub(tokenHolderInitialCollateral)
              .toString() &&
          ev.tokensBurned == tokenHolderInitialSynthetic.toString()
        );
      },
    );

    // For the sponsor, they are entitled to the underlying value of their remaining synthetic tokens + the excess collateral
    // in their position at time of settlement. The sponsor had 200 units of collateral in their position and the final TRV
    // of their synthetics they drew is 120 (100*1.2). Their redeemed amount for this excess collateral is the difference between the two.
    // The sponsor also has 50 synthetic tokens that they did not sell valued at 1.2 per token.
    // This makes their expected redemption = 200 (collat) - 100 * 1.2 (debt) + 50 * 1.2 (synth returned) = 140 in e16 USDC
    const sponsorInitialCollateral = await USDCToken.balanceOf(sponsor);
    const sponsorInitialSynthetic = await tokenCurrency.balanceOf(sponsor);

    // Approve tokens to be moved by the contract and execute the settlement.
    await tokenCurrency.approve(
      customcreditLine.address,
      sponsorInitialSynthetic,
      {
        from: sponsor,
      },
    );
    await customcreditLine.settleEmergencyShutdown({ from: sponsor });
    const sponsorFinalCollateral = await USDCToken.balanceOf(sponsor);
    const sponsorFinalSynthetic = await tokenCurrency.balanceOf(sponsor);

    // The token Sponsor should gain the value of their synthetics in underlying
    // + their excess collateral from the over collateralization in their position
    // Excess collateral = 200 - 100 * 1.2 = 80
    const expectedSponsorCollateralUnderlying = toBN('80').muln(1e6);
    // Value of remaining synthetic tokens = 50 * 1.2 = 60
    const expectedSponsorCollateralSynthetic = toBN('60').muln(1e6);
    const expectedTotalSponsorCollateralReturned = expectedSponsorCollateralUnderlying.add(
      expectedSponsorCollateralSynthetic,
    );
    assert.equal(
      sponsorFinalCollateral.sub(sponsorInitialCollateral).toString(),
      expectedTotalSponsorCollateralReturned.toString(),
    );

    // The token Sponsor should have no synthetic positions left after settlement.
    assert.equal(sponsorFinalSynthetic, 0);

    // Last check is that after redemption the position in the positions mapping has been removed.
    const sponsorsPosition = await customcreditLine.positions.call(sponsor);
    assert.equal(sponsorsPosition.rawCollateral.rawValue, 0);
    assert.equal(sponsorsPosition.tokensOutstanding.rawValue, 0);
    assert.equal(sponsorsPosition.withdrawalRequestPassTimestamp.toString(), 0);
    assert.equal(sponsorsPosition.withdrawalRequestAmount.rawValue, 0);
  });

  it('Existing void remargin function', async function () {
    await creditLine.remargin();
  });

  it('Can not delete a sponsor position externally', async () => {
    await collateral.approve(creditLine.address, initialPositionCollateral, {
      from: sponsor,
    });
    await creditLine.create(
      initialPositionCollateral.toString(),
      initialPositionTokens.toString(),
      Fee.feePercentage,
      { from: sponsor },
    );
    await truffleAssert.reverts(
      creditLine.deleteSponsorPosition(sponsor, { from: other }),
      'Caller is not this contract',
    );
  });

  it('Revert if overcome deposit limit', async () => {
    await collateral.approve(creditLine.address, toWei('100'), {
      from: sponsor,
    });
    await truffleAssert.reverts(
      creditLine.create(toWei('100'), toWei('10'), Fee.feePercentage, {
        from: sponsor,
      }),
      'Position overcomes deposit limit',
    );
    await creditLine.create(toWei('10'), toWei('10'), Fee.feePercentage, {
      from: sponsor,
    });
    await truffleAssert.reverts(
      creditLine.repay(toWei('9'), Fee.feePercentage, { from: sponsor }),
      'Position overcomes deposit limit',
    );
  });

  it('Revert if overcome mint limit', async () => {
    await creditLineControllerInstance.setCapMintAmount(
      creditLine.address,
      toWei('90'),
    );
    await collateral.approve(creditLine.address, toWei('100'), {
      from: sponsor,
    });
    await truffleAssert.reverts(
      creditLine.create(toWei('100'), toWei('100'), Fee.feePercentage, {
        from: sponsor,
      }),
      'Total amount minted overcomes mint limit',
    );
  });

  it('Calculation of DAO fee', async () => {
    await collateral.approve(creditLine.address, toWei('101'), {
      from: sponsor,
    });
    await creditLine.create(toWei('1'), toWei('0.6'), Fee.feePercentage, {
      from: sponsor,
    });
    const tokensAmount = toBN(toWei('50'));
    const feeAmount = await calculateFeeAmount(
      creditLine,
      tokensAmount,
      Fee.feePercentage,
    );
    const outputFeeAmount = await creditLine.create.call(
      toWei('100'),
      tokensAmount,
      Fee.feePercentage,
      { from: sponsor },
    );
    const feeCalculated = await creditLine.calculateDaoFee.call(tokensAmount);
    assert.equal(
      feeAmount.toString(),
      outputFeeAmount.toString(),
      'Wrong output fee',
    );
    assert.equal(
      feeAmount.toString(),
      feeCalculated.toString(),
      'Wrong fee calculation into the smart contract',
    );
  });

  it('Revert if fee slippage is overcomed', async () => {
    await collateral.approve(creditLine.address, toWei('100'), {
      from: sponsor,
    });
    await truffleAssert.reverts(
      creditLine.create(
        toWei('100'),
        toWei('100'),
        Fee.feePercentage.sub(toBN('1')),
        { from: sponsor },
      ),
      'User fees are not enough for paying DAO',
    );
  });
});
