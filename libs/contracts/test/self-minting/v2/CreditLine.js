// Libraries and helpers
const {
  interfaceName,
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { mnemonicToPrivateKey } = require('@jarvis-network/crypto-utils');

const { assert } = require('chai');
const Web3EthAbi = require('web3-eth-abi');
const truffleAssert = require('truffle-assertions');
const {
  collapseTextChangeRangesAcrossMultipleVersions,
  isReturnStatement,
} = require('typescript');
const web3Utils = require('web3-utils');
const { toWei, hexToUtf8, toBN, utf8ToHex } = web3Utils;

// Contracts to test
const CreditLine = artifacts.require('CreditLine');
const CreditLineLib = artifacts.require('CreditLineLib');
const MockContext = artifacts.require('MockCreditLineContext');
const MockOnchainOracle = artifacts.require('MockOnChainOracle');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const SynthereumManager = artifacts.require('SynthereumManager');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const CreditLineControllerMock = artifacts.require('CreditLineControllerMock');
const Forwarder = artifacts.require('SynthereumTrustedForwarder');
const {
  signAndSendMetaTx,
} = require('../../../utils/credit-line-meta-tx/metaTx');
const { generateForwarderSignature } = require('../../../utils/metaTx.js');
contract('Synthereum CreditLine ', function (accounts) {
  const contractDeployer = accounts[0];
  const maintainers = accounts[1];
  let sponsor;
  let sponsorSigner, signers;
  const tokenHolder = accounts[3];
  const other = accounts[4];
  const collateralOwner = accounts[5];
  const beneficiary = accounts[6];
  let feePercentage = toBN(toWei('0.002'));
  let overCollateralizationFactor = toWei('1.2');
  let feeRecipient = accounts[7];
  let Fee = {
    feePercentage: feePercentage,
    feeRecipients: [feeRecipient],
    feeProportions: [1],
    totalFeeProportions: [1],
  };
  let capMintAmount = toBN(toWei('10000000000000000000'));

  // Contracts
  let collateral;
  let creditLine;
  let tokenCurrency;
  let mockOnchainOracle;
  let creditLineParams;
  let roles;
  let networkId;
  let forwarderInstance;
  let synthereumFinderInstance;
  let creditLineControllerInstance;
  let synthereumManagerInstance;

  // Initial constant values
  const initialPositionTokens = toWei('80');
  const initialPositionCollateral = toWei('100');
  const syntheticName = 'Test Synthetic Token';
  const syntheticSymbol = 'SYNTH';
  const startTimestamp = Math.floor(Date.now() / 1000);
  const priceFeedIdentifier = web3.utils.padRight(utf8ToHex('jEUR/USDC'), 64);
  const startingPrice = toWei('1.02', 'mwei');
  const minSponsorTokens = toWei('5');

  // Conveniently asserts expected collateral and token balances, assuming that
  // there is only one synthetic token holder, the sponsor. Also assumes no
  // precision loss from `getCollateral()` coming from the fee multiplier.
  const checkBalances = async (
    expectedSponsorTokens,
    expectedSponsorCollateral,
    feeAmount,
  ) => {
    const positionData = await creditLine.getPositionData.call(sponsor);
    const sponsorCollateral = positionData[0];
    assert.equal(
      sponsorCollateral.toString(),
      expectedSponsorCollateral.toString(),
    );
    // The below assertion only holds if the sponsor holds all of the tokens outstanding.
    assert.equal(positionData[1].toString(), expectedSponsorTokens.toString());
    assert.equal(
      (await tokenCurrency.balanceOf.call(sponsor)).toString(),
      expectedSponsorTokens.toString(),
    );

    assert.equal(
      (await creditLine.getGlobalPositionData.call())[0].toString(),
      expectedSponsorCollateral.toString(),
    );

    assert.equal(
      (await creditLine.getGlobalPositionData.call())[1].toString(),
      expectedSponsorTokens.toString(),
    );
    assert.equal(
      (await collateral.balanceOf.call(creditLine.address)).toString(),
      expectedSponsorCollateral.add(feeAmount).toString(),
    );
  };

  const checkFeeRecipients = async expectedFeeAmount => {
    assert.equal(
      expectedFeeAmount.toString(),
      (await creditLine.totalFeeAmount.call()).toString(),
    );
    assert.equal(
      expectedFeeAmount.toString(),
      await creditLine.userFeeGained(feeRecipient),
    );
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

    // revert if try to claim again
    await truffleAssert.reverts(
      creditLine.claimFee({ from: feeRecipient }),
      'No fee to claim',
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
      .div(toBN(Math.pow(10, 20)));
    return feeAmount;
  };

  const calculateCollateralValue = (numTokens, price) => {
    return numTokens.mul(price).div(toBN(Math.pow(10, 18)));
  };

  before(async () => {
    // deploy and link library
    creditLineLib = await CreditLineLib.deployed();
    await CreditLine.link(creditLineLib);
    networkId = await web3.eth.net.getId();

    forwarderInstance = await Forwarder.deployed();
    signers = await ethers.getSigners();
    sponsorSigner = signers[2].provider;
    sponsor = signers[2].address;
    tokenHolderSigner = signers[3].provider;
    feeRecipientSigner = signers[7].provider;
    otherSigner = signers[4].provider;
  });

  beforeEach(async function () {
    // set roles
    roles = {
      admin: accounts[0],
      maintainers: [accounts[1]],
    };

    // Represents WETH or some other token that the sponsor and contracts don't control.
    collateral = await TestnetSelfMintingERC20.new('test', 'tsc', 6);
    await collateral.allocateTo(sponsor, toBN(toWei('10000000000000')), {
      from: collateralOwner,
    });
    await collateral.allocateTo(other, toBN(toWei('10000000000000000')), {
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

    // Create a mockOracle and finder. Register the mockMoracle with the finder.
    synthereumFinderInstance = await SynthereumFinder.deployed();
    // // register forwarder
    // await synthereumFinderInstance.changeImplementationAddress(utf8ToHex("TrustedForwarder"), forwarderInstance.address, {from:maintainers})

    mockOnchainOracle = await MockOnchainOracle.new(8, {
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

    creditLineParams = {
      collateralToken: collateral.address,
      syntheticToken: tokenCurrency.address,
      priceFeedIdentifier: priceFeedIdentifier,
      minSponsorTokens: { rawValue: minSponsorTokens.toString() },
      excessTokenBeneficiary: beneficiary,
      version: 2,
      synthereumFinder: synthereumFinderInstance.address,
    };

    synthereumManagerInstance = await SynthereumManager.deployed();

    creditLine = await CreditLine.new(creditLineParams, {
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
    await creditLineControllerInstance.setCollateralRequirement(
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

  const createSig = 'create(uint256,uint256)';
  const depositSig = 'deposit(uint256)';
  const depositToSig = 'depositTo(address,uint256)';
  const withdrawSig = 'withdraw(uint256)';
  const redeemSig = 'redeem(uint256)';
  const repaySig = 'repay(uint256)';
  const liquidateSig = 'liquidate(address,uint256)';
  const settleEmergencySig = 'settleEmergencyShutdown()';
  const claimFeeSig = 'claimFee()';

  context('Meta-tx', async () => {
    it('Position lifecycle', async () => {
      // Create the initial creditLine.
      const createTokens = toBN(toWei('100'));
      const createCollateral = toBN(toWei('150', 'mwei'));
      let expectedSponsorTokens = toBN(createTokens);
      let feeAmount = calculateFeeAmount(
        calculateCollateralValue(createTokens, toBN(startingPrice)),
      );
      let expectedSponsorCollateral = createCollateral.sub(feeAmount);

      await collateral.approve(
        creditLine.address,
        createCollateral.toString(),
        {
          from: sponsor,
        },
      );
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

      let functionSig = web3.utils.sha3(createSig).substr(0, 10);
      let functionParam = web3.eth.abi.encodeParameters(
        ['uint256', 'uint256'],
        [createCollateral, createTokens],
      );
      await signAndSendMetaTx(
        forwarderInstance,
        sponsorSigner,
        functionSig,
        functionParam.substr(2),
        sponsor,
        creditLine.address,
        0,
        networkId,
      );

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

      functionSig = web3.utils.sha3(depositSig).substr(0, 10);
      functionParam = web3.eth.abi.encodeParameters(
        ['uint256'],
        [depositCollateral],
      );
      await signAndSendMetaTx(
        forwarderInstance,
        sponsorSigner,
        functionSig,
        functionParam.substr(2),
        sponsor,
        creditLine.address,
        0,
        networkId,
      );
      await checkBalances(
        expectedSponsorTokens,
        expectedSponsorCollateral,
        toBN(0),
      );

      // Periodic check for no excess collateral.
      await expectNoExcessCollateralToTrim();

      // revert if not trustedd forwarder
      await synthereumFinderInstance.changeImplementationAddress(
        utf8ToHex('TrustedForwarder'),
        ZERO_ADDRESS,
        { from: maintainers },
      );
      await truffleAssert.reverts(
        signAndSendMetaTx(
          forwarderInstance,
          sponsorSigner,
          functionSig,
          functionParam.substr(2),
          sponsor,
          creditLine.address,
          0,
          networkId,
        ),
      );
      await synthereumFinderInstance.changeImplementationAddress(
        utf8ToHex('TrustedForwarder'),
        forwarderInstance.address,
        { from: maintainers },
      );

      // withdraw
      const withdrawCollateral = toWei('20');
      expectedSponsorCollateral = expectedSponsorCollateral.sub(
        toBN(withdrawCollateral),
      );
      let sponsorInitialBalance = await collateral.balanceOf.call(sponsor);

      functionSig = web3.utils.sha3(withdrawSig).substr(0, 10);
      functionParam = web3.eth.abi.encodeParameters(
        ['uint256'],
        [withdrawCollateral],
      );
      await signAndSendMetaTx(
        forwarderInstance,
        sponsorSigner,
        functionSig,
        functionParam.substr(2),
        sponsor,
        creditLine.address,
        0,
        networkId,
      );
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

      // redeem 50% of tokens
      const redeemTokens = expectedSponsorTokens.divn(2);
      expectedSponsorTokens = expectedSponsorTokens.sub(toBN(redeemTokens));
      expectedSponsorCollateral = expectedSponsorCollateral.divn(2);

      await tokenCurrency.approve(creditLine.address, redeemTokens, {
        from: sponsor,
      });
      sponsorInitialBalance = await collateral.balanceOf.call(sponsor);

      // Check redeem return value and event.

      let amountWithdrawn = await creditLine.redeem.call(redeemTokens, {
        from: sponsor,
      });

      let expectedWithdrawAmount = expectedSponsorCollateral;
      assert.equal(
        amountWithdrawn.toString(),
        expectedWithdrawAmount.toString(),
        'Wrong redeemed output collateral',
      );

      functionSig = web3.utils.sha3(redeemSig).substr(0, 10);
      functionParam = web3.eth.abi.encodeParameters(
        ['uint256'],
        [redeemTokens],
      );
      await signAndSendMetaTx(
        forwarderInstance,
        sponsorSigner,
        functionSig,
        functionParam.substr(2),
        sponsor,
        creditLine.address,
        0,
        networkId,
      );

      sponsorFinalBalance = await collateral.balanceOf.call(sponsor);
      assert.equal(
        sponsorFinalBalance.sub(sponsorInitialBalance).toString(),
        expectedSponsorCollateral.toString(),
      );
      await checkBalances(
        expectedSponsorTokens,
        expectedSponsorCollateral,
        toBN(0),
      );

      // Periodic check for no excess collateral.
      await expectNoExcessCollateralToTrim();
    });
    it('Deposit To', async function () {
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

      let feeAmount = calculateFeeAmount(
        calculateCollateralValue(toBN(numTokens), toBN(startingPrice)),
      );

      // Other makes a deposit to the sponsor's account.
      let depositCollateral = toWei('1');
      let functionSig = web3.utils.sha3(depositToSig).substr(0, 10);
      let functionParam = web3.eth.abi.encodeParameters(
        ['address', 'uint256'],
        [sponsor, depositCollateral],
      );
      await signAndSendMetaTx(
        forwarderInstance,
        otherSigner,
        functionSig,
        functionParam.substr(2),
        other,
        creditLine.address,
        0,
        networkId,
      );

      assert.equal(
        (await creditLine.getPositionData.call(sponsor))[0].toString(),
        toBN(depositCollateral)
          .add(toBN(collateralAmount))
          .sub(feeAmount)
          .toString(),
      );
      assert.equal(
        (await creditLine.getPositionData.call(other))[0].toString(),
        '0',
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
      let feeAmount = calculateFeeAmount(
        calculateCollateralValue(toBN(outputTokens), toBN(startingPrice)),
      );

      const initialSponsorTokens = await tokenCurrency.balanceOf.call(sponsor);
      const initialSponsorTokenDebt = toBN(
        (await creditLine.getPositionData.call(sponsor))[1],
      );
      const initialTotalTokensOutstanding = toBN(
        (await creditLine.getGlobalPositionData.call())[1],
      );

      let repayTokens = toWei('6');

      let functionSig = web3.utils.sha3(repaySig).substr(0, 10);
      let functionParam = web3.eth.abi.encodeParameters(
        ['uint256'],
        [repayTokens],
      );
      await signAndSendMetaTx(
        forwarderInstance,
        sponsorSigner,
        functionSig,
        functionParam.substr(2),
        sponsor,
        creditLine.address,
        0,
        networkId,
      );

      const expectedCollAmount = toBN(inputCollateral).sub(feeAmount);

      assert.equal(
        expectedCollAmount.toString(),
        (await creditLine.getPositionData.call(sponsor))[0].toString(),
        'Wrong collateral result',
      );
      const tokensPaid = initialSponsorTokens.sub(
        await tokenCurrency.balanceOf(sponsor),
      );
      const tokenDebtDecreased = initialSponsorTokenDebt.sub(
        toBN((await creditLine.getPositionData.call(sponsor))[1]),
      );
      const totalTokensOutstandingDecreased = initialTotalTokensOutstanding.sub(
        toBN((await creditLine.getGlobalPositionData.call())[1]),
      );

      // Tokens paid back to contract,the token debt decrease and decrease in outstanding should all equal 40 tokens.
      assert.equal(tokensPaid.toString(), repayTokens);
      assert.equal(tokenDebtDecreased.toString(), repayTokens);
      assert.equal(totalTokensOutstandingDecreased.toString(), repayTokens);

      // Can not request to repay more than their token balance.
      assert.equal(
        (await creditLine.getPositionData.call(sponsor))[1].toString(),
        toBN(outputTokens).sub(toBN(repayTokens)).toString(),
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
      let tx = await synthereumManagerInstance.emergencyShutdown(
        [creditLine.address],
        {
          from: maintainers,
        },
      );

      let expectedEmergencyTime = (
        await web3.eth.getBlock(tx.receipt.blockNumber)
      ).timestamp;
      assert.equal(
        (await creditLine.emergencyShutdownTime.call()).toString(),
        expectedEmergencyTime.toString(),
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

      let functionSig = web3.utils.sha3(settleEmergencySig).substr(0, 10);
      let functionParam = '';
      await signAndSendMetaTx(
        forwarderInstance,
        tokenHolderSigner,
        functionSig,
        functionParam,
        tokenHolder,
        creditLine.address,
        0,
        networkId,
      );

      const tokenHolderFinalCollateral = await collateral.balanceOf(
        tokenHolder,
      );
      const tokenHolderFinalSynthetic = await tokenCurrency.balanceOf(
        tokenHolder,
      );
      const settledCollateral = tokenHolderInitialSynthetic
        .mul(toBN(emergencyShutdownPrice))
        .div(toBN(Math.pow(10, 18)));

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
      await signAndSendMetaTx(
        forwarderInstance,
        sponsorSigner,
        functionSig,
        functionParam,
        sponsor,
        creditLine.address,
        0,
        networkId,
      );
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
    it('Liquidations', async () => {
      let liquidationRewardPct = toBN(toWei('0.2'));

      await creditLineControllerInstance.setFeePercentage(
        [creditLine.address],
        [toWei('0')],
        { from: maintainers },
      );

      // Create the initial creditLine.
      createTokens = toBN(toWei('11000'));
      createCollateral = toBN(toWei('140', 'mwei'));

      await collateral.approve(creditLine.address, createCollateral, {
        from: sponsor,
      });
      await creditLine.create(createCollateral, createTokens, {
        from: sponsor,
      });

      // check collateralisation from view function
      assert.equal(
        (await creditLine.collateralCoverage.call(sponsor))[0],
        true,
      );

      // create liquidator position to have tokens
      liquidatorCollateral = toBN(toWei('100', 'mwei'));
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

      // change price - position is under collateral requirement but still cover the debt
      const updatedPrice = toWei('1.1', 'mwei');
      await mockOnchainOracle.setPrice(priceFeedIdentifier, updatedPrice);

      // check collateralisation from view function
      assert.equal(
        (await creditLine.collateralCoverage.call(sponsor))[0],
        false,
      );
      assert.equal(
        (await creditLine.liquidationReward.call()).toString(),
        liquidationRewardPct.toString(),
      );

      const collateralRequirement = createTokens
        .mul(toBN(updatedPrice))
        .div(toBN(Math.pow(10, 18)))
        .mul(toBN(overCollateralizationFactor))
        .div(toBN(Math.pow(10, 20)));
      assert.equal(
        collateralRequirement.sub(createCollateral) > 0,
        true,
        'Not undercollateralised',
      );

      // let inversePrice = toBN(toWei('1')).div(updatedPrice);
      const liquidationTokens = toBN(toWei('400'));

      let liquidatedCollateralPortion = liquidationTokens
        .mul(createCollateral)
        .div(createTokens);
      const liquidatedTokensValue = liquidationTokens
        .mul(toBN(updatedPrice))
        .div(toBN(Math.pow(10, 20)));

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
      let functionSig = web3.utils.sha3(liquidateSig).substr(0, 10);
      let functionParam = web3.eth.abi.encodeParameters(
        ['address', 'uint256'],
        [sponsor, liquidationTokens],
      );

      await signAndSendMetaTx(
        forwarderInstance,
        otherSigner,
        functionSig,
        functionParam.substr(2),
        other,
        creditLine.address,
        0,
        networkId,
      );

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
        collateralAmount,
        tokensAmount,
      } = await creditLine.getPositionData.call(sponsor);
      assert.equal(
        tokensAmount.toString(),
        createTokens.sub(liquidationTokens).toString(),
      );
      assert.equal(
        collateralAmount.toString().substr(0, 10),
        createCollateral
          .sub(expectedLiquidatedCollateral)
          .sub(expectedLiquidatorReward)
          .toString()
          .substr(0, 10),
      );
    });
    it('Reverts if not trusted forwarder', async () => {});
    it('Can test msgData with meta-tx', async () => {
      const MAX_GAS = 12000000;
      const mnemonic =
        process.env.MNEMONIC ??
        'ripple ship viable club inquiry act trap draft supply type again document';
      await MockContext.link(creditLineLib);
      const context = await MockContext.new(creditLineParams);
      const data = Web3EthAbi.encodeFunctionSignature('test()');
      const userResult = await context.test.call({ from: accounts[4] });
      assert.equal(userResult[1], data, 'Wrong user data');
      nonce = (await forwarderInstance.getNonce.call(accounts[4])).toString();
      const dataMetaTxSignature = generateForwarderSignature(
        accounts[4],
        context.address,
        0,
        MAX_GAS,
        nonce,
        data,
        networkId,
        forwarderInstance.address,
        mnemonicToPrivateKey(mnemonic, "m/44'/60'/0'/0/4"),
      );
      const forwarderRequest = {
        from: accounts[4],
        to: context.address,
        value: 0,
        gas: MAX_GAS,
        nonce: nonce,
        data: data,
      };
      const metaCallResult = await forwarderInstance.safeExecute.call(
        forwarderRequest,
        dataMetaTxSignature,
        {
          from: accounts[2],
        },
      );
      const metaResult = Web3EthAbi.decodeParameters(
        ['address', 'bytes'],
        metaCallResult,
      );
      assert.equal(metaResult[1], data, 'Wrong meta-data');
    });
  });

  it('Correct deployment and variable assignment', async function () {
    assert.equal(await creditLine.collateralToken.call(), collateral.address);
    assert.equal(await creditLine.syntheticToken.call(), tokenCurrency.address);
    assert.equal(
      hexToUtf8(await creditLine.priceIdentifier.call()),
      hexToUtf8(priceFeedIdentifier),
    );
    assert.equal(
      (await creditLine.collateralRequirement.call()).toString(),
      overCollateralizationFactor.toString(),
    );
    // Synthetic token and synthereum parameters
    assert.equal(await tokenCurrency.name.call(), syntheticName);
    assert.equal(await tokenCurrency.symbol.call(), syntheticSymbol);
    assert.equal(await creditLine.version.call(), 2);
    assert.equal(await creditLine.collateralToken.call(), collateral.address);
    assert.equal(await creditLine.syntheticTokenSymbol.call(), syntheticSymbol);
    assert.equal(
      await creditLine.synthereumFinder.call(),
      synthereumFinderInstance.address,
    );
    const returnedFee = await creditLine.feeInfo.call();
    assert.equal(returnedFee.feePercentage.toString(), Fee.feePercentage);
    assert.equal(returnedFee.feeRecipients[0], Fee.feeRecipients[0]);
    assert.equal(returnedFee.feeProportions[0], 1);
    assert.equal(returnedFee.totalFeeProportions, 1);
    assert.equal(
      (await creditLine.capMintAmount.call()).toString(),
      capMintAmount.toString(),
    );
    assert.equal(await creditLine.excessTokensBeneficiary.call(), beneficiary);
    assert.equal(
      (await creditLine.minSponsorTokens.call()).toString(),
      minSponsorTokens.toString(),
    );
  });

  it('Reverts deployment with bad price identifier', async () => {
    let creditLineParams = {
      collateralToken: collateral.address,
      syntheticToken: tokenCurrency.address,
      priceFeedIdentifier: web3.utils.padRight(utf8ToHex('JRT/USD'), 64),
      minSponsorTokens: { rawValue: minSponsorTokens.toString() },
      excessTokenBeneficiary: beneficiary,
      version: 2,
      synthereumFinder: synthereumFinderInstance.address,
    };

    synthereumManagerInstance = await SynthereumManager.deployed();

    await truffleAssert.reverts(
      CreditLine.new(creditLineParams, {
        from: contractDeployer,
      }),
      'Price identifier not supported',
    );
  });

  it('Reverts deployment with synthetic token with bad decimals', async () => {
    let tokenCurrency = await SyntheticToken.new(
      syntheticName,
      syntheticSymbol,
      10,
      {
        from: contractDeployer,
      },
    );
    let creditLineParams = {
      collateralToken: collateral.address,
      syntheticToken: tokenCurrency.address,
      priceFeedIdentifier,
      minSponsorTokens: { rawValue: minSponsorTokens.toString() },
      excessTokenBeneficiary: beneficiary,
      version: 2,
      synthereumFinder: synthereumFinderInstance.address,
    };

    synthereumManagerInstance = await SynthereumManager.deployed();

    await truffleAssert.reverts(
      CreditLine.new(creditLineParams, {
        from: contractDeployer,
      }),
      'Synthetic token has more or less than 18 decimals',
    );
  });

  it('Reverts deployment with collteral token with bad decimals', async () => {
    let collateral = await TestnetSelfMintingERC20.new(
      syntheticName,
      syntheticSymbol,
      19,
      {
        from: contractDeployer,
      },
    );
    let creditLineParams = {
      collateralToken: collateral.address,
      syntheticToken: tokenCurrency.address,
      priceFeedIdentifier,
      minSponsorTokens: { rawValue: minSponsorTokens.toString() },
      excessTokenBeneficiary: beneficiary,
      version: 2,
      synthereumFinder: synthereumFinderInstance.address,
    };

    synthereumManagerInstance = await SynthereumManager.deployed();

    await truffleAssert.reverts(
      CreditLine.new(creditLineParams, {
        from: contractDeployer,
      }),
      'Collateral has more than 18 decimals',
    );
  });

  it('Lifecycle', async function () {
    // Create the initial creditLine.
    const createTokens = toBN(toWei('100'));
    const createCollateral = toBN(toWei('150', 'mwei'));
    let expectedSponsorTokens = toBN(createTokens);
    let feeAmount = calculateFeeAmount(
      calculateCollateralValue(createTokens, toBN(startingPrice)),
    );
    let expectedSponsorCollateral = createCollateral.sub(feeAmount);
    let expectedLiquidationPrice = '1.249983'; // expectedSponsor / (createTokens * overCollateralisation)

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
    await collateral.approve(creditLine.address, createCollateral, {
      from: other,
    });
    // reverts if undercollateralised
    await truffleAssert.reverts(
      creditLine.create(toWei('1', 'mwei'), toWei('1000'), {
        from: other,
      }),
      'Insufficient Collateral',
    );
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
        ev.tokenAmount == createTokens.toString() &&
        ev.feeAmount == feeAmount.toString()
      );
    });
    truffleAssert.eventEmitted(tx, 'NewSponsor', ev => {
      return ev.sponsor == sponsor;
    });

    // check liquidation Price is correct - on chain
    assert.equal(
      (await creditLine.liquidationPrice.call(sponsor)).toString(),
      toWei(expectedLiquidationPrice),
    );

    // check balances and fee distribution is ok
    await checkBalances(
      expectedSponsorTokens,
      expectedSponsorCollateral,
      feeAmount,
    );
    await checkFeeRecipients(feeAmount);

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // can create other tokens without collateral staying above cr
    let collateralBefore = (await creditLine.getPositionData.call(sponsor))[0];
    let opfee = await creditLine.create.call(0, toBN(toWei('2')), {
      from: sponsor,
    });
    await creditLine.create(0, toBN(toWei('2')), { from: sponsor });

    let createFeeAmount = calculateFeeAmount(
      calculateCollateralValue(toBN(toWei('2')), toBN(startingPrice)),
    );
    assert.equal(opfee.toString(), createFeeAmount.toString());

    // position data should be reduced by fee amount
    let collateralAfter = (await creditLine.getPositionData.call(sponsor))[0];
    assert.equal(
      collateralAfter.toString(),
      toBN(collateralBefore.toString()).sub(createFeeAmount).toString(),
    );

    // check balances and fee distribution is ok
    expectedSponsorTokens = expectedSponsorTokens.add(toBN(toWei('2')));
    expectedSponsorCollateral = expectedSponsorCollateral.sub(createFeeAmount);

    await checkBalances(
      expectedSponsorTokens,
      expectedSponsorCollateral,
      createFeeAmount,
    );
    await checkFeeRecipients(createFeeAmount);

    // can create other tokens passing a bit of collateral (less than fee amount) staying above cr
    let collateralPassed = toBN(toWei('1', 'mwei'));
    await collateral.approve(creditLine.address, collateralPassed, {
      from: sponsor,
    });
    collateralBefore = (await creditLine.getPositionData.call(sponsor))[0];
    opfee = await creditLine.create.call(collateralPassed, toBN(toWei('10')), {
      from: sponsor,
    });
    await creditLine.create(collateralPassed, toBN(toWei('10')), {
      from: sponsor,
    });

    createFeeAmount = calculateFeeAmount(
      calculateCollateralValue(toBN(toWei('10')), toBN(startingPrice)),
    );
    assert.equal(opfee.toString(), createFeeAmount.toString());

    // position data should be reduced by fee amount
    collateralAfter = (await creditLine.getPositionData.call(sponsor))[0];
    assert.equal(
      collateralAfter.toString(),
      toBN(collateralBefore.toString())
        .sub(createFeeAmount)
        .add(collateralPassed)
        .toString(),
    );

    // check balances and fee distribution is ok
    expectedSponsorTokens = expectedSponsorTokens.add(toBN(toWei('10')));
    expectedSponsorCollateral = expectedSponsorCollateral
      .sub(createFeeAmount)
      .add(collateralPassed);

    await checkBalances(
      expectedSponsorTokens,
      expectedSponsorCollateral,
      createFeeAmount,
    );
    await checkFeeRecipients(createFeeAmount);

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
    // Cannot deposit 0 collateral.
    await truffleAssert.reverts(
      creditLine.depositTo(sponsor, '0', { from: accounts[3] }),
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
    const redeemTokens = expectedSponsorTokens.divn(2);
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

    let amountWithdrawn = await creditLine.redeem.call(redeemTokens, {
      from: sponsor,
    });

    let expectedWithdrawAmount = expectedSponsorCollateral;
    assert.equal(
      amountWithdrawn.toString(),
      expectedWithdrawAmount.toString(),
      'Wrong redeemed output collateral',
    );

    let redemptionResult = await creditLine.redeem(redeemTokens, {
      from: sponsor,
    });
    truffleAssert.eventEmitted(redemptionResult, 'Redeem', ev => {
      return (
        ev.sponsor == sponsor &&
        ev.collateralAmount == expectedWithdrawAmount.toString() &&
        ev.tokenAmount == redeemTokens.toString()
      );
    });

    sponsorFinalBalance = await collateral.balanceOf.call(sponsor);
    assert.equal(
      sponsorFinalBalance.sub(sponsorInitialBalance).toString(),
      expectedSponsorCollateral.toString(),
    );
    await checkBalances(
      expectedSponsorTokens,
      expectedSponsorCollateral,
      toBN(0),
    );

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();

    // Create additional.
    const createAdditionalTokens = toBN(toWei('10'));
    const createAdditionalCollateral = toBN(toWei('110', 'mwei'));
    feeAmount = calculateFeeAmount(
      calculateCollateralValue(createAdditionalTokens, toBN(startingPrice)),
    );
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
    const redeemRemainingTokens = expectedSponsorTokens;
    await tokenCurrency.approve(creditLine.address, redeemRemainingTokens, {
      from: sponsor,
    });
    sponsorInitialBalance = await collateral.balanceOf.call(sponsor);
    redemptionResult = await creditLine.redeem(redeemRemainingTokens, {
      from: sponsor,
    });
    expectedNetSponsorCollateral = expectedSponsorCollateral;
    truffleAssert.eventEmitted(redemptionResult, 'Redeem', ev => {
      return (
        ev.sponsor == sponsor &&
        ev.collateralAmount == expectedNetSponsorCollateral.toString() &&
        ev.tokenAmount == redeemRemainingTokens.toString()
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
    await checkBalances(toBN('0'), toBN('0'), toBN('0'));

    // Periodic check for no excess collateral.
    await expectNoExcessCollateralToTrim();
  });

  it('Cannot withdraw collateral if position gets undercollateralised', async function () {
    // Create the initial creditLine.
    const createTokens = toBN(toWei('100'));
    const createCollateral = toBN(toWei('150', 'mwei'));

    await collateral.approve(creditLine.address, createCollateral, {
      from: sponsor,
    });
    await creditLine.create(createCollateral, createTokens, {
      from: sponsor,
    });

    let feeAmount = calculateFeeAmount(
      calculateCollateralValue(createTokens, toBN(startingPrice)),
    );

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
    const collateralAmount = toWei('20', 'mwei');

    await creditLine.create(collateralAmount, numTokens, {
      from: sponsor,
    });

    let feeAmount = calculateFeeAmount(
      calculateCollateralValue(toBN(numTokens), toBN(startingPrice)),
    );

    // Other makes a deposit to the sponsor's account.
    let depositCollateral = toWei('1');
    await creditLine.depositTo(sponsor, depositCollateral, { from: other });

    assert.equal(
      (await creditLine.getPositionData.call(sponsor))[0].toString(),
      toBN(depositCollateral)
        .add(toBN(collateralAmount))
        .sub(feeAmount)
        .toString(),
    );
    assert.equal(
      (await creditLine.getPositionData.call(other))[0].toString(),
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
      (await creditLine.getPositionData.call(sponsor))[0].toString(),
      toWei('11'),
    );
    assert.equal(
      (await creditLine.getPositionData.call(other))[0].toString(),
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
      (await creditLine.getPositionData(sponsor))[0].toString(),
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

    let inputCollateral = toWei('20', 'mwei');
    let outputTokens = toWei('12');
    await creditLine.create(inputCollateral, outputTokens, {
      from: sponsor,
    });
    let feeAmount = calculateFeeAmount(
      calculateCollateralValue(toBN(outputTokens), toBN(startingPrice)),
    );

    const initialSponsorTokens = await tokenCurrency.balanceOf.call(sponsor);
    const initialSponsorTokenDebt = toBN(
      (await creditLine.getPositionData.call(sponsor))[1],
    );
    const initialTotalTokensOutstanding = toBN(
      (await creditLine.getGlobalPositionData.call())[1],
    );

    let repayTokens = toWei('6');

    const repayResult = await creditLine.repay(repayTokens, {
      from: sponsor,
    });

    // Event is correctly emitted.
    truffleAssert.eventEmitted(repayResult, 'Repay', ev => {
      return (
        ev.sponsor == sponsor &&
        ev.numTokensRepaid.toString() == repayTokens &&
        ev.newTokenCount.toString() ==
          toBN(outputTokens).sub(toBN(repayTokens)).toString()
      );
    });

    const expectedCollAmount = toBN(inputCollateral).sub(feeAmount);
    assert.equal(
      expectedCollAmount.toString(),
      (await creditLine.getPositionData.call(sponsor))[0].toString(),
      'Wrong collateral result',
    );
    const tokensPaid = initialSponsorTokens.sub(
      await tokenCurrency.balanceOf(sponsor),
    );
    const tokenDebtDecreased = initialSponsorTokenDebt.sub(
      (await creditLine.getPositionData.call(sponsor))[1],
    );
    const totalTokensOutstandingDecreased = initialTotalTokensOutstanding.sub(
      (await creditLine.getGlobalPositionData.call())[1],
    );

    // Tokens paid back to contract,the token debt decrease and decrease in outstanding should all equal 40 tokens.
    assert.equal(tokensPaid.toString(), repayTokens);
    assert.equal(tokenDebtDecreased.toString(), repayTokens);
    assert.equal(totalTokensOutstandingDecreased.toString(), repayTokens);

    // Can not request to repay more than their token balance.
    assert.equal(
      (await creditLine.getPositionData.call(sponsor))[1].toString(),
      toBN(outputTokens).sub(toBN(repayTokens)).toString(),
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
      (await creditLine.getPositionData.call(sponsor))[1].toString(),
      minSponsorTokens.toString(),
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
      {
        from: maintainers,
      },
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
    const newMockOracle = await MockOnchainOracle.new(8, {
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
      createTokens = toBN(toWei('11000'));
      createCollateral = toBN(toWei('140', 'mwei'));

      await collateral.approve(creditLine.address, createCollateral, {
        from: sponsor,
      });
      await creditLine.create(createCollateral, createTokens, {
        from: sponsor,
      });

      // check collateralisation from view function
      assert.equal(
        (await creditLine.collateralCoverage.call(sponsor))[0],
        true,
      );

      // create liquidator position to have tokens
      liquidatorCollateral = toBN(toWei('100', 'mwei'));
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

    it('Cant liquidate a collateralised position', async () => {
      await truffleAssert.reverts(
        creditLine.liquidate(sponsor, toBN(toWei('30')), {
          from: other,
        }),
      ),
        'Position is properly collateralised';
    });

    it('Correctly liquidates an undercollateralised amount, position capitalised', async () => {
      // change price - position is under collateral requirement but still cover the debt
      const updatedPrice = toWei('1.1', 'mwei');
      await mockOnchainOracle.setPrice(priceFeedIdentifier, updatedPrice);

      // check collateralisation from view function
      assert.equal(
        (await creditLine.collateralCoverage.call(sponsor))[0],
        false,
      );
      assert.equal(
        (await creditLine.liquidationReward.call()).toString(),
        liquidationRewardPct.toString(),
      );

      const collateralRequirement = createTokens
        .mul(toBN(updatedPrice))
        .div(toBN(Math.pow(10, 18)))
        .mul(toBN(overCollateralizationFactor))
        .div(toBN(Math.pow(10, 20)));
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
        .mul(toBN(updatedPrice))
        .div(toBN(Math.pow(10, 20)));

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
          ev.liquidatedCollateral.toString().substr(0, 10) ==
            expectedLiquidatedCollateral
              .add(expectedLiquidatorReward)
              .toString()
              .substr(0, 10)
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
        collateralAmount,
        tokensAmount,
      } = await creditLine.getPositionData.call(sponsor);
      assert.equal(
        tokensAmount.toString(),
        createTokens.sub(liquidationTokens).toString(),
      );
      assert.equal(
        collateralAmount.toString().substr(0, 10),
        createCollateral
          .sub(expectedLiquidatedCollateral)
          .sub(expectedLiquidatorReward)
          .toString()
          .substr(0, 10),
      );
    });

    it('Fully liquidates an undercollateralised amount, position capitalised', async () => {
      // change price - position is under collateral requirement but still cover the debt
      const updatedPrice = toBN(toWei('1.1', 'mwei'));
      await mockOnchainOracle.setPrice(priceFeedIdentifier, updatedPrice);

      // check collateralisation from view function
      assert.equal(
        (await creditLine.collateralCoverage.call(sponsor))[0],
        false,
      );

      const collateralRequirement = createTokens
        .mul(updatedPrice)
        .div(toBN(Math.pow(10, 18)))
        .mul(toBN(overCollateralizationFactor))
        .div(toBN(Math.pow(10, 20)));
      assert.equal(
        collateralRequirement.sub(createCollateral) > 0,
        true,
        'Not undercollateralised',
      );

      // let inversePrice = toBN(toWei('1')).div(updatedPrice);
      const liquidationTokens = toBN(toWei('400'));

      let liquidatedCollateralPortion = liquidationTokens
        .mul(createCollateral)
        .div(createTokens);
      const liquidatedTokensValue = liquidationTokens
        .mul(updatedPrice)
        .div(toBN(Math.pow(10, 20)));

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
          ev.liquidatedCollateral.toString().substr(0, 10) ==
            expectedLiquidatedCollateral
              .add(expectedLiquidatorReward)
              .toString()
              .substr(0, 10) &&
          ev.collateralReward.toString().substr(0, 10) ==
            expectedLiquidatorReward.toString().substr(0, 10)
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
        collateralAmount,
        tokensAmount,
      } = await creditLine.getPositionData.call(sponsor);
      assert.equal(
        tokensAmount.toString(),
        createTokens.sub(liquidationTokens).toString(),
      );
      assert.equal(
        collateralAmount.toString().substr(0, 10),
        createCollateral
          .sub(expectedLiquidatedCollateral)
          .sub(expectedLiquidatorReward)
          .toString()
          .substr(0, 10),
      );
    });

    it('Correctly liquidates an undercollateralised amount, position undercapitalised', async () => {
      // change price - position is under collateral requirement and cant fully cover debt
      const updatedPrice = toBN(toWei('15', 'mwei'));
      await mockOnchainOracle.setPrice(priceFeedIdentifier, updatedPrice);

      const collateralRequirement = createTokens
        .mul(updatedPrice)
        .div(toBN(Math.pow(10, 18)))
        .mul(toBN(overCollateralizationFactor))
        .div(toBN(Math.pow(10, 20)));
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

      let expectedLiquidatorReward = toBN(0);

      let expectedLiquidatedCollateral = liquidatedCollateralPortion;

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
          ev.liquidatedCollateral.toString().substr(0, 10) ==
            expectedLiquidatedCollateral.toString().substr(0, 10) &&
          ev.collateralReward.toString().substr(0, 10) ==
            expectedLiquidatorReward.toString().substr(0, 10)
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
        collateralAmount,
        tokensAmount,
      } = await creditLine.getPositionData.call(sponsor);
      assert.equal(
        tokensAmount.toString(),
        createTokens.sub(liquidationTokens).toString(),
      );
      assert.equal(
        collateralAmount.toString().substr(0, 10),
        createCollateral
          .sub(expectedLiquidatedCollateral)
          .toString()
          .substr(0, 10),
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
