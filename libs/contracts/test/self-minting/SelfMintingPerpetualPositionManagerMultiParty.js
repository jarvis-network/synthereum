// Libraries and helpers
const { interfaceName } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toWei, hexToUtf8, toBN, utf8ToHex } = web3Utils;

// Contracts to test
const SelfMintingPerpetualPositionManagerMultiParty = artifacts.require(
  'SelfMintingPerpetualPositionManagerMultiParty',
);

// Other UMA related contracts and mocks
const Store = artifacts.require('Store');
const Finder = artifacts.require('Finder');
const MockOracle = artifacts.require('MockOracle');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const TestnetERC20 = artifacts.require('TestnetERC20');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const SynthereumManager = artifacts.require('SynthereumManager');
const FinancialContractsAdmin = artifacts.require('FinancialContractsAdmin');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const Timer = artifacts.require('Timer');
const FeePayerPartyLib = artifacts.require('FeePayerPartyLib');
const SelfMintingPerpetualPositionManagerMultiPartyLib = artifacts.require(
  'SelfMintingPerpetualPositionManagerMultiPartyLib',
);
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SelfMintingControllerMock = artifacts.require(
  'SelfMintingControllerMock',
);

contract('SelfMintingPerpetualPositionManagerMultiParty', function (accounts) {
  const contractDeployer = accounts[0];
  const mainteiner = accounts[1];
  const sponsor = accounts[2];
  const tokenHolder = accounts[3];
  const other = accounts[4];
  const collateralOwner = accounts[5];
  const beneficiary = accounts[6];
  let daoFeePercentage = toBN(toWei('0.002'));
  let daoFeeRecipient = accounts[7];
  let daoFee = {
    feePercentage: daoFeePercentage.toString(),
    feeRecipient: daoFeeRecipient,
  };
  let capMintAmount = toBN(toWei('1000000'));
  let capDepositRatio = toBN(toWei('7'));

  // Contracts
  let collateral;
  let positionManager;
  let tokenCurrency;
  let identifierWhitelist;
  let mockOracle;
  let timer;
  let finder;
  let store;
  let positionManagerParams;
  let roles;
  let synthereumFinderInstance;
  let selfMintingControllerInstance;
  let financialContractsAdmin;
  let synthereumManagerInstance;
  let addressWhitelistInstance;

  // Initial constant values
  const initialPositionTokens = toBN(toWei('1000'));
  const initialPositionCollateral = toBN(toWei('1'));
  const initalFeeAmount = initialPositionCollateral
    .mul(daoFeePercentage)
    .div(toBN(Math.pow(10, 18)));
  const syntheticName = 'Test Synthetic Token';
  const syntheticSymbol = 'SYNTH';
  const withdrawalLiveness = 1000;
  const startTimestamp = Math.floor(Date.now() / 1000);
  const priceFeedIdentifier = web3.utils.padRight(utf8ToHex('JRT/EUR'), 64);
  const minSponsorTokens = '5';

  // Conveniently asserts expected collateral and token balances, assuming that
  // there is only one synthetic token holder, the sponsor. Also assumes no
  // precision loss from `getCollateral()` coming from the fee multiplier.
  const checkBalances = async (
    expectedSponsorTokens,
    expectedSponsorCollateral,
  ) => {
    const expectedTotalTokens = expectedSponsorTokens.add(
      initialPositionTokens,
    );
    const expectedTotalCollateral = expectedSponsorCollateral.add(
      initialPositionCollateral,
    );

    const positionData = await positionManager.positions.call(sponsor);
    const sponsorCollateral = await positionManager.getCollateral.call(sponsor);
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
      (await positionManager.totalPositionCollateral.call()).toString(),
      expectedTotalCollateral.toString(),
    );

    assert.equal(
      (
        await positionManager.globalPositionData.call()
      ).totalTokensOutstanding.toString(),
      expectedTotalTokens.toString(),
    );
    assert.equal(
      await collateral.balanceOf.call(positionManager.address),
      expectedTotalCollateral.toString(),
    );
  };

  const expectNoExcessCollateralToTrim = async () => {
    let collateralTrimAmount = await positionManager.trimExcess.call(
      collateral.address,
    );
    await positionManager.trimExcess(collateral.address);
    let beneficiaryCollateralBalance = await collateral.balanceOf.call(
      beneficiary,
    );

    assert.equal(collateralTrimAmount.toString(), '0');
    assert.equal(beneficiaryCollateralBalance.toString(), '0');
  };

  const expectAndDrainExcessCollateral = async () => {
    // Drains the collateral from the contract and transfers it all back to the sponsor account to leave the beneficiary empty.
    await positionManager.trimExcess(collateral.address);
    let beneficiaryCollateralBalance = await collateral.balanceOf.call(
      beneficiary,
    );
    collateral.transfer(sponsor, beneficiaryCollateralBalance.toString(), {
      from: beneficiary,
    });

    // Assert that nonzero collateral was drained.
    assert.notEqual(beneficiaryCollateralBalance.toString(), '0');
  };

  const getGCR = async contract => {
    const totalTokens = await contract.totalTokensOutstanding.call();
    const totalNetCollateral = await contract.totalPositionCollateral.call();
    return totalNetCollateral.mul(toBN(Math.pow(10, 18))).div(totalTokens);
  };

  const calculateFeeAmount = async (contract, tokensAmount, feePercentage) => {
    const GCR = await getGCR(contract);
    const feeAmount = tokensAmount
      .mul(GCR)
      .mul(feePercentage)
      .div(toBN(Math.pow(10, 18)))
      .div(toBN(Math.pow(10, 18)));
    return feeAmount;
  };

  const checkDaoRecipientBalance = async expectedBalance => {
    const actualBalance = toBN(
      await collateral.balanceOf.call(daoFee.feeRecipient),
    );
    assert.equal(
      actualBalance.toString(),
      expectedBalance.toString(),
      'Wrong fee recipient balance',
    );
  };

  before(async function () {
    store = await Store.deployed();
  });

  beforeEach(async function () {
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

    // Force each test to start with a simulated time that's synced to the startTimestamp.
    timer = await Timer.deployed();
    await timer.setCurrentTime(startTimestamp);

    // Create identifier whitelist and register the price tracking ticker with it.
    identifierWhitelist = await IdentifierWhitelist.deployed();
    await identifierWhitelist.addSupportedIdentifier(priceFeedIdentifier, {
      from: contractDeployer,
    });

    // Create a mockOracle and finder. Register the mockMoracle with the finder.
    finder = await Finder.deployed();
    mockOracle = await MockOracle.new(finder.address, timer.address, {
      from: contractDeployer,
    });
    const mockOracleInterfaceName = utf8ToHex(interfaceName.Oracle);
    await finder.changeImplementationAddress(
      mockOracleInterfaceName,
      mockOracle.address,
      { from: contractDeployer },
    );
    synthereumFinderInstance = await SynthereumFinder.deployed();
    financialContractsAdmin = await FinancialContractsAdmin.deployed();
    addressWhitelistInstance = await AddressWhitelist.deployed();

    positionManagerParams = {
      withdrawalLiveness: withdrawalLiveness.toString(),
      collateralAddress: collateral.address,
      tokenAddress: tokenCurrency.address,
      finderAddress: finder.address,
      priceFeedIdentifier: priceFeedIdentifier,
      minSponsorTokens: { rawValue: minSponsorTokens.toString() },
      timerAddress: timer.address,
      excessTokenBeneficiary: beneficiary,
      version: 1,
      synthereumFinder: synthereumFinderInstance.address,
    };

    feePayerPartyLib = await FeePayerPartyLib.deployed();
    synthereumManagerInstance = await SynthereumManager.deployed();
    selfMintingPerpetualPositionManagerMultiPartyLib = await SelfMintingPerpetualPositionManagerMultiPartyLib.deployed();
    if (
      FeePayerPartyLib.setAsDeployed ||
      SelfMintingPerpetualPositionManagerMultiPartyLib.setAsDeployed
    ) {
      try {
        await SelfMintingPerpetualPositionManagerMultiParty.link(
          feePayerPartyLib,
        );
        await SelfMintingPerpetualPositionManagerMultiParty.link(
          selfMintingPerpetualPositionManagerMultiPartyLib,
        );
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await SelfMintingPerpetualPositionManagerMultiParty.link(
        FeePayerPartyLib,
        feePayerPartyLib.address,
      );
      await SelfMintingPerpetualPositionManagerMultiParty.link(
        SelfMintingPerpetualPositionManagerMultiPartyLib,
        selfMintingPerpetualPositionManagerMultiPartyLib.address,
      );
    }

    // Create the instance of the positionManager to test against.
    positionManager = await SelfMintingPerpetualPositionManagerMultiParty.new(
      positionManagerParams,
      {
        from: contractDeployer,
      },
    );
    selfMintingControllerInstance = await SelfMintingControllerMock.new();
    await synthereumFinderInstance.changeImplementationAddress(
      utf8ToHex('SelfMintingController'),
      selfMintingControllerInstance.address,
      { from: mainteiner },
    );
    await selfMintingControllerInstance.setCapMintAmount(
      positionManager.address,
      capMintAmount,
      { from: mainteiner },
    );
    await selfMintingControllerInstance.setCapDepositRatio(
      positionManager.address,
      capDepositRatio,
      { from: mainteiner },
    );
    await selfMintingControllerInstance.setDaoFee(
      positionManager.address,
      daoFee,
      { from: mainteiner },
    );
    // Give contract owner permissions.
    await tokenCurrency.addMinter(positionManager.address);
    await tokenCurrency.addBurner(positionManager.address);
  });

  afterEach(async () => {
    await expectNoExcessCollateralToTrim();
  });

  it('Correct deployment and variable assignment', async function () {
    // PricelessPosition variables
    assert.equal(
      (await positionManager.positionManagerData.call()).withdrawalLiveness,
      withdrawalLiveness,
    );
    assert.equal(
      await positionManager.collateralCurrency.call(),
      collateral.address,
    );
    assert.equal(
      await positionManager.tokenCurrency.call(),
      tokenCurrency.address,
    );
    assert.equal(
      (await positionManager.feePayerData.call()).finder,
      finder.address,
    );
    assert.equal(
      hexToUtf8(await positionManager.priceIdentifier.call()),
      hexToUtf8(priceFeedIdentifier),
    );
    assert.equal(
      (await positionManager.positionManagerData.call())
        .emergencyShutdownTimestamp,
      0,
    );
    assert.equal(
      (
        await positionManager.positionManagerData.call()
      ).emergencyShutdownPrice.toString(),
      0,
    );

    // Synthetic token and synthereum parameters
    assert.equal(await tokenCurrency.name.call(), syntheticName);
    assert.equal(await tokenCurrency.symbol.call(), syntheticSymbol);
    assert.equal(await positionManager.version.call(), 1);
    assert.equal(
      await positionManager.collateralCurrency.call(),
      collateral.address,
    );
    assert.equal(
      await positionManager.syntheticTokenSymbol.call(),
      syntheticSymbol,
    );
    assert.equal(
      await positionManager.synthereumFinder.call(),
      synthereumFinderInstance.address,
    );
    const returnedFee = await positionManager.daoFee.call();
    assert.equal(returnedFee.feePercentage.toString(), daoFeePercentage);
    assert.equal(returnedFee.feeRecipient.toString(), daoFeeRecipient);
    assert.equal(
      (await positionManager.capDepositRatio.call()).toString(),
      capDepositRatio.toString(),
    );
    assert.equal(
      (await positionManager.capMintAmount.call()).toString(),
      capMintAmount.toString(),
    );
  });

  it('Valid identifier in the constructor', async function () {
    let newPositionManagerData = positionManagerParams;
    newPositionManagerData.priceFeedIdentifier = web3.utils.padRight(
      utf8ToHex('UNREGISTERED'),
      64,
    );
    // Pricefeed identifier must be whitelisted.
    await truffleAssert.reverts(
      SelfMintingPerpetualPositionManagerMultiParty.new(
        newPositionManagerData,
        { from: contractDeployer },
      ),
      'Unsupported price identifier',
    );
  });

  it('Valid collateral in the constructor', async function () {
    let newPositionManagerData = positionManagerParams;
    newPositionManagerData.collateralAddress = (
      await TestnetSelfMintingERC20.new('UNREGISTERED COIN', 'WRONG TEST', 18)
    ).address;
    // Pricefeed identifier must be whitelisted.
    await truffleAssert.reverts(
      SelfMintingPerpetualPositionManagerMultiParty.new(
        newPositionManagerData,
        { from: contractDeployer },
      ),
      'Collateral not whitelisted',
    );
  });

  it('Withdrawal liveness overflow', async function () {
    // Create a contract with a very large withdrawal liveness, i.e., withdrawal requests will never pass.
    tokenCurrency = await SyntheticToken.new(
      syntheticName,
      syntheticSymbol,
      18,
      {
        from: contractDeployer,
      },
    );

    const largeLiveness = toBN(2).pow(toBN(256)).subn(10).toString();

    let newPositionManagerData = positionManagerParams;
    newPositionManagerData.tokenAddress = tokenCurrency.address;
    newPositionManagerData.withdrawalLiveness = largeLiveness;
    positionManager = await SelfMintingPerpetualPositionManagerMultiParty.new(
      newPositionManagerData,
      {
        from: contractDeployer,
      },
    );
    await selfMintingControllerInstance.setCapMintAmount(
      positionManager.address,
      capMintAmount,
      { from: mainteiner },
    );
    await selfMintingControllerInstance.setCapDepositRatio(
      positionManager.address,
      capDepositRatio,
      { from: mainteiner },
    );
    await selfMintingControllerInstance.setDaoFee(
      positionManager.address,
      daoFee,
      { from: mainteiner },
    );
    await tokenCurrency.addMinter(positionManager.address);
    await tokenCurrency.addBurner(positionManager.address);

    const initialSponsorTokens = toBN(toWei('100'));
    const initialSponsorCollateral = toBN(toWei('150'));
    const feeAmount = initialSponsorCollateral
      .mul(daoFeePercentage)
      .div(toBN(Math.pow(10, 18)));
    await collateral.approve(
      positionManager.address,
      initialSponsorCollateral.add(feeAmount),
      { from: sponsor },
    );
    await positionManager.create(
      initialSponsorCollateral,
      initialSponsorTokens,
      daoFee.feePercentage,
      { from: sponsor },
    );
    // Withdrawal requests should fail due to overflow.
    await truffleAssert.reverts(
      positionManager.requestWithdrawal(initialSponsorCollateral, {
        from: sponsor,
      }),
      'SafeMath: addition overflow',
    );
  });

  it('Lifecycle', async function () {
    await collateral.approve(
      positionManager.address,
      initialPositionCollateral,
      { from: other },
    );
    // Revert if the positionManager contract has not role of minter in the syntetic token contract
    await positionManager.create(
      initialPositionCollateral,
      initialPositionTokens,
      daoFeePercentage,
      { from: other },
    );

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Create the initial positionManager.
    const createTokens = toBN(toWei('100'));
    const createCollateral = toBN(toWei('150'));
    let expectedSponsorTokens = toBN(createTokens);
    let feeAmount = toBN(
      await calculateFeeAmount(positionManager, createTokens, daoFeePercentage),
    );
    let expectedSponsorCollateral = toBN(createCollateral).sub(feeAmount);
    let expectedFeeRecipientBalance = toBN(
      await collateral.balanceOf.call(daoFee.feeRecipient),
    ).add(feeAmount);
    // Fails without approving collateral.

    await truffleAssert.reverts(
      positionManager.create(createCollateral, createTokens, daoFeePercentage, {
        from: sponsor,
      }),
      'ERC20: transfer amount exceeds allowance',
    );
    await collateral.approve(positionManager.address, createCollateral, {
      from: sponsor,
    });
    const outputFee = await positionManager.create.call(
      createCollateral,
      createTokens,
      daoFeePercentage,
      { from: sponsor },
    );
    assert.equal(
      feeAmount.toString(),
      outputFee.toString(),
      'Wrong fee output',
    );
    const createResult = await positionManager.create(
      createCollateral,
      createTokens,
      daoFeePercentage,
      { from: sponsor },
    );
    truffleAssert.eventEmitted(createResult, 'PositionCreated', ev => {
      return (
        ev.sponsor == sponsor &&
          ev.collateralAmount == createCollateral.toString() &&
          ev.tokenAmount == createTokens.toString(),
        ev.feeAmount == feeAmount.toString()
      );
    });
    truffleAssert.eventEmitted(createResult, 'NewSponsor', ev => {
      return ev.sponsor == sponsor;
    });
    await checkBalances(expectedSponsorTokens, expectedSponsorCollateral);
    await checkDaoRecipientBalance(expectedFeeRecipientBalance);

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Deposit.
    const depositCollateral = toWei('50');
    expectedSponsorCollateral = expectedSponsorCollateral.add(
      toBN(depositCollateral),
    );
    // Fails without approving collateral.
    await truffleAssert.reverts(
      positionManager.deposit(depositCollateral, { from: sponsor }),
      'ERC20: transfer amount exceeds allowance',
    );
    await collateral.approve(positionManager.address, depositCollateral, {
      from: sponsor,
    });
    // Cannot deposit 0 collateral.
    await truffleAssert.reverts(
      positionManager.deposit('0', { from: sponsor }),
      'Invalid collateral amount',
    );
    await positionManager.deposit(depositCollateral, { from: sponsor });
    await checkBalances(expectedSponsorTokens, expectedSponsorCollateral);

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
      positionManager.withdraw('0', { from: sponsor }),
      'Invalid collateral amount',
    );
    // Cannot withdraw more than balance. (The position currently has 150 + 50 collateral).
    await truffleAssert.reverts(
      positionManager.withdraw(toWei('201'), { from: sponsor }),
      'SafeMath: subtraction overflow',
    );
    await positionManager.withdraw(withdrawCollateral, { from: sponsor });
    let sponsorFinalBalance = await collateral.balanceOf.call(sponsor);
    assert.equal(
      sponsorFinalBalance.sub(sponsorInitialBalance).toString(),
      withdrawCollateral,
    );
    await checkBalances(expectedSponsorTokens, expectedSponsorCollateral);

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Redeem 50% of the tokens for 50% of the collateral.
    const redeemTokens = toBN(toWei('50'));
    expectedSponsorTokens = expectedSponsorTokens.sub(toBN(redeemTokens));
    expectedSponsorCollateral = expectedSponsorCollateral.divn(2);
    // Fails without approving token.
    await truffleAssert.reverts(
      positionManager.redeem(redeemTokens, daoFeePercentage, { from: sponsor }),
      'ERC20: transfer amount exceeds allowance',
    );
    await tokenCurrency.approve(positionManager.address, redeemTokens, {
      from: sponsor,
    });
    sponsorInitialBalance = await collateral.balanceOf.call(sponsor);

    // Set store fees to 0% per second.
    await store.setFixedOracleFeePerSecondPerPfc({ rawValue: toWei('0') });
    // Check that no regural fees are charged unless moving forward in time
    const currentTime = await positionManager.getCurrentTime.call();
    await positionManager.setCurrentTime(currentTime.addn(1));
    await positionManager.payRegularFees();
    const storeBalance = await collateral.balanceOf.call(store.address);
    assert.equal(storeBalance.toString(), '0');

    // Check redeem return value and event.
    const redeem = positionManager.redeem;
    feeAmount = await calculateFeeAmount(
      positionManager,
      redeemTokens,
      daoFeePercentage,
    );
    const { amountWithdrawn, daoFeeAmount } = await redeem.call(
      redeemTokens,
      daoFeePercentage,
      { from: sponsor },
    );
    let expectedNetSponsorCollateral = expectedSponsorCollateral.sub(feeAmount);
    expectedFeeRecipientBalance = toBN(
      await collateral.balanceOf.call(daoFee.feeRecipient),
    ).add(feeAmount);
    assert.equal(
      amountWithdrawn.toString(),
      expectedNetSponsorCollateral.toString(),
      'Wrong redeemed output collateral',
    );
    assert.equal(
      daoFeeAmount.toString(),
      feeAmount.toString(),
      'Wrong redeem output fee',
    );
    let redemptionResult = await redeem(redeemTokens, daoFeePercentage, {
      from: sponsor,
    });
    truffleAssert.eventEmitted(redemptionResult, 'Redeem', ev => {
      return (
        ev.sponsor == sponsor &&
        ev.collateralAmount == expectedNetSponsorCollateral.toString() &&
        ev.tokenAmount == redeemTokens.toString() &&
        ev.feeAmount == daoFeeAmount.toString()
      );
    });

    sponsorFinalBalance = await collateral.balanceOf.call(sponsor);
    assert.equal(
      sponsorFinalBalance.sub(sponsorInitialBalance).toString(),
      expectedNetSponsorCollateral,
    );
    await checkBalances(expectedSponsorTokens, expectedSponsorCollateral);
    await checkDaoRecipientBalance(expectedFeeRecipientBalance);

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Create additional.
    const createAdditionalTokens = toBN(toWei('10'));
    const createAdditionalCollateral = toBN(toWei('110'));
    feeAmount = await calculateFeeAmount(
      positionManager,
      createAdditionalTokens,
      daoFeePercentage,
    );
    expectedSponsorTokens = expectedSponsorTokens.add(
      toBN(createAdditionalTokens),
    );
    expectedSponsorCollateral = expectedSponsorCollateral.add(
      toBN(createAdditionalCollateral).sub(feeAmount),
    );
    await collateral.approve(
      positionManager.address,
      createAdditionalCollateral,
      { from: sponsor },
    );
    // Check that create fails if missing Minter role.
    await positionManager.create(
      createAdditionalCollateral,
      createAdditionalTokens,
      daoFeePercentage,
      { from: sponsor },
    );
    await checkBalances(expectedSponsorTokens, expectedSponsorCollateral);

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Redeem full.
    const redeemRemainingTokens = toBN(toWei('60'));
    feeAmount = await calculateFeeAmount(
      positionManager,
      redeemRemainingTokens,
      daoFeePercentage,
    );
    await tokenCurrency.approve(
      positionManager.address,
      redeemRemainingTokens,
      { from: sponsor },
    );
    sponsorInitialBalance = await collateral.balanceOf.call(sponsor);
    redemptionResult = await positionManager.redeem(
      redeemRemainingTokens,
      daoFeePercentage,
      { from: sponsor },
    );
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
    await checkBalances(toBN('0'), toBN('0'));

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Contract state should not have changed.
    assert.equal(
      (await positionManager.positionManagerData.call())
        .emergencyShutdownTimestamp,
      0,
    );
    assert.equal(
      (
        await positionManager.positionManagerData.call()
      ).emergencyShutdownPrice.toString(),
      0,
    );
  });

  it('Cannot instantly withdraw all of the collateral in the position', async function () {
    // Create an initial large and lowly collateralized positionManager so that we can call `withdraw()`.
    await collateral.approve(
      positionManager.address,
      initialPositionCollateral,
      { from: other },
    );
    await positionManager.create(
      initialPositionCollateral,
      initialPositionTokens,
      daoFeePercentage,
      { from: other },
    );

    // Create the initial positionManager.
    const createTokens = toBN(toWei('100'));
    const createCollateral = toBN(toWei('150'));
    const feeAmount = await calculateFeeAmount(
      positionManager,
      createTokens,
      daoFeePercentage,
    );
    await collateral.approve(positionManager.address, createCollateral, {
      from: sponsor,
    });
    await positionManager.create(
      createCollateral,
      createTokens,
      daoFeePercentage,
      { from: sponsor },
    );

    // Cannot withdraw full collateral because the GCR check will always fail.
    await truffleAssert.reverts(
      positionManager.withdraw(createCollateral.sub(feeAmount), {
        from: sponsor,
      }),
      'CR below GCR',
    );
  });

  it('Withdrawal request', async function () {
    // Create an initial large and lowly collateralized positionManager.
    await collateral.approve(
      positionManager.address,
      initialPositionCollateral,
      { from: other },
    );
    await positionManager.create(
      initialPositionCollateral.toString(),
      initialPositionTokens.toString(),
      daoFeePercentage,
      { from: other },
    );

    const startTime = await positionManager.getCurrentTime();
    // Approve large amounts of token and collateral currencies: this test case isn't checking for that.
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });

    // Create the initial positionManager.
    const initialSponsorTokens = toBN(toWei('100'));
    const initialSponsorCollateral = toBN(toWei('150'));
    const feeAmount = await calculateFeeAmount(
      positionManager,
      initialSponsorTokens,
      daoFeePercentage,
    );
    await positionManager.create(
      initialSponsorCollateral,
      initialSponsorTokens,
      daoFeePercentage,
      { from: sponsor },
    );

    // Must request greater than 0 and less than full position's collateral.
    await truffleAssert.reverts(
      positionManager.requestWithdrawal('0', { from: sponsor }),
      'Invalid collateral amount',
    );
    await truffleAssert.reverts(
      positionManager.requestWithdrawal(toWei('151'), { from: sponsor }),
      'Invalid collateral amount',
    );

    // Cannot execute withdrawal request before a request is made.
    await truffleAssert.reverts(
      positionManager.withdrawPassedRequest({ from: sponsor }),
      'Invalid withdraw request',
    );

    // Request withdrawal. Check event is emitted
    const resultRequestWithdrawal = await positionManager.requestWithdrawal(
      toWei('100'),
      { from: sponsor },
    );
    truffleAssert.eventEmitted(
      resultRequestWithdrawal,
      'RequestWithdrawal',
      ev => {
        return (
          ev.sponsor == sponsor &&
          ev.collateralAmount == toWei('100').toString()
        );
      },
    );

    // All other actions are locked.
    await truffleAssert.reverts(
      positionManager.deposit(toWei('1'), { from: sponsor }),
      'Pending withdrawal',
    );
    await truffleAssert.reverts(
      positionManager.withdraw(toWei('1'), { from: sponsor }),
      'Pending withdrawal',
    );
    await truffleAssert.reverts(
      positionManager.create(toWei('1'), toWei('1'), daoFeePercentage, {
        from: sponsor,
      }),
      'Pending withdrawal',
    );
    await truffleAssert.reverts(
      positionManager.redeem(toWei('1'), daoFeePercentage, { from: sponsor }),
      'Pending withdrawal',
    );
    await truffleAssert.reverts(
      positionManager.requestWithdrawal(toWei('1'), { from: sponsor }),
      'Pending withdrawal',
    );

    // Can't withdraw before time is up.
    await positionManager.setCurrentTime(
      startTime.toNumber() + withdrawalLiveness - 1,
    );
    await truffleAssert.reverts(
      positionManager.withdrawPassedRequest({ from: sponsor }),
      'Invalid withdraw request',
    );

    // The price moved against the sponsor, and they need to cancel. Ensure event is emitted.
    const resultCancelWithdrawal = await positionManager.cancelWithdrawal({
      from: sponsor,
    });
    truffleAssert.eventEmitted(
      resultCancelWithdrawal,
      'RequestWithdrawalCanceled',
      ev => {
        return (
          ev.sponsor == sponsor &&
          ev.collateralAmount == toWei('100').toString()
        );
      },
    );

    // They can now request again.
    const withdrawalAmount = toWei('25');
    const expectedSponsorCollateral = toBN(initialSponsorCollateral)
      .sub(feeAmount)
      .sub(toBN(withdrawalAmount));
    await positionManager.requestWithdrawal(withdrawalAmount, {
      from: sponsor,
    });

    // After time is up, execute the withdrawal request. Check event is emitted and return value is correct.
    await positionManager.setCurrentTime(
      (await positionManager.getCurrentTime.call()).toNumber() +
        withdrawalLiveness,
    );
    const sponsorInitialBalance = await collateral.balanceOf.call(sponsor);
    const expectedSponsorFinalBalance = sponsorInitialBalance.add(
      toBN(withdrawalAmount),
    );
    const withdrawPassedRequest = positionManager.withdrawPassedRequest;
    let amountWithdrawn = await withdrawPassedRequest.call({
      from: sponsor,
    });
    assert.equal(amountWithdrawn.toString(), withdrawalAmount.toString());
    let resultWithdrawPassedRequest = await withdrawPassedRequest({
      from: sponsor,
    });
    truffleAssert.eventEmitted(
      resultWithdrawPassedRequest,
      'RequestWithdrawalExecuted',
      ev => {
        return (
          ev.sponsor == sponsor &&
          ev.collateralAmount == withdrawalAmount.toString()
        );
      },
    );

    // Check that withdrawal-request related parameters in positionManager are reset
    const positionData = await positionManager.positions.call(sponsor);
    assert.equal(positionData.withdrawalRequestPassTimestamp.toString(), 0);
    assert.equal(positionData.withdrawalRequestAmount.toString(), 0);

    // Verify state of positionManager post-withdrawal.
    await checkBalances(toBN(initialSponsorTokens), expectedSponsorCollateral);
    const sponsorFinalBalance = await collateral.balanceOf.call(sponsor);
    assert.equal(
      sponsorFinalBalance.toString(),
      expectedSponsorFinalBalance.toString(),
    );

    // Methods are now unlocked again.
    await positionManager.deposit(toWei('1'), { from: sponsor });

    // First withdrawal that should pass. Ensure event is emitted and return value is correct.
    const withdraw = positionManager.withdraw;
    amountWithdrawn = await withdraw.call(toWei('1'), { from: sponsor });
    assert.equal(amountWithdrawn.toString(), toWei('1'));
    const resultWithdraw = await withdraw(toWei('1'), { from: sponsor });
    truffleAssert.eventEmitted(resultWithdraw, 'Withdrawal', ev => {
      return (
        ev.sponsor == sponsor && ev.collateralAmount.toString() == toWei('1')
      );
    });
    const newFeeAmount = await calculateFeeAmount(
      positionManager,
      toBN(toWei('100')),
      daoFeePercentage,
    );
    await positionManager.create(
      toBN(toWei('125')).add(newFeeAmount),
      toWei('100'),
      daoFeePercentage,
      { from: sponsor },
    );
    await positionManager.redeem(toWei('100'), daoFeePercentage, {
      from: sponsor,
    });
    const newExpectedSponsorCollateral = expectedSponsorCollateral
      .add(toBN(toWei('125')))
      .div(toBN('2'));
    await checkBalances(
      toBN(initialSponsorTokens),
      newExpectedSponsorCollateral,
    );

    // Can't cancel if no withdrawals pending.
    await truffleAssert.reverts(
      positionManager.cancelWithdrawal({ from: sponsor }),
      'No pending withdrawal',
    );

    // Request to withdraw remaining collateral. Post-fees, this amount should get reduced to the remaining collateral.
    await positionManager.requestWithdrawal(newExpectedSponsorCollateral, {
      from: sponsor,
    });
    // Setting fees to 0.00001 per second will charge (0.00001 * 1000) = 0.01 or 1 % of the collateral.
    await store.setFixedOracleFeePerSecondPerPfc({
      rawValue: toWei('0.00001'),
    });
    const expectedWithdrawAmount = newExpectedSponsorCollateral
      .mul(toBN('99'))
      .div(toBN('100'));
    await positionManager.setCurrentTime(
      (await positionManager.getCurrentTime.call()).toNumber() +
        withdrawalLiveness,
    );
    resultWithdrawPassedRequest = await positionManager.withdrawPassedRequest({
      from: sponsor,
    });
    truffleAssert.eventEmitted(
      resultWithdrawPassedRequest,
      'RequestWithdrawalExecuted',
      ev => {
        return (
          ev.sponsor == sponsor &&
          ev.collateralAmount == expectedWithdrawAmount.toString()
        );
      },
    );
    // @dev: Can't easily call `checkBalances(initialSponsorTokens, 0)` here because of the fee charged, which is also
    // charged on the lowly-collateralized collateral (whose sponsor is `other`).

    // Contract state should not have changed.
    assert.equal(
      (await positionManager.positionManagerData.call())
        .emergencyShutdownTimestamp,
      0,
    );
    assert.equal(
      (
        await positionManager.positionManagerData.call()
      ).emergencyShutdownPrice.toString(),
      0,
    );

    // Reset store state.
    await store.setFixedOracleFeePerSecondPerPfc({ rawValue: '0' });
  });

  it('Global collateralization ratio checks', async function () {
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: '0',
      feeRecipient: daoFeeRecipient,
    });
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: other,
    });

    // Create the initial positionManager, with a 150% collateralization ratio.
    await positionManager.create(toWei('150'), toWei('100'), daoFeePercentage, {
      from: sponsor,
    });

    // Any withdrawal requests should fail, because withdrawals would reduce the global collateralization ratio.
    await truffleAssert.reverts(
      positionManager.withdraw(toWei('1'), { from: sponsor }),
      'CR below GCR',
    );

    // Because there is only 1 sponsor, neither the sponsor nor potential new sponsors can create below the global ratio.
    await truffleAssert.reverts(
      positionManager.create(toWei('150'), toWei('101'), daoFeePercentage, {
        from: sponsor,
      }),
      'Insufficient collateral',
    );
    await truffleAssert.reverts(
      positionManager.create(toWei('150'), toWei('101'), daoFeePercentage, {
        from: other,
      }),
      'Insufficient collateral',
    );

    // Because there is only 1 sponsor, both the sponsor and potential new sponsors must create equal to or above the global ratio.
    await positionManager.create(toWei('15'), toWei('10'), daoFeePercentage, {
      from: sponsor,
    });
    await positionManager.create(toWei('25'), toWei('10'), daoFeePercentage, {
      from: other,
    });

    // At this point the GCR is (150 + 15 + 25) / (100 + 10 + 10) = 158.3%.

    // Since the smaller sponsor is well above the GCR at 250%, they can create new tokens with 0 collateral. Let's say they want
    // to create 5 tokens with 0 collateral. Their new position CR will be 25/10+5 = 166.7%.
    // Therefore, their resultant CR > GCR and this creation is valid. However, if they instead created 6 tokens with 0 collateral, then their
    // resultant CR would be 25/10+6 = 156.3%.
    await truffleAssert.reverts(
      positionManager.create(toWei('0'), toWei('6'), daoFeePercentage, {
        from: other,
      }),
      'Insufficient collateral',
    );
    await positionManager.create(toWei('0'), toWei('5'), daoFeePercentage, {
      from: other,
    });

    // The new GCR is (190 / 120+5) = 152%. The large sponsor's CR is (165/110) = 150%, so they cannot withdraw
    // any tokens.
    await truffleAssert.reverts(
      positionManager.withdraw(toWei('1'), { from: sponsor }),
      'CR below GCR',
    );

    // Additionally, the large sponsor cannot create any tokens UNLESS their created tokens to deposited collateral ratio > GCR.
    // If the large sponsor wants to create 0.1 more tokens, then they would need to deposit at least 0.152 collateral.
    // This would make their position CR (165+0.152/110+0.1) slightly > 150%, still below the GCR, but the new create ratio > GCR
    await truffleAssert.reverts(
      positionManager.create(toWei('0.151'), toWei('0.1'), daoFeePercentage, {
        from: sponsor,
      }),
      'Insufficient collateral',
    );
    await positionManager.create(
      toWei('0.152'),
      toWei('0.1'),
      daoFeePercentage,
      { from: sponsor },
    );

    // For the "other" Position:
    // global collateralization ratio = (190.152) / (125.1) = 1.52
    // To maintain 15 tokens, need at least 22.8 collateral => e.g. can withdraw from 25 down to 23 but not to 22.
    await truffleAssert.reverts(
      positionManager.withdraw(toWei('3'), { from: other }),
      'CR below GCR',
    );
    await positionManager.withdraw(toWei('2'), { from: other });
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: daoFeePercentage.toString(),
      feeRecipient: daoFeeRecipient,
    });
  });

  it('Non sponsor can use depositTo', async function () {
    await collateral.approve(positionManager.address, toWei('1000'), {
      from: other,
    });
    await collateral.approve(positionManager.address, toWei('1000'), {
      from: sponsor,
    });

    const numTokens = toWei('1');

    await positionManager.create(toWei('1'), numTokens, daoFeePercentage, {
      from: sponsor,
    });

    // Other makes a deposit to the sponsor's account.
    await positionManager.depositTo(sponsor, toWei('1'), { from: other });

    assert.equal(
      (await positionManager.getCollateral.call(sponsor)).toString(),
      toWei('2'),
    );
    assert.equal(
      (await positionManager.getCollateral.call(other)).toString(),
      '0',
    );
  });

  it("Non sponsor can't deposit, redeem, or withdraw", async function () {
    // Create an initial large and lowly collateralized positionManager.
    await collateral.approve(
      positionManager.address,
      initialPositionCollateral,
      { from: other },
    );

    await positionManager.create(
      initialPositionCollateral.toString(),
      initialPositionTokens.toString(),
      daoFeePercentage,
      { from: other },
    );

    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });

    // Can't deposit without first creating a positionManager.
    await truffleAssert.reverts(
      positionManager.deposit(toWei('1'), { from: sponsor }),
      'Position has no collateral',
    );

    // Can't request a withdrawal without first creating a positionManager.
    await truffleAssert.reverts(
      positionManager.requestWithdrawal(toWei('0'), { from: sponsor }),
      'Position has no collateral',
    );

    // Even if the "sponsor" acquires a token somehow, they can't redeem.
    await tokenCurrency.transfer(sponsor, toWei('1'), { from: other });
    await truffleAssert.reverts(
      positionManager.redeem(toWei('1'), daoFeePercentage, { from: sponsor }),
      'Position has no collateral',
    );
  });

  it("Can't redeem more than position size", async function () {
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: '0',
      feeRecipient: daoFeeRecipient,
    });
    await tokenCurrency.approve(positionManager.address, toWei('1000'), {
      from: sponsor,
    });
    await collateral.approve(positionManager.address, toWei('1000'), {
      from: other,
    });
    await collateral.approve(positionManager.address, toWei('1000'), {
      from: sponsor,
    });

    const numTokens = toWei('1');
    const numCombinedTokens = toWei('2');
    await positionManager.create(toWei('1'), numTokens, daoFeePercentage, {
      from: other,
    });
    await positionManager.create(toWei('1'), numTokens, daoFeePercentage, {
      from: sponsor,
    });

    await tokenCurrency.transfer(sponsor, numTokens, { from: other });
    await truffleAssert.reverts(
      positionManager.redeem(numCombinedTokens, daoFeePercentage, {
        from: sponsor,
      }),
      'Invalid token amount',
    );
    await positionManager.redeem(numTokens, daoFeePercentage, {
      from: sponsor,
    });
    await truffleAssert.reverts(
      positionManager.redeem(numTokens, daoFeePercentage, { from: sponsor }),
      'Position has no collateral',
    );
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: daoFeePercentage.toString(),
      feeRecipient: daoFeeRecipient,
    });
  });

  it('Existing sponsor can use depositTo on other account', async function () {
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: '0',
      feeRecipient: daoFeeRecipient,
    });

    await collateral.approve(positionManager.address, toWei('1000'), {
      from: other,
    });
    await collateral.approve(positionManager.address, toWei('1000'), {
      from: sponsor,
    });

    const numTokens = toWei('1');
    await positionManager.create(toWei('1'), numTokens, daoFeePercentage, {
      from: other,
    });
    await positionManager.create(toWei('1'), numTokens, daoFeePercentage, {
      from: sponsor,
    });

    // Other makes a deposit to the sponsor's account despite having their own position.
    await positionManager.depositTo(sponsor, toWei('1'), { from: other });

    assert.equal(
      (await positionManager.getCollateral(sponsor)).toString(),
      toWei('2'),
    );
    assert.equal(
      (await positionManager.getCollateral(other)).toString(),
      toWei('1'),
    );
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: daoFeePercentage.toString(),
      feeRecipient: daoFeeRecipient,
    });
  });

  it('Sponsor use depositTo on own account', async function () {
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: '0',
      feeRecipient: daoFeeRecipient,
    });

    await collateral.approve(positionManager.address, toWei('1000'), {
      from: sponsor,
    });

    const numTokens = toWei('1');
    await positionManager.create(toWei('1'), numTokens, daoFeePercentage, {
      from: sponsor,
    });

    // Sponsor makes a deposit to their own account.
    await positionManager.depositTo(sponsor, toWei('1'), { from: sponsor });

    assert.equal(
      (await positionManager.getCollateral(sponsor)).toString(),
      toWei('2'),
    );
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: daoFeePercentage.toString(),
      feeRecipient: daoFeeRecipient,
    });
  });

  it('Sponsor can use repay to decrease their debt', async function () {
    await selfMintingControllerInstance.setCapDepositRatio(
      positionManager.address,
      toBN(toWei(toWei('1'))),
    );

    await collateral.approve(positionManager.address, toWei('1000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(positionManager.address, toWei('1000'), {
      from: sponsor,
    });

    await positionManager.create(toWei('1'), toWei('100'), daoFeePercentage, {
      from: sponsor,
    });

    const initialSponsorTokens = await tokenCurrency.balanceOf.call(sponsor);
    const initialSponsorTokenDebt = toBN(
      (await positionManager.positions.call(sponsor)).tokensOutstanding
        .rawValue,
    );
    const initialTotalTokensOutstanding = toBN(
      (await positionManager.globalPositionData.call()).totalTokensOutstanding
        .rawValue,
    );
    const feeAmount = await calculateFeeAmount(
      positionManager,
      toBN(toWei('40')),
      daoFeePercentage,
    );
    const expectedFeeRecipientBalance = toBN(
      await collateral.balanceOf.call(daoFeeRecipient),
    ).add(feeAmount);
    const repayResult = await positionManager.repay(
      toWei('40'),
      daoFeePercentage,
      { from: sponsor },
    );
    // Event is correctly emitted.
    truffleAssert.eventEmitted(repayResult, 'Repay', ev => {
      return (
        ev.sponsor == sponsor &&
        ev.numTokensRepaid == toWei('40') &&
        ev.newTokenCount == toWei('60') &&
        ev.feeAmount == feeAmount.toString()
      );
    });
    await checkDaoRecipientBalance(expectedFeeRecipientBalance);
    const expectedCollAmount = toBN(toWei('1')).sub(feeAmount);
    assert.equal(
      expectedCollAmount.toString(),
      (await positionManager.totalPositionCollateral.call()).toString(),
      'Wrong collateral result',
    );
    const tokensPaid = initialSponsorTokens.sub(
      await tokenCurrency.balanceOf(sponsor),
    );
    const tokenDebtDecreased = initialSponsorTokenDebt.sub(
      toBN(
        (await positionManager.positions.call(sponsor)).tokensOutstanding
          .rawValue,
      ),
    );
    const totalTokensOutstandingDecreased = initialTotalTokensOutstanding.sub(
      toBN(
        (await positionManager.globalPositionData.call()).totalTokensOutstanding
          .rawValue,
      ),
    );

    // Tokens paid back to contract,the token debt decrease and decrease in outstanding should all equal 40 tokens.
    assert.equal(tokensPaid.toString(), toWei('40'));
    assert.equal(tokenDebtDecreased.toString(), toWei('40'));
    assert.equal(totalTokensOutstandingDecreased.toString(), toWei('40'));

    // Can not request to repay more than their token balance. Sponsor has remaining 60. max they can repay is 60
    assert.equal(
      (await positionManager.positions.call(sponsor)).tokensOutstanding
        .rawValue,
      toWei('60'),
    );
    await truffleAssert.reverts(
      positionManager.repay(toWei('65'), daoFeePercentage, { from: sponsor }),
      'Invalid token amount',
    );

    // Can not repay to position less than minimum sponsor size. Minimum sponsor size is 5 wei. Repaying 60 - 3 wei
    // would leave the position at a size of 2 wei, which is less than acceptable minimum.
    await truffleAssert.reverts(
      positionManager.repay(
        toBN(toWei('60')).subn(3).toString(),
        daoFeePercentage,
        { from: sponsor },
      ),
      'Below minimum sponsor position',
    );

    // Can repay up to the minimum sponsor size
    await positionManager.repay(
      toBN(toWei('60')).sub(toBN(minSponsorTokens)).toString(),
      daoFeePercentage,
      { from: sponsor },
    );

    assert.equal(
      (await positionManager.positions.call(sponsor)).tokensOutstanding
        .rawValue,
      minSponsorTokens,
    );

    // As at the minimum sponsor size even removing 1 wei wll reverts.
    await truffleAssert.reverts(
      positionManager.repay('1', daoFeePercentage, { from: sponsor }),
      'Below minimum sponsor position',
    );
    await selfMintingControllerInstance.setCapDepositRatio(
      positionManager.address,
      capDepositRatio,
    );
  });

  it('Basic oracle fees', async function () {
    await selfMintingControllerInstance.setCapDepositRatio(
      positionManager.address,
      toBN(toWei(toWei('1'))),
    );
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: '0',
      feeRecipient: daoFeeRecipient,
    });
    // Set up position.
    await collateral.approve(positionManager.address, toWei('1000'), {
      from: other,
    });
    await collateral.approve(positionManager.address, toWei('1000'), {
      from: sponsor,
    });

    // Set up another position that is less collateralized so sponsor can withdraw freely.
    await positionManager.create(
      toWei('1'),
      toWei('100000'),
      daoFeePercentage,
      { from: other },
    );
    await positionManager.create(toWei('1'), toWei('1'), daoFeePercentage, {
      from: sponsor,
    });

    // Set store fees to 1% per second.
    await store.setFixedOracleFeePerSecondPerPfc({ rawValue: toWei('0.01') });

    // Move time in the contract forward by 1 second to capture a 1% fee.
    const startTime = await positionManager.getCurrentTime();
    await positionManager.setCurrentTime(startTime.addn(1));

    // Determine the expected store balance by adding 1% of the sponsor balance to the starting store balance.
    // Multiply by 2 because there are two active positions
    const expectedStoreBalance = (
      await collateral.balanceOf(store.address)
    ).add(toBN(toWei('0.02')));

    // Pay the fees, check the return value, and then check the collateral and the store balance.
    const payRegularFees = positionManager.payRegularFees;
    const feesPaid = await payRegularFees.call();
    assert.equal(feesPaid.toString(), toWei('0.02'));
    const payFeesResult = await payRegularFees();
    truffleAssert.eventEmitted(payFeesResult, 'RegularFeesPaid', ev => {
      return (
        ev.regularFee.toString() === toWei('0.02') &&
        ev.lateFee.toString() === '0'
      );
    });
    let collateralAmount = await positionManager.getCollateral(sponsor);
    assert.equal(collateralAmount.rawValue.toString(), toWei('0.99'));
    assert.equal(
      (await collateral.balanceOf(store.address)).toString(),
      expectedStoreBalance.toString(),
    );

    // Calling `payRegularFees()` more than once in the same block does not emit a RegularFeesPaid event.
    const feesPaidRepeat = await payRegularFees.call();
    assert.equal(feesPaidRepeat.toString(), '0');
    const payFeesRepeatResult = await payRegularFees();
    truffleAssert.eventNotEmitted(payFeesRepeatResult, 'RegularFeesPaid');

    // Ensure that fees are not applied to new collateral.
    // TODO: value chosen specifically to avoid rounding errors -- see #873.
    await positionManager.deposit(toWei('99'), { from: sponsor });
    collateralAmount = await positionManager.getCollateral(sponsor);
    assert.equal(collateralAmount.rawValue.toString(), toWei('99.99'));

    // Ensure that the conversion works correctly for withdrawals.
    const expectedSponsorBalance = (await collateral.balanceOf(sponsor)).add(
      toBN(toWei('1')),
    );
    await positionManager.withdraw(toWei('1'), { from: sponsor });
    assert.equal(
      (await collateral.balanceOf(sponsor)).toString(),
      expectedSponsorBalance.toString(),
    );
    assert.equal(
      (await positionManager.getCollateral(sponsor)).toString(),
      toWei('98.99'),
    );

    // Test that regular fees accrue after an emergency shutdown is triggered.
    await financialContractsAdmin.callEmergencyShutdown(
      positionManager.address,
    );

    // Ensure that the maximum fee % of pfc charged is 100%. Advance > 100 seconds from the last payment time to attempt to
    // pay > 100% fees on the PfC. This should pay a maximum of 100% of the PfC without reverting.
    const pfc = await positionManager.pfc();
    const feesOwed = (
      await store.computeRegularFee(startTime.addn(1), startTime.addn(102), {
        rawValue: pfc.toString(),
      })
    ).regularFee;
    assert.isTrue(Number(pfc.toString()) < Number(feesOwed.toString()));
    const farIntoTheFutureSeconds = 502;
    await positionManager.setCurrentTime(
      startTime.addn(farIntoTheFutureSeconds),
    );
    const payTooManyFeesResult = await positionManager.payRegularFees();
    truffleAssert.eventEmitted(payTooManyFeesResult, 'RegularFeesPaid', ev => {
      // There should be 98.99 + 0.99 = 99.98 collateral remaining in the contract.
      return (
        ev.regularFee.toString() === toWei('99.98') &&
        ev.lateFee.toString() === '0'
      );
    });
    assert.equal(
      (await positionManager.getCollateral(sponsor)).toString(),
      '0',
    );

    // TODO: Add unit tests for when the latePenalty > 0 but (latePenalty + regularFee > pfc). The component fees need to be reduced properly.

    // Set the store fees back to 0 to prevent it from affecting other tests.
    await store.setFixedOracleFeePerSecondPerPfc({ rawValue: '0' });

    // Check that no event is fired if the fees owed are 0.
    await positionManager.setCurrentTime(
      startTime.addn(farIntoTheFutureSeconds + 1),
    );
    const payZeroFeesResult = await payRegularFees();
    truffleAssert.eventNotEmitted(payZeroFeesResult, 'RegularFeesPaid');
    await selfMintingControllerInstance.setCapDepositRatio(
      positionManager.address,
      capDepositRatio,
    );
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: daoFeePercentage.toString(),
      feeRecipient: daoFeeRecipient,
    });
  });

  it('Emergency shutdown: lifecycle', async function () {
    // Create one position with 100 synthetic tokens to mint with 150 tokens of collateral. For this test say the
    // collateral is WETH with a value of 1USD and the synthetic is some fictional stock or commodity.
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    const numTokens = toWei('100');
    const amountCollateral = toWei('150');
    await positionManager.create(
      amountCollateral,
      numTokens,
      daoFeePercentage,
      { from: sponsor },
    );

    // Transfer half the tokens from the sponsor to a tokenHolder. IRL this happens through the sponsor selling tokens.
    const tokenHolderTokens = toWei('50');
    await tokenCurrency.transfer(tokenHolder, tokenHolderTokens, {
      from: sponsor,
    });

    // Some time passes and the UMA token holders decide that Emergency shutdown needs to occur.
    const shutdownTimestamp =
      Number(await positionManager.getCurrentTime()) + 1000;
    await positionManager.setCurrentTime(shutdownTimestamp);

    // Before the token sponsor has called emergencyShutdown should be disable settleEmergencyShutdown
    await truffleAssert.reverts(
      positionManager.settleEmergencyShutdown({ from: sponsor }),
      'Contract not emergency shutdown',
    );

    // Should reverts if emergency shutdown initialized by non financial admin or synthereum manager.
    await truffleAssert.reverts(
      positionManager.emergencyShutdown({ from: other }),
      'Caller must be a Synthereum manager or the UMA governor',
    );

    // Pool can initiate emergency shutdown.
    const emergencyShutdownTx = await synthereumManagerInstance.emergencyShutdown(
      [positionManager.address],
      { from: mainteiner },
    );
    assert.equal(
      (await positionManager.positionManagerData.call())
        .emergencyShutdownTimestamp,
      shutdownTimestamp,
    );
    assert.equal(
      (await positionManager.emergencyShutdownPrice.call()).toString(),
      0,
    );

    // Emergency shutdown should not be able to be called a second time.
    await truffleAssert.reverts(
      synthereumManagerInstance.emergencyShutdown([positionManager.address], {
        from: mainteiner,
      }),
    );

    // Before the DVM has resolved a price withdrawals should be disabled (as with settlement at maturity).
    await truffleAssert.reverts(
      positionManager.settleEmergencyShutdown({ from: sponsor }),
    );

    // All contract functions should also blocked as emergency shutdown.
    await truffleAssert.reverts(
      positionManager.create(toWei('1'), toWei('1'), daoFeePercentage, {
        from: sponsor,
      }),
      'Contract emergency shutdown',
    );
    await truffleAssert.reverts(
      positionManager.deposit(toWei('1'), { from: sponsor }),
      'Contract emergency shutdown',
    );
    await truffleAssert.reverts(
      positionManager.withdraw(toWei('1'), { from: sponsor }),
      'Contract emergency shutdown',
    );
    await truffleAssert.reverts(
      positionManager.redeem(toWei('1'), daoFeePercentage, { from: sponsor }),
      'Contract emergency shutdown',
    );
    await truffleAssert.reverts(
      positionManager.requestWithdrawal(toWei('1'), { from: sponsor }),
      'Contract emergency shutdown',
    );
    await truffleAssert.reverts(
      positionManager.withdrawPassedRequest({ from: sponsor }),
      'Contract emergency shutdown',
    );

    // UMA token holders now vote to resolve of the price request to enable the emergency shutdown to continue.
    // Say they resolve to a price of 1.1 USD per synthetic token.
    await mockOracle.pushPrice(
      priceFeedIdentifier,
      shutdownTimestamp,
      toWei('1.1'),
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
      positionManager.address,
      tokenHolderInitialSynthetic,
      {
        from: tokenHolder,
      },
    );

    await positionManager.settleEmergencyShutdown({ from: tokenHolder });
    assert.equal(
      (await positionManager.emergencyShutdownPrice.call()).toString(),
      toWei('1.1'),
    );
    const tokenHolderFinalCollateral = await collateral.balanceOf(tokenHolder);
    const tokenHolderFinalSynthetic = await tokenCurrency.balanceOf(
      tokenHolder,
    );
    const expectedTokenHolderFinalCollateral = toWei('55');
    assert.equal(
      tokenHolderFinalCollateral.sub(tokenHolderInitialCollateral),
      expectedTokenHolderFinalCollateral,
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
      positionManager.address,
      tokenHolderInitialSynthetic,
      { from: tokenHolder },
    );
    await positionManager.settleEmergencyShutdown({ from: tokenHolder });
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
    await tokenCurrency.approve(
      positionManager.address,
      sponsorInitialSynthetic,
      {
        from: sponsor,
      },
    );
    await positionManager.settleEmergencyShutdown({
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
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    const numTokens = toWei('100');
    const amountCollateral = toWei('150');
    await positionManager.create(
      amountCollateral,
      numTokens,
      daoFeePercentage,
      { from: sponsor },
    );

    // Transfer half the tokens from the sponsor to a tokenHolder. IRL this happens through the sponsor selling tokens.
    const tokenHolderTokens = toWei('50');
    await tokenCurrency.transfer(tokenHolder, tokenHolderTokens, {
      from: sponsor,
    });

    // Some time passes and the UMA token holders decide that Emergency shutdown needs to occur.
    const shutdownTimestamp =
      Number(await positionManager.getCurrentTime()) + 1000;
    await positionManager.setCurrentTime(shutdownTimestamp);

    // Pool can initiate emergency shutdown.
    await financialContractsAdmin.callEmergencyShutdown(
      positionManager.address,
    );
    assert.equal(
      (await positionManager.positionManagerData.call())
        .emergencyShutdownTimestamp,
      shutdownTimestamp,
    );
    assert.equal(
      (await positionManager.emergencyShutdownPrice.call()).toString(),
      0,
    );
  });

  describe('Precision loss as a result of regular fees is handled as expected', () => {
    beforeEach(async () => {
      // Create a new position with:
      // - 30 collateral
      // - 20 synthetic tokens (10 held by token holder, 10 by sponsor)
      await collateral.approve(positionManager.address, '100000', {
        from: sponsor,
      });
      const numTokens = '20';
      const amountCollateral = '30';
      await positionManager.create(
        amountCollateral,
        numTokens,
        daoFeePercentage,
        { from: sponsor },
      );
      await tokenCurrency.approve(positionManager.address, numTokens, {
        from: sponsor,
      });

      // Setting the regular fee to 4 % per second will result in a miscalculated cumulativeFeeMultiplier after 1 second
      // because of the intermediate calculation in `payRegularFees()` for calculating the `feeAdjustment`: ( fees paid ) / (total collateral)
      // = 0.033... repeating, which cannot be represented precisely by a fixed point.
      // --> 0.04 * 30 wei = 1.2 wei, which gets truncated to 1 wei, so 1 wei of fees are paid
      const regularFee = toWei('0.04');
      await store.setFixedOracleFeePerSecondPerPfc({ rawValue: regularFee });

      // Advance the contract one second and make the contract pay its regular fees
      let startTime = await positionManager.getCurrentTime();
      await positionManager.setCurrentTime(startTime.addn(1));
      await positionManager.payRegularFees();

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
      let collateralAmount = await positionManager.getCollateral(sponsor);
      assert.isTrue(toBN(collateralAmount.rawValue).lt(toBN('29')));
      assert.equal(
        (
          await positionManager.feePayerData.call()
        ).cumulativeFeeMultiplier.toString(),
        toWei('0.966666666666666666').toString(),
      );

      // The actual amount of fees paid to the store is as expected = 1 wei.
      // At this point, the store should have +1 wei, the contract should have 29 wei but the position will show 28 wei
      // because `(30 * 0.966666666666666666 = 28.999...98)`. `30` is the rawCollateral and if the fee multiplier were correct,
      // then `totalPositionCollateral` would be `(30 * 0.966666666666666666...) = 29`.
      assert.equal(
        (await collateral.balanceOf(positionManager.address)).toString(),
        '29',
      );
      assert.equal(
        (await positionManager.totalPositionCollateral.call()).toString(),
        '28',
      );
      assert.equal(
        (
          await positionManager.globalPositionData.call()
        ).rawTotalPositionCollateral.rawValue.toString(),
        '30',
      );

      // Drain excess collateral left because of precesion loss.
      await expectAndDrainExcessCollateral();
    });
    it('settleEmergencyShutdown() returns the same amount of collateral that totalPositionCollateral is decreased by', async () => {
      // Emergency shutdown the contract
      const emergencyShutdownTime = await positionManager.getCurrentTime();
      await synthereumManagerInstance.emergencyShutdown(
        [positionManager.address],
        { from: mainteiner },
      );

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
      await tokenCurrency.approve(positionManager.address, tokenHolderTokens, {
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
      await positionManager.settleEmergencyShutdown({ from: tokenHolder });
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
        (await collateral.balanceOf.call(positionManager.address)).toString(),
        '18',
      );
      assert.equal(
        (await positionManager.totalPositionCollateral.call()).toString(),
        '17',
      );
      assert.equal(
        (
          await positionManager.globalPositionData.call()
        ).rawTotalPositionCollateral.rawValue.toString(),
        '18',
      );

      // The token holder should have no synthetic positions left after settlement.
      assert.equal(tokenHolderFinalSynthetic, 0);

      // The sponsor is entitled to the underlying value of their remaining synthetic tokens + the excess collateral
      // in their position at time of settlement - final fees. But we'll see that the "excess" collateral displays error
      // due to precision loss.
      const sponsorInitialCollateral = await collateral.balanceOf.call(sponsor);
      await positionManager.settleEmergencyShutdown({ from: sponsor });
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
        (await positionManager.totalPositionCollateral()).toString(),
        '1',
      );
      assert.equal(
        (
          await positionManager.globalPositionData.call()
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
        (await collateral.balanceOf.call(positionManager.address)).toString(),
        '2',
      );
      assert.equal(
        (await positionManager.totalPositionCollateral.call()).toString(),
        '1',
      );

      // Last check is that after redemption the position in the positions mapping is still removed despite leaving collateral dust.
      const sponsorsPosition = await positionManager.positions.call(sponsor);
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
      await positionManager.requestWithdrawal('12', { from: sponsor });
      let startTime = await positionManager.getCurrentTime();
      await positionManager.setCurrentTime(startTime.addn(withdrawalLiveness));
      await positionManager.withdrawPassedRequest({ from: sponsor });
      const finalCollateral = await collateral.balanceOf.call(sponsor);

      // The sponsor should gain their requested amount minus precision loss.
      const expectedFinalCollateral = '11';
      assert.equal(
        finalCollateral.sub(initialCollateral),
        expectedFinalCollateral,
      );
      assert.equal(
        (await collateral.balanceOf.call(positionManager.address)).toString(),
        '18',
      );
      assert.equal(
        (await positionManager.totalPositionCollateral()).toString(),
        '17',
      );
      assert.equal(
        (
          await positionManager.globalPositionData.call()
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
      await positionManager.redeem('9', daoFeePercentage, { from: sponsor });
      const finalCollateral = await collateral.balanceOf.call(sponsor);

      // The sponsor should gain their requested amount minus precision loss.
      assert.equal(finalCollateral.sub(initialCollateral), '11');
      assert.equal(
        (await collateral.balanceOf.call(positionManager.address)).toString(),
        '18',
      );
      assert.equal(
        (await positionManager.totalPositionCollateral()).toString(),
        '17',
      );
      assert.equal(
        (
          await positionManager.globalPositionData.call()
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
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: tokenHolder,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: other,
    });

    // Create one position with 200 synthetic tokens to mint with 300 tokens of collateral. For this test say the
    // collateral is WETH with a value of 1USD and the synthetic is some fictional stock or commodity.
    const amountCollateral = toWei('300');
    const numTokens = toWei('200');
    await positionManager.create(
      amountCollateral,
      numTokens,
      daoFeePercentage,
      { from: sponsor },
    );

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
    const emergencyShutdownTime = await positionManager.getCurrentTime();
    await synthereumManagerInstance.emergencyShutdown(
      [positionManager.address],
      { from: mainteiner },
    );

    // Push a settlement price into the mock oracle to simulate a DVM vote. Say settlement occurs at 1.2 Stock/USD for the price
    // feed. With 200 units of outstanding tokens this results in a token redemption value of: TRV = 200 * 1.2 = 240 USD.
    await mockOracle.pushPrice(
      priceFeedIdentifier,
      emergencyShutdownTime,
      toWei('1.2'),
    );

    // Token holder should receive 120 collateral tokens for their 100 synthetic tokens.
    let initialCollateral = await collateral.balanceOf.call(tokenHolder);
    await positionManager.settleEmergencyShutdown({ from: tokenHolder });
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
    await positionManager.settleEmergencyShutdown({ from: sponsor });
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
    await positionManager.settleEmergencyShutdown({ from: other });
    collateralPaid = (await collateral.balanceOf.call(other)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('120'));
  });

  it('Oracle price can resolve to 0', async function () {
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: tokenHolder,
    });

    // For the price to resolve to 0 the outcome is likely a binary event (1 for true, 0 for false.)
    await positionManager.create(toWei('300'), toWei('200'), daoFeePercentage, {
      from: sponsor,
    });
    await tokenCurrency.transfer(tokenHolder, toWei('100'), {
      from: sponsor,
    });

    // Emergency shutdown contract to enable settlement.
    const emergencyShutdownTime = await positionManager.getCurrentTime();
    await synthereumManagerInstance.emergencyShutdown(
      [positionManager.address],
      { from: mainteiner },
    );
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
    await positionManager.settleEmergencyShutdown({ from: tokenHolder });
    let collateralPaid = (await collateral.balanceOf(tokenHolder)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('0'));

    // Settle emergency from the sponsor should give them back all their collateral, as token debt is worth 0.
    initialCollateral = await collateral.balanceOf.call(sponsor);
    await positionManager.settleEmergencyShutdown({ from: sponsor });
    collateralPaid = (await collateral.balanceOf.call(sponsor)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('300'));
  });

  it('Oracle price can resolve less than 0', async function () {
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: tokenHolder,
    });

    // For the price to resolve to 0 the outcome is likely a binary event (1 for true, 0 for false.)
    await positionManager.create(toWei('300'), toWei('200'), daoFeePercentage, {
      from: sponsor,
    });
    await tokenCurrency.transfer(tokenHolder, toWei('100'), {
      from: sponsor,
    });

    // Emergency shutdown contract to enable settlement.
    const emergencyShutdownTime = await positionManager.getCurrentTime();
    await synthereumManagerInstance.emergencyShutdown(
      [positionManager.address],
      { from: mainteiner },
    );
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
    await positionManager.settleEmergencyShutdown({ from: tokenHolder });
    let collateralPaid = (await collateral.balanceOf(tokenHolder)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('0'));

    // Settle emergency from the sponsor should give them back all their collateral, as token debt is worth 0.
    initialCollateral = await collateral.balanceOf.call(sponsor);
    await positionManager.settleEmergencyShutdown({ from: sponsor });
    collateralPaid = (await collateral.balanceOf.call(sponsor)).sub(
      initialCollateral,
    );
    assert.equal(collateralPaid, toWei('300'));
  });

  it('Undercapitalized contract', async function () {
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: '0',
      feeRecipient: daoFeeRecipient,
    });
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: other,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: other,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: tokenHolder,
    });

    // Create one undercapitalized sponsor and one overcollateralized sponsor.
    await positionManager.create(toWei('50'), toWei('100'), daoFeePercentage, {
      from: sponsor,
    });
    await positionManager.create(toWei('150'), toWei('100'), daoFeePercentage, {
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
    const emergencyShutdownTime = await positionManager.getCurrentTime();
    await synthereumManagerInstance.emergencyShutdown(
      [positionManager.address],
      { from: mainteiner },
    );
    // Settle the price to 1, meaning the overcollateralized sponsor has 50 units of excess collateral.
    await mockOracle.pushPrice(
      priceFeedIdentifier,
      emergencyShutdownTime,
      toWei('1'),
    );

    // Token holder is the first to settle -- they should receive the entire value of their tokens (100) because they
    // were first.
    let startingBalance = await collateral.balanceOf.call(tokenHolder);
    await positionManager.settleEmergencyShutdown({
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
    await positionManager.settleEmergencyShutdown({ from: other });
    assert.equal(
      (await collateral.balanceOf.call(other)).toString(),
      startingBalance.add(toBN(toWei('50'))).toString(),
    );

    // The undercapitalized sponsor should get nothing even though they have tokens because the contract has no more collateral.
    startingBalance = await collateral.balanceOf(sponsor);
    await positionManager.settleEmergencyShutdown({ from: sponsor });
    assert.equal(
      (await collateral.balanceOf.call(sponsor)).toString(),
      startingBalance.add(toBN('0')),
    );
    await selfMintingControllerInstance.setDaoFee(positionManager.address, {
      feePercentage: daoFeePercentage.toString(),
      feeRecipient: daoFeeRecipient,
    });
  });

  it('Cannot create position smaller than min sponsor size', async function () {
    // Attempt to create position smaller than 5 wei tokens (the min sponsor position size)
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });

    await truffleAssert.reverts(
      positionManager.create('40', '4', daoFeePercentage, { from: sponsor }),
      'Below minimum sponsor position',
    );
  });

  it('Cannot reduce position size below min sponsor size', async function () {
    // Attempt to redeem a position smaller s.t. the resulting position is less than 5 wei tokens (the min sponsor
    // position size)
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });

    await positionManager.create('40', '20', daoFeePercentage, {
      from: sponsor,
    });

    await truffleAssert.reverts(
      positionManager.redeem('16', daoFeePercentage, { from: sponsor }),
      'Below minimum sponsor position',
    );
  });

  it('Can withdraw excess collateral', async function () {
    // Attempt to redeem a position smaller s.t. the resulting position is less than 5 wei tokens (the min sponsor
    // position size)
    await collateral.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });
    await tokenCurrency.approve(positionManager.address, toWei('100000'), {
      from: sponsor,
    });

    await positionManager.create('40', '20', daoFeePercentage, {
      from: sponsor,
    });

    // Transfer extra collateral in.
    await collateral.transfer(positionManager.address, toWei('10'), {
      from: sponsor,
    });
    let excessCollateral = await positionManager.trimExcess.call(
      collateral.address,
    );
    await positionManager.trimExcess(collateral.address);
    let beneficiaryCollateralBalance = await collateral.balanceOf.call(
      beneficiary,
    );
    assert.equal(excessCollateral.toString(), toWei('10'));
    assert.equal(beneficiaryCollateralBalance.toString(), toWei('10'));
    await collateral.transfer(sponsor, toWei('10'), { from: beneficiary });

    // Transfer extra tokens in.
    await tokenCurrency.transfer(positionManager.address, '10', {
      from: sponsor,
    });
    let excessTokens = await positionManager.trimExcess.call(
      tokenCurrency.address,
    );
    await positionManager.trimExcess(tokenCurrency.address);
    let beneficiaryTokenBalance = await tokenCurrency.balanceOf.call(
      beneficiary,
    );
    assert.equal(excessTokens.toString(), '10');
    assert.equal(beneficiaryTokenBalance.toString(), '10');

    // Redeem still succeeds.
    await tokenCurrency.transfer(sponsor, '10', { from: beneficiary });
    await positionManager.redeem('20', daoFeePercentage, { from: sponsor });
  });

  it('Non-standard ERC20 delimitation', async function () {
    // To test non-standard ERC20 token delimitation a new ERC20 token is created which has 6 decimal points of precision.
    // A new priceless position manager is then created and and set to use this token as collateral. To generate values
    // which represent the appropriate scaling for USDC, .muln(1e6) is used over toWei as the latter scaled by 1e18.

    // Create a test net token with non-standard delimitation like USDC (6 decimals) and mint tokens.
    const USDCToken = await TestnetERC20.new('USDC', 'USDC', 6);
    await addressWhitelistInstance.addToWhitelist(USDCToken.address);
    await USDCToken.allocateTo(sponsor, toWei('100'));

    const nonStandardToken = await SyntheticToken.new(
      syntheticName,
      syntheticSymbol,
      18,
    );

    let newPositionManagerData = positionManagerParams;
    newPositionManagerData.collateralAddress = USDCToken.address;
    newPositionManagerData.tokenAddress = nonStandardToken.address;

    let custompositionManager = await SelfMintingPerpetualPositionManagerMultiParty.new(
      newPositionManagerData,
    );
    await selfMintingControllerInstance.setCapMintAmount(
      custompositionManager.address,
      capMintAmount,
    );
    await selfMintingControllerInstance.setCapDepositRatio(
      custompositionManager.address,
      capDepositRatio,
    );
    await selfMintingControllerInstance.setDaoFee(
      custompositionManager.address,
      {
        feePercentage: daoFeePercentage.toString(),
        feeRecipient: daoFeeRecipient,
      },
    );
    tokenCurrency = await SyntheticToken.at(
      await custompositionManager.tokenCurrency.call(),
    );
    await nonStandardToken.addMinter(custompositionManager.address);
    await nonStandardToken.addBurner(custompositionManager.address);

    // Token currency and collateral have same # of decimals.
    assert.equal((await tokenCurrency.decimals()).toString(), 18);

    // Create the initial custom positionManager position. 100 synthetics backed by 150 collat
    const createTokens = toWei('100').toString();
    // The collateral is delimited by the same number of decimals. 150 * 1e6
    const createCollateral = toBN('150').muln(1000000).toString();
    let expectedSponsorTokens = toBN(createTokens);
    let expectedContractCollateral = toBN(createCollateral);

    await USDCToken.approve(custompositionManager.address, createCollateral, {
      from: sponsor,
    });
    await custompositionManager.create(
      createCollateral,
      createTokens,
      daoFeePercentage,
      { from: sponsor },
    );

    // The balances minted should equal that expected from the create function.
    assert.equal(
      (await USDCToken.balanceOf(custompositionManager.address)).toString(),
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
    await USDCToken.approve(custompositionManager.address, depositCollateral, {
      from: sponsor,
    });
    await custompositionManager.deposit(depositCollateral, { from: sponsor });

    // The balances should reflect the additional collateral added.
    assert.equal(
      (
        await USDCToken.balanceOf.call(custompositionManager.address)
      ).toString(),
      expectedContractCollateral.toString(),
    );
    assert.equal(
      (await tokenCurrency.balanceOf.call(sponsor)).toString(),
      expectedSponsorTokens.toString(),
    );
    assert.equal(
      (await custompositionManager.getCollateral.call(sponsor)).toString(),
      expectedContractCollateral.toString(),
    );
    assert.equal(
      (
        await custompositionManager.positions.call(sponsor)
      ).tokensOutstanding.toString(),
      expectedSponsorTokens.toString(),
    );
    assert.equal(
      (await custompositionManager.totalPositionCollateral()).toString(),
      expectedContractCollateral.toString(),
    );
    assert.equal(
      (
        await custompositionManager.globalPositionData.call()
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
    const emergencyShutdownTime = await positionManager.getCurrentTime.call();
    await synthereumManagerInstance.emergencyShutdown(
      [custompositionManager.address],
      { from: mainteiner },
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
      custompositionManager.address,
      tokenHolderInitialSynthetic,
      {
        from: tokenHolder,
      },
    );

    let settleEmergencyShutdownResult = await custompositionManager.settleEmergencyShutdown(
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
      custompositionManager.address,
      sponsorInitialSynthetic,
      {
        from: sponsor,
      },
    );
    await custompositionManager.settleEmergencyShutdown({ from: sponsor });
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
    const sponsorsPosition = await custompositionManager.positions.call(
      sponsor,
    );
    assert.equal(sponsorsPosition.rawCollateral.rawValue, 0);
    assert.equal(sponsorsPosition.tokensOutstanding.rawValue, 0);
    assert.equal(sponsorsPosition.withdrawalRequestPassTimestamp.toString(), 0);
    assert.equal(sponsorsPosition.withdrawalRequestAmount.rawValue, 0);
  });

  it('Existing void remargin function', async function () {
    await positionManager.remargin();
  });

  it('Can not delete a sponsor position externally', async () => {
    await collateral.approve(
      positionManager.address,
      initialPositionCollateral,
      { from: sponsor },
    );
    await positionManager.create(
      initialPositionCollateral.toString(),
      initialPositionTokens.toString(),
      daoFeePercentage,
      { from: sponsor },
    );
    await truffleAssert.reverts(
      positionManager.deleteSponsorPosition(sponsor, { from: other }),
      'Caller is not this contract',
    );
  });

  it('Revert if overcome deposit limit', async () => {
    await collateral.approve(positionManager.address, toWei('100'), {
      from: sponsor,
    });
    await truffleAssert.reverts(
      positionManager.create(toWei('100'), toWei('10'), daoFeePercentage, {
        from: sponsor,
      }),
      'Position overcomes deposit limit',
    );
    await positionManager.create(toWei('10'), toWei('10'), daoFeePercentage, {
      from: sponsor,
    });
    await truffleAssert.reverts(
      positionManager.repay(toWei('9'), daoFeePercentage, { from: sponsor }),
      'Position overcomes deposit limit',
    );
  });

  it('Revert if overcome mint limit', async () => {
    await selfMintingControllerInstance.setCapMintAmount(
      positionManager.address,
      toWei('90'),
    );
    await collateral.approve(positionManager.address, toWei('100'), {
      from: sponsor,
    });
    await truffleAssert.reverts(
      positionManager.create(toWei('100'), toWei('100'), daoFeePercentage, {
        from: sponsor,
      }),
      'Total amount minted overcomes mint limit',
    );
  });

  it('Calculation of DAO fee', async () => {
    await collateral.approve(positionManager.address, toWei('101'), {
      from: sponsor,
    });
    await positionManager.create(toWei('1'), toWei('0.6'), daoFeePercentage, {
      from: sponsor,
    });
    const tokensAmount = toBN(toWei('50'));
    const feeAmount = await calculateFeeAmount(
      positionManager,
      tokensAmount,
      daoFeePercentage,
    );
    const outputFeeAmount = await positionManager.create.call(
      toWei('100'),
      tokensAmount,
      daoFeePercentage,
      { from: sponsor },
    );
    const feeCalculated = await positionManager.calculateDaoFee.call(
      tokensAmount,
    );
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
    await collateral.approve(positionManager.address, toWei('100'), {
      from: sponsor,
    });
    await truffleAssert.reverts(
      positionManager.create(
        toWei('100'),
        toWei('100'),
        daoFeePercentage.sub(toBN('1')),
        { from: sponsor },
      ),
      'User fees are not enough for paying DAO',
    );
  });
});
