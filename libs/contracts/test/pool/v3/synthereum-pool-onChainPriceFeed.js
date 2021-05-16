//helper scripts
const { interfaceName } = require('@jarvis-network/uma-common');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
} = require('../../../utils/encoding.js');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumManager = artifacts.require('SynthereumManager');
const TestnetERC20 = artifacts.require('TestnetERC20');
const ChainlinkPriceFeed = artifacts.require('SynthereumChainlinkPriceFeed');
const SynthereumPoolOnChainPriceFeed = artifacts.require(
  'SynthereumPoolOnChainPriceFeed',
);
const MintableBurnableERC20 = artifacts.require('MintableBurnableERC20');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
const SynthereumPoolOnChainPriceFeedLib = artifacts.require(
  'SynthereumPoolOnChainPriceFeedLib',
);
const Derivative = artifacts.require('PerpetualPoolParty');
const Timer = artifacts.require('Timer');
const MockOracle = artifacts.require('MockOracle');
const ContractAllowed = artifacts.require('ContractAllowedOnChanPriceFeed');
const UmaFinder = artifacts.require('Finder');
const MockV3Aggregator = artifacts.require('MockV3Aggregator');

contract('Synthereum pool with on chain price feed', function (accounts) {
  let derivativeVersion = 2;

  // Derivative params
  let collateralAddress;
  let priceFeedIdentifier = 'EUR/USD';
  let secondPriceFeedIdentifier = 'GBP/USD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let secondSyntheticName = 'Jarvis Synthetic British Pound';
  let syntheticSymbol = 'jEUR';
  let secondSyntheticSymbol = 'jGBP';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let collateralRequirement = web3Utils.toWei('1.1');
  let disputeBondPct = web3Utils.toWei('0.05');
  let sponsorDisputeRewardPct = web3Utils.toWei('0.5');
  let disputerDisputeRewardPct = web3Utils.toWei('0.2');
  let minSponsorTokens = web3Utils.toWei('0');
  let withdrawalLiveness = 7200;
  let liquidationLiveness = 7200;
  let excessBeneficiary = accounts[4];
  let derivativeAdmins;
  let derivativePools;

  //Pool params
  let derivativeAddress = ZERO_ADDRESS;
  let synthereumFinderAddress;
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
  };
  let isContractAllowed = false;
  let startingCollateralization = '1500000';
  let secondStartingCollateralization = '1700000';
  let feePercentage = '0.002';
  let feePercentageWei;
  let DAO = accounts[5];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  //Addresses
  let poolAddress;
  let synthTokenAddr;
  //Other params
  let sender = accounts[6];
  let secondSender = accounts[7];
  let wrongSender = accounts[8];
  let wrongDerivativeAddr = accounts[9];
  let newAdmin = accounts[10];
  let derivativePayload;
  let poolPayload;
  let collateralInstance;
  let poolStartingDeposit = web3Utils.toWei('1000', 'mwei');
  let poolInstance;
  let derivativeInstance;
  let synthTokenInstance;
  let timerInstance;
  let managerInstance;
  let adminRole;
  let minterRole;
  let burnerRole;
  let aggregatorInstance;
  //We suppose a starting rate of 1 jEur = 1.2 USDC (EUR/USD = 1.2)
  let collateralAmount;
  let feeAmount;
  let numTokens;
  let networkId;
  let version;
  let expiration;

  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 3;
    feePercentageWei = web3Utils.toWei(feePercentage);
    synthereumFinderAddress = (await SynthereumFinder.deployed()).address;
    derivativePayload = encodeDerivative(
      collateralAddress,
      priceFeedIdentifier,
      syntheticName,
      syntheticSymbol,
      syntheticTokenAddress,
      collateralRequirement,
      disputeBondPct,
      sponsorDisputeRewardPct,
      disputerDisputeRewardPct,
      minSponsorTokens,
      withdrawalLiveness,
      liquidationLiveness,
      excessBeneficiary,
      derivativeAdmins,
      derivativePools,
    );
    poolPayload = encodePoolOnChainPriceFeed(
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      roles,
      isContractAllowed,
      startingCollateralization,
      fee,
    );
    const addresses = await deployerInstance.deployPoolAndDerivative.call(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    poolAddress = addresses.pool;
    derivativeAddress = addresses.derivative;
    await deployerInstance.deployPoolAndDerivative(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    poolInstance = await SynthereumPoolOnChainPriceFeed.at(poolAddress);
    networkId = await web3.eth.net.getId();
    version = await poolInstance.version.call();
    collateralInstance = await TestnetERC20.deployed();
    expiration = (await web3.eth.getBlock('latest')).timestamp + 60;
    collateralAmount = web3Utils.toWei('120', 'mwei');
    feeAmount = web3Utils.toWei((120 * feePercentage).toString(), 'mwei');
    numTokens = web3Utils.toWei('99.8');
    await collateralInstance.allocateTo(poolAddress, poolStartingDeposit);
    await collateralInstance.allocateTo(sender, collateralAmount);
    await collateralInstance.approve(poolAddress, collateralAmount, {
      from: sender,
    });
    derivativeInstance = await Derivative.at(derivativeAddress);
    synthTokenAddr = await derivativeInstance.tokenCurrency.call();
    synthTokenInstance = await MintableBurnableERC20.at(synthTokenAddr);
    timerInstance = await Timer.deployed();
    managerInstance = await SynthereumManager.deployed();
    adminRole = '0x00';
    minterRole = web3Utils.soliditySha3('Minter');
    burnerRole = web3Utils.soliditySha3('Burner');
    aggregatorInstance = await MockV3Aggregator.deployed();
    await aggregatorInstance.updateAnswer(web3Utils.toWei('120', 'mwei'));
  });

  describe('Mint synthetic tokens', () => {
    it('Can  mint', async () => {
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };

      const prevSynthTokenBalance = await synthTokenInstance.balanceOf.call(
        sender,
      );
      const prevCollatBalance = await collateralInstance.balanceOf.call(sender);
      const prevCollatDaoBalance = await collateralInstance.balanceOf.call(DAO);
      const prevCollatLPBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const mintTx = await poolInstance.mint(MintParameters, {
        from: sender,
      });
      truffleAssert.eventEmitted(mintTx, 'Mint', ev => {
        return (
          ev.account == sender &&
          ev.pool == poolAddress &&
          ev.collateralSent == collateralAmount &&
          ev.numTokensReceived == numTokens &&
          ev.feePaid == feeAmount
        );
      });
      const actualSynthTokenBalance = await synthTokenInstance.balanceOf.call(
        sender,
      );
      const actualCollatBalance = await collateralInstance.balanceOf.call(
        sender,
      );
      const actualCollatDaoBalance = await collateralInstance.balanceOf.call(
        DAO,
      );
      const actualCollatLPBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );

      // Check correct balances after mint
      assert.equal(
        actualSynthTokenBalance.eq(
          prevSynthTokenBalance.add(web3Utils.toBN(numTokens)),
        ),
        true,
        'Wrong Synth token balance after mint',
      );
      assert.equal(
        prevCollatBalance.eq(
          actualCollatBalance.add(web3Utils.toBN(collateralAmount)),
        ),
        true,
        'Wrong collateral balance after mint',
      );
      assert.equal(
        actualCollatDaoBalance.eq(
          prevCollatDaoBalance.add(web3Utils.toBN(feeAmount / 2)),
        ),
        true,
        'Wrong fee DAO balance after mint',
      );
      assert.equal(
        actualCollatLPBalance.eq(
          prevCollatLPBalance.add(web3Utils.toBN(feeAmount / 2)),
        ),
        true,
        'Wrong fee LP balance after mint',
      );

      // Send another mint tx in order to have a more precise estimation of gas cost
      await collateralInstance.allocateTo(secondSender, 2 * collateralAmount);
      await collateralInstance.approve(poolAddress, 2 * collateralAmount, {
        from: secondSender,
      });
      await poolInstance.mint(MintParameters, {
        from: secondSender,
      });
      //Repeat tx with same user
      await poolInstance.mint(MintParameters, {
        from: secondSender,
      });
    });
    it('Revert if wrong derivative', async () => {
      let MintParameters = {
        derivative: wrongDerivativeAddr,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, {
          from: sender,
        }),
        'Wrong derivative',
      );
    });
    it('Revert if transaction is over the timeout', async () => {
      const wrongExpiration = expiration - 100;
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: wrongExpiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, {
          from: sender,
        }),
        'Transaction expired',
      );
    });
    it('Revert if fee is over the fee set by user', async () => {
      const wrongFeePercentageWei = web3Utils.toWei('0.0019');
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: wrongFeePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, {
          from: sender,
        }),
        'User fee percentage less than actual one',
      );
    });
    it('Revert if pool has not enough collateral deposited by LP to cover position', async () => {
      let newNumTokens = web3Utils.toWei('10000');
      let newMaxCollateral = web3Utils.toWei('100000', 'mwei');
      await collateralInstance.approve(poolAddress, newMaxCollateral, {
        from: sender,
      });
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: newNumTokens,
        collateralAmount: newMaxCollateral,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, {
          from: sender,
        }),
        'Insufficient collateral available from Liquidity Provider',
      );
    });
    it('Revert if user does not approve enough collateral to pool', async () => {
      await collateralInstance.approve(
        poolAddress,
        web3Utils.toBN(collateralAmount).sub(web3Utils.toBN(1)),
        { from: sender },
      );
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, {
          from: sender,
        }),
        'ERC20: transfer amount exceeds allowance',
      );
    });
    it('Revert if try to mint with no collateral', async () => {
      const wrongNumTokens = 0;
      const wrongCollateral = 0;
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: wrongNumTokens,
        collateralAmount: wrongCollateral,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, {
          from: sender,
        }),
        'Sending amount is equal to 0',
      );
    });
    it('Revert if user has less collateral than needed', async () => {
      await collateralInstance.approve(
        poolAddress,
        (parseInt(collateralAmount) - 1).toString(),
        {
          from: sender,
        },
      );
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, {
          from: sender,
        }),
        'ERC20: transfer amount exceeds allowance',
      );
    });
    it('Mint if max slippage is enough to mint tokens ', async () => {
      const newNumTokens = (
        parseInt(numTokens) - parseInt(web3Utils.toWei('10'))
      ).toString();
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: newNumTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, {
        from: sender,
      });
    });
    it('Revert if max slippage is not enough to mint tokens ', async () => {
      const newNumTokens = web3Utils
        .toBN(numTokens)
        .add(web3Utils.toBN('1'))
        .toString();
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: newNumTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, {
          from: sender,
        }),
        'Number of tokens less than minimum limit',
      );
    });
  });

  describe('Redeem collateral', () => {
    let tokensToRedeem;
    let totCollateralToReceive;
    let feeAmountRedeem;
    let collateralToReceive;
    beforeEach(async () => {
      // Suppose rate EUR/USDC moved to 1.3

      totCollateralToReceive = web3Utils.toWei('65', 'mwei');
      feeAmountRedeem = web3Utils.toWei(
        (65 * feePercentage).toString(),
        'mwei',
      );
      collateralToReceive = (
        parseInt(totCollateralToReceive) - parseInt(feeAmountRedeem)
      ).toString();
      tokensToRedeem = web3Utils.toWei('50');
      const MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      const mintTx = await poolInstance.mint(MintParameters, {
        from: sender,
      });
      await synthTokenInstance.approve(poolAddress, numTokens, {
        from: sender,
      });
      aggregatorInstance.updateAnswer(web3Utils.toWei('130', 'mwei'));
    });
    it('Can redeem', async () => {
      let RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: tokensToRedeem,
        minCollateral: collateralToReceive,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      const prevSynthTokenBalance = await synthTokenInstance.balanceOf.call(
        sender,
      );
      const prevCollatBalance = await collateralInstance.balanceOf.call(sender);
      const prevCollatDaoBalance = await collateralInstance.balanceOf.call(DAO);
      const prevCollatLPBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const redeemTx = await poolInstance.redeem(RedeemParameters, {
        from: sender,
      });
      truffleAssert.eventEmitted(redeemTx, 'Redeem', ev => {
        return (
          ev.account == sender &&
          ev.pool == poolAddress &&
          ev.numTokensSent == tokensToRedeem &&
          ev.collateralReceived == collateralToReceive &&
          ev.feePaid == feeAmountRedeem
        );
      });
      const actualSynthTokenBalance = await synthTokenInstance.balanceOf.call(
        sender,
      );
      const actualCollatBalance = await collateralInstance.balanceOf.call(
        sender,
      );
      const actualCollatDaoBalance = await collateralInstance.balanceOf.call(
        DAO,
      );
      const actualCollatLPBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      // Check correct balances after redeem
      assert.equal(
        prevSynthTokenBalance.eq(
          actualSynthTokenBalance.add(web3Utils.toBN(tokensToRedeem)),
        ),
        true,
        'Wrong Synth token balance after redeem',
      );
      assert.equal(
        actualCollatBalance.eq(
          prevCollatBalance.add(web3Utils.toBN(collateralToReceive)),
        ),
        true,
        'Wrong collateral balance after redeem',
      );
      assert.equal(
        actualCollatDaoBalance.eq(
          prevCollatDaoBalance.add(web3Utils.toBN(feeAmountRedeem / 2)),
        ),
        true,
        'Wrong fee DAO balance after redeem',
      );
      assert.equal(
        actualCollatLPBalance.eq(
          prevCollatLPBalance.add(web3Utils.toBN(feeAmountRedeem / 2)),
        ),
        true,
        'Wrong fee LP balance after redeem',
      );
      // Check gas cost for other redeems;
      tokensToRedeem = web3Utils.toWei('20');
      collateralToReceive = web3Utils.toWei('20', 'mwei');
      RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: tokensToRedeem,
        minCollateral: collateralToReceive,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.redeem(RedeemParameters, {
        from: sender,
      });
      await poolInstance.redeem(RedeemParameters, {
        from: sender,
      });
    });
    it('Revert if wrong derivative', async () => {
      let RedeemParameters = {
        derivative: wrongDerivativeAddr,
        numTokens: tokensToRedeem,
        minCollateral: collateralToReceive,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, {
          from: sender,
        }),
        'Wrong derivative',
      );
    });
    it('Revert if transaction is over the timeout', async () => {
      const wrongExpiration = expiration - 100;
      let RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: tokensToRedeem,
        minCollateral: collateralToReceive,
        feePercentage: feePercentageWei,
        expiration: wrongExpiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, {
          from: sender,
        }),
        'Transaction expired',
      );
    });
    it('Revert if fee is over the fee set by user', async () => {
      const wrongFeePercentageWei = web3Utils.toWei('0.0019');
      let RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: tokensToRedeem,
        minCollateral: collateralToReceive,
        feePercentage: wrongFeePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, {
          from: sender,
        }),
        'User fee percentage less than actual one',
      );
    });
    it('Revert if user does not approve enough synthetic tokens to pool', async () => {
      await synthTokenInstance.approve(
        poolAddress,
        web3Utils.toBN(tokensToRedeem).sub(web3Utils.toBN(1)),
        { from: sender },
      );
      let RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: tokensToRedeem,
        minCollateral: collateralToReceive,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, {
          from: sender,
        }),
        'ERC20: transfer amount exceeds allowance',
      );
    });
    it('Revert if try to redeem 0 tokens', async () => {
      const wrongNumTokens = 0;
      const wrongMinCollateral = 0;
      let RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: wrongNumTokens,
        minCollateral: wrongMinCollateral,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, {
          from: sender,
        }),
        'Sending amount is equal to 0',
      );
    });
    it('Revert if try to redeem more than sender balance', async () => {
      totCollateralToReceive = web3Utils.toWei('260', 'mwei');
      feeAmountRedeem = web3Utils.toWei(
        (260 * feePercentage).toString(),
        'mwei',
      );
      collateralToReceive = (
        parseInt(totCollateralToReceive) - parseInt(feeAmountRedeem)
      ).toString();
      tokensToRedeem = web3Utils.toWei('200');
      await synthTokenInstance.approve(poolAddress, tokensToRedeem, {
        from: sender,
      });
      let RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: tokensToRedeem,
        minCollateral: collateralToReceive,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, {
          from: sender,
        }),
        'Token balance less than token to redeem',
      );
    });
    it('Revert if collateral to redeem bigger than collateral in the derivative', async () => {
      aggregatorInstance.updateAnswer(web3Utils.toWei('500', 'mwei'));
      collateralToReceive = web3Utils.toWei('150', 'mwei');
      let RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: tokensToRedeem,
        minCollateral: collateralToReceive,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, {
          from: sender,
        }),
        'Collateral from derivative less than collateral amount',
      );
    });
    it('Redeem if max slippage is enough to redeem tokens ', async () => {
      const newMinCollateral = (
        parseInt(collateralToReceive) - parseInt(web3Utils.toWei('10', 'mwei'))
      ).toString();
      let RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: tokensToRedeem,
        minCollateral: newMinCollateral,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.redeem(RedeemParameters, {
        from: sender,
      });
    });
    it('Revert if max slippage is not enough to redeem tokens ', async () => {
      const newMinCollateral = (parseInt(collateralToReceive) + 1).toString();
      let RedeemParameters = {
        derivative: derivativeAddress,
        numTokens: tokensToRedeem,
        minCollateral: newMinCollateral,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, {
          from: sender,
        }),
        'Collateral amount less than minimum limit',
      );
    });
  });

  describe('Exchange synthetic tokens', () => {
    let destPoolInstance;
    let destPoolDerivativeInstance;
    let destSynthTokenInstance;
    let collAmountExchange;
    let numTokensExchange;
    let destNumeTokensExchange;
    let feeAmountExchange;
    let secondAggregator;
    let priceFeedinstance;
    beforeEach(async () => {
      const identifierWhitelistInstance = await IdentifierWhitelist.deployed();
      const identifierBytes = web3.utils.utf8ToHex(secondPriceFeedIdentifier);
      await identifierWhitelistInstance.addSupportedIdentifier(identifierBytes);
      const derivativeZero = ZERO_ADDRESS;
      derivativePayload = encodeDerivative(
        collateralAddress,
        secondPriceFeedIdentifier,
        secondSyntheticName,
        secondSyntheticSymbol,
        syntheticTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        derivativeAdmins,
        derivativePools,
      );
      poolPayload = encodePoolOnChainPriceFeed(
        derivativeZero,
        synthereumFinderAddress,
        poolVersion,
        roles,
        isContractAllowed,
        secondStartingCollateralization,
        fee,
      );
      const addresses = await deployerInstance.deployPoolAndDerivative.call(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPoolAndDerivative(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      destPoolInstance = await SynthereumPoolOnChainPriceFeed.at(
        addresses.pool,
      );
      destPoolDerivativeInstance = await Derivative.at(addresses.derivative);
      const synthTokenAddr = await destPoolDerivativeInstance.tokenCurrency.call();
      destSynthTokenInstance = await MintableBurnableERC20.at(synthTokenAddr);
      await collateralInstance.allocateTo(
        destPoolInstance.address,
        poolStartingDeposit,
      );
      const MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, { from: sender });
      await synthTokenInstance.approve(poolAddress, numTokens, {
        from: sender,
      });
      await aggregatorInstance.updateAnswer(web3Utils.toWei('130', 'mwei'));
      secondAggregator = await MockV3Aggregator.new(
        '8',
        web3Utils.toWei('162.175', 'mwei'),
      );
      priceFeedinstance = await ChainlinkPriceFeed.deployed();
      await priceFeedinstance.setAggregator(
        web3Utils.toHex('GBP/USD'),
        secondAggregator.address,
        { from: maintainer },
      );
      numTokensExchange = web3Utils.toWei('50');
      totCollAmountExchange = web3Utils.toWei('65', 'mwei');
      feeAmountExchange = web3Utils.toWei(
        (65 * feePercentage).toString(),
        'mwei',
      );
      collAmountExchange = (
        parseInt(totCollAmountExchange) - parseInt(feeAmountExchange)
      ).toString();
      destNumeTokensExchange = web3Utils
        .toBN(web3Utils.toWei(collAmountExchange))
        .div(web3Utils.toBN(web3Utils.toWei('1.62175', 'mwei')))
        .toString();
    });
    it('Can exchange', async () => {
      let ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: destPoolInstance.address,
        destDerivative: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        minDestNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      const prevSynthTokenBalance = await synthTokenInstance.balanceOf.call(
        sender,
      );
      const prevDestSynthTokenBalance = await destSynthTokenInstance.balanceOf.call(
        sender,
      );
      const prevCollatDaoBalance = await collateralInstance.balanceOf.call(DAO);
      const prevCollatLPBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      const exchangeTx = await poolInstance.exchange(ExchangeParameters, {
        from: sender,
      });
      truffleAssert.eventEmitted(exchangeTx, 'Exchange', ev => {
        return (
          ev.account == sender &&
          ev.sourcePool == poolAddress &&
          ev.destPool == destPoolInstance.address &&
          ev.numTokensSent == numTokensExchange &&
          ev.destNumTokensReceived == destNumeTokensExchange &&
          ev.feePaid == feeAmountExchange
        );
      });
      const actualSynthTokenBalance = await synthTokenInstance.balanceOf.call(
        sender,
      );
      const actualDestSynthTokenBalance = await destSynthTokenInstance.balanceOf.call(
        sender,
      );
      const actualCollatDaoBalance = await collateralInstance.balanceOf.call(
        DAO,
      );
      const actualCollatLPBalance = await collateralInstance.balanceOf.call(
        liquidityProvider,
      );
      assert.equal(
        prevSynthTokenBalance.eq(
          actualSynthTokenBalance.add(web3Utils.toBN(numTokensExchange)),
        ),
        true,
        'Wrong Synth token balance after exchange',
      );
      assert.equal(
        actualDestSynthTokenBalance.eq(
          prevDestSynthTokenBalance.add(web3Utils.toBN(destNumeTokensExchange)),
        ),
        true,
        'Wrong collateral balance after exchange',
      );
      assert.equal(
        actualCollatDaoBalance.eq(
          prevCollatDaoBalance.add(web3Utils.toBN(feeAmountExchange / 2)),
        ),
        true,
        'Wrong fee DAO balance after exchange',
      );
      assert.equal(
        actualCollatLPBalance.eq(
          prevCollatLPBalance.add(web3Utils.toBN(feeAmountExchange / 2)),
        ),
        true,
        'Wrong fee LP balance after exchange',
      );
      //Send other exchange tx for better gas estimation
      numTokensExchange = web3Utils.toWei('24');
      totCollAmountExchange = web3Utils.toWei('27.2', 'mwei');
      feeAmountExchange = web3Utils.toWei(
        (27.2 * feePercentage).toString(),
        'mwei',
      );
      collAmountExchange = (
        parseInt(totCollAmountExchange) - parseInt(feeAmountExchange)
      ).toString();
      destNumeTokensExchange = web3Utils
        .toBN(web3Utils.toWei(collAmountExchange))
        .div(web3Utils.toBN(web3Utils.toWei('1.6275', 'mwei')))
        .toString();
      ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: destPoolInstance.address,
        destDerivative: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        minDestNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.exchange(ExchangeParameters, {
        from: sender,
      });
      await poolInstance.exchange(ExchangeParameters, {
        from: sender,
      });
    });
    it('Revert if derivative of destination pool is wrong', async () => {
      ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: destPoolInstance.address,
        destDerivative: wrongDerivativeAddr,
        numTokens: numTokensExchange,
        minDestNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, {
          from: sender,
        }),
        'Wrong derivative',
      );
    });
    it('Revert if collateral of destination pool is different from the one of source pool', async () => {
      const wrongCollateralInstance = await TestnetERC20.new(
        'Wrong USDC',
        'USDC',
        6,
      );
      const collateralWhitelistInstance = await AddressWhitelist.deployed();
      await collateralWhitelistInstance.addToWhitelist(
        wrongCollateralInstance.address,
      );
      const derivativeZero = ZERO_ADDRESS;
      derivativePayload = encodeDerivative(
        wrongCollateralInstance.address,
        secondPriceFeedIdentifier,
        secondSyntheticName,
        secondSyntheticSymbol,
        syntheticTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        derivativeAdmins,
        derivativePools,
      );
      poolPayload = encodePoolOnChainPriceFeed(
        derivativeZero,
        synthereumFinderAddress,
        poolVersion,
        roles,
        isContractAllowed,
        secondStartingCollateralization,
        fee,
      );
      const addresses = await deployerInstance.deployPoolAndDerivative.call(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPoolAndDerivative(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      const wrongDestPoolInstance = await SynthereumPoolOnChainPriceFeed.at(
        addresses.pool,
      );
      const wrongDestPoolDerivativeInstance = await Derivative.at(
        addresses.derivative,
      );
      const wrongSynthTokenAddr = await wrongDestPoolDerivativeInstance.tokenCurrency.call();
      const wrongDestSynthTokenInstance = await MintableBurnableERC20.at(
        wrongSynthTokenAddr,
      );
      ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: wrongDestPoolInstance.address,
        destDerivative: wrongDestPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        minDestNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, {
          from: sender,
        }),
        'Collateral tokens do not match',
      );
    });
    it('Revert if destination pool is not registred', async () => {
      const synthereumPoolLibInstance = await SynthereumPoolOnChainPriceFeedLib.deployed();
      await SynthereumPoolOnChainPriceFeed.link(synthereumPoolLibInstance);
      const feeScaled = fee;
      feeScaled.feePercentage = {
        rawValue: web3Utils.toWei(fee.feePercentage),
      };
      const notRegistredPool = await SynthereumPoolOnChainPriceFeed.new(
        destPoolDerivativeInstance.address,
        synthereumFinderAddress,
        poolVersion,
        roles,
        isContractAllowed,
        secondStartingCollateralization,
        feeScaled,
      );
      ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: notRegistredPool.address,
        destDerivative: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        minDestNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, {
          from: sender,
        }),
        'Destination pool not registred',
      );
      fee.feePercentage = '0.002';
    });
    it('Revert if collateral amount bigger than amount withdrawn from the derivative', async () => {
      await aggregatorInstance.updateAnswer(web3Utils.toWei('500', 'mwei'));
      collAmountExchange = web3Utils.toWei('100', 'mwei');
      let ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: destPoolInstance.address,
        destDerivative: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        minDestNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, {
          from: sender,
        }),
        'Collateral from derivative less than collateral amount',
      );
    });
    it('Revert if collateral amount in the destination pool is not enough to cover position', async () => {
      await destPoolInstance.withdrawFromPool(
        web3Utils
          .toBN(poolStartingDeposit)
          .sub(web3Utils.toBN(web3Utils.toWei('1', 'mwei'))),
        { from: liquidityProvider },
      );
      let ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: destPoolInstance.address,
        destDerivative: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        minDestNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, {
          from: sender,
        }),
        'Insufficient collateral available from Liquidity Provider',
      );
    });
    it('Revert if try to exchange 0 tokens', async () => {
      const wrongNumTokens = 0;
      const wrongDestNumTokens = 0;
      let ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: destPoolInstance.address,
        destDerivative: destPoolDerivativeInstance.address,
        numTokens: wrongNumTokens,
        minDestNumTokens: wrongDestNumTokens,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, {
          from: sender,
        }),
        'Sending amount is equal to 0',
      );
    });
    it('Exchange if max slippage is enough to exchanghe tokens ', async () => {
      const newMinDestNumTokens = web3Utils
        .toBN(destNumeTokensExchange)
        .sub(web3Utils.toBN(web3Utils.toWei('1')))
        .toString();
      let ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: destPoolInstance.address,
        destDerivative: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        minDestNumTokens: newMinDestNumTokens,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.exchange(ExchangeParameters, {
        from: sender,
      });
    });
    it('Revert if max slippage is not enough to exchange tokens ', async () => {
      const newMinDestNumTokens = web3Utils
        .toBN(destNumeTokensExchange)
        .add(web3Utils.toBN('1'))
        .toString();
      let ExchangeParameters = {
        derivative: derivativeAddress,
        destPool: destPoolInstance.address,
        destDerivative: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        minDestNumTokens: newMinDestNumTokens,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, {
          from: sender,
        }),
        'Number of destination tokens less than minimum limit',
      );
    });
  });

  describe('Deposit into derivative', async () => {
    let collateralToDeposit;
    beforeEach(async () => {
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, {
        from: sender,
      });
      collateralToDeposit = web3Utils.toWei('80', 'mwei');
    });
    it('Can deposit', async () => {
      const prevPoolBalance = await collateralInstance.balanceOf(poolAddress);
      await poolInstance.depositIntoDerivative(
        derivativeAddress,
        collateralToDeposit,
        {
          from: liquidityProvider,
        },
      );
      const actualPoolBalance = await collateralInstance.balanceOf(poolAddress);
      assert.equal(
        prevPoolBalance.eq(
          actualPoolBalance.add(web3Utils.toBN(collateralToDeposit)),
        ),
        true,
        'Wrong deposit into derivative',
      );
    });
    it('Revert if sender is not LP', async () => {
      await truffleAssert.reverts(
        poolInstance.depositIntoDerivative(
          derivativeAddress,
          collateralToDeposit,
          {
            from: maintainer,
          },
        ),
        'Sender must be the liquidity provider',
      );
    });
    it('Revert if wrong derivative', async () => {
      await truffleAssert.reverts(
        poolInstance.depositIntoDerivative(
          wrongDerivativeAddr,
          collateralToDeposit,
          {
            from: liquidityProvider,
          },
        ),
        'Wrong derivative',
      );
    });
  });

  describe('Fast withdraw', async () => {
    let collateralToWithdraw;
    beforeEach(async () => {
      const addCollateral = web3Utils.toWei('15', 'mwei');
      const addTokens = web3Utils.toWei('10');
      poolPayload = encodePoolOnChainPriceFeed(
        derivativeAddress,
        synthereumFinderAddress,
        poolVersion,
        roles,
        isContractAllowed,
        startingCollateralization,
        fee,
      );
      const secondPoolAddress = await deployerInstance.deployOnlyPool.call(
        poolVersion,
        poolPayload,
        derivativeAddress,
        { from: maintainer },
      );
      await deployerInstance.deployOnlyPool(
        poolVersion,
        poolPayload,
        derivativeAddress,
        { from: maintainer },
      );
      const secondPoolInstance = await SynthereumPoolOnChainPriceFeed.at(
        secondPoolAddress,
      );
      await collateralInstance.allocateTo(
        secondPoolAddress,
        poolStartingDeposit,
      );
      await collateralInstance.allocateTo(sender, collateralAmount);
      await collateralInstance.approve(secondPoolAddress, collateralAmount, {
        from: sender,
      });
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await secondPoolInstance.mint(MintParameters, {
        from: sender,
      });
      await poolInstance.mint(MintParameters, {
        from: sender,
      });
      const collatAddeddByLP = web3Utils.toWei('100', 'mwei');
      await poolInstance.depositIntoDerivative(
        derivativeAddress,
        collatAddeddByLP,
        {
          from: liquidityProvider,
        },
      );
      collateralToWithdraw = web3Utils.toWei('10', 'mwei');
    });
    it('Can fast withdraw', async () => {
      const prevPoolBalance = await collateralInstance.balanceOf(poolAddress);
      const prevLPBalance = await collateralInstance.balanceOf(
        liquidityProvider,
      );
      await poolInstance.fastWithdraw(derivativeAddress, collateralToWithdraw, {
        from: liquidityProvider,
      });
      const actualPoolBalance = await collateralInstance.balanceOf(poolAddress);
      const actualLPBalance = await collateralInstance.balanceOf(
        liquidityProvider,
      );
      assert.equal(
        actualLPBalance.eq(
          prevLPBalance.add(web3Utils.toBN(collateralToWithdraw)),
        ),
        true,
        'Wrong fast withdraw for LP',
      );
      assert.equal(
        prevPoolBalance.eq(actualPoolBalance),
        true,
        'Wrong fast withdraw for pool',
      );
    });
    it('Revert if sender is not LP', async () => {
      await truffleAssert.reverts(
        poolInstance.fastWithdraw(derivativeAddress, collateralToWithdraw, {
          from: maintainer,
        }),
        'Sender must be the liquidity provider',
      );
    });
    it('Revert if wrong derivative', async () => {
      await truffleAssert.reverts(
        poolInstance.fastWithdraw(wrongDerivativeAddr, collateralToWithdraw, {
          from: liquidityProvider,
        }),
        'Wrong derivative',
      );
    });
  });

  describe('Slow withdraw', async () => {
    let collateralToWithdraw;
    beforeEach(async () => {
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, {
        from: sender,
      });
      collateralToWithdraw = web3Utils.toWei('5', 'mwei');
    });
    it('Can slow withdraw', async () => {
      const prevPoolBalance = await collateralInstance.balanceOf(poolAddress);
      const prevLPBalance = await collateralInstance.balanceOf(
        liquidityProvider,
      );

      await poolInstance.slowWithdrawRequest(
        derivativeAddress,
        collateralToWithdraw,
        { from: liquidityProvider },
      );
      const actualTime = parseInt(
        (await timerInstance.getCurrentTime()).toString(),
      );
      await timerInstance.setCurrentTime(actualTime + withdrawalLiveness);
      await poolInstance.slowWithdrawPassedRequest(derivativeAddress, {
        from: liquidityProvider,
      });
      const actualPoolBalance = await collateralInstance.balanceOf(poolAddress);
      const actualLPBalance = await collateralInstance.balanceOf(
        liquidityProvider,
      );
      assert.equal(
        actualLPBalance.eq(
          prevLPBalance.add(web3Utils.toBN(collateralToWithdraw)),
        ),
        true,
        'Wrong slow withdraw for LP',
      );
      assert.equal(
        prevPoolBalance.eq(actualPoolBalance),
        true,
        'Wrong slow withdraw for pool',
      );
    });
    it('Revert if withdraw is called before withdraw liveness expiration', async () => {
      await poolInstance.slowWithdrawRequest(
        derivativeAddress,
        collateralToWithdraw,
        { from: liquidityProvider },
      );
      const actualTime = parseInt(
        (await timerInstance.getCurrentTime()).toString(),
      );
      await timerInstance.setCurrentTime(actualTime + withdrawalLiveness / 2);
      await truffleAssert.reverts(
        poolInstance.slowWithdrawPassedRequest(derivativeAddress, {
          from: liquidityProvider,
        }),
        'Invalid withdraw request',
      );
    });
  });

  describe('Withdraw from the pool', async () => {
    let collateralToWithdraw = web3Utils.toWei('10', 'mwei');
    it('Can withdraw from pool', async () => {
      const prevPoolBalance = await collateralInstance.balanceOf(poolAddress);
      const prevLPBalance = await collateralInstance.balanceOf(
        liquidityProvider,
      );
      await poolInstance.withdrawFromPool(collateralToWithdraw, {
        from: liquidityProvider,
      });
      const actualPoolBalance = await collateralInstance.balanceOf(poolAddress);
      const actualLPBalance = await collateralInstance.balanceOf(
        liquidityProvider,
      );
      assert.equal(
        actualLPBalance.eq(
          prevLPBalance.add(web3Utils.toBN(collateralToWithdraw)),
        ),
        true,
        'Wrong withdraw from pool for LP',
      );
      assert.equal(
        prevPoolBalance.eq(
          actualPoolBalance.add(web3Utils.toBN(collateralToWithdraw)),
        ),
        true,
        'Wrong withdraw from pool for pool',
      );
    });
    it('Revert if sender is not LP', async () => {
      await truffleAssert.reverts(
        poolInstance.withdrawFromPool(collateralToWithdraw, {
          from: maintainer,
        }),
        'Sender must be the liquidity provider',
      );
    });
  });

  describe('Emergency shutdown and settle', async () => {
    let secondCollateralAmount;
    let secondNumTokens;
    let mockOracle;
    beforeEach(async () => {
      const actualTime = parseInt(
        (await timerInstance.getCurrentTime()).toString(),
      );
      await timerInstance.setCurrentTime(actualTime + 1);
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, {
        from: sender,
      });
      aggregatorInstance.updateAnswer(web3Utils.toWei('120', 'mwei'));
      secondCollateralAmount = web3Utils.toWei('36', 'mwei');
      secondNumTokens = web3Utils.toWei('29.94');
      await collateralInstance.allocateTo(secondSender, secondCollateralAmount);
      await collateralInstance.approve(poolAddress, secondCollateralAmount, {
        from: secondSender,
      });
      MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: secondNumTokens,
        collateralAmount: secondCollateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, {
        from: secondSender,
      });
      const finderInstance = await UmaFinder.deployed();
      mockOracle = await MockOracle.new(
        finderInstance.address,
        timerInstance.address,
      );
      const mockOracleInterfaceName = web3Utils.utf8ToHex(interfaceName.Oracle);

      await finderInstance.changeImplementationAddress(
        mockOracleInterfaceName,
        mockOracle.address,
      );

      await synthTokenInstance.approve(poolAddress, numTokens, {
        from: sender,
      });
      await synthTokenInstance.approve(poolAddress, secondNumTokens, {
        from: secondSender,
      });

      await managerInstance.emergencyShutdown([derivativeAddress], {
        from: maintainer,
      });
    });
    it('Revert if DVM has not set the price', async () => {
      await truffleAssert.reverts(
        poolInstance.settleEmergencyShutdown(derivativeAddress, {
          from: sender,
        }),
        'Unresolved oracle price',
      );
    });
    it('Can settle', async () => {
      const actualTime = parseInt(
        (await timerInstance.getCurrentTime()).toString(),
      );
      await mockOracle.pushPrice(
        web3Utils.utf8ToHex(priceFeedIdentifier),
        actualTime,
        web3Utils.toWei('1.3'),
      );
      const poolBalance = parseInt(
        (await collateralInstance.balanceOf.call(poolAddress)).toString(),
      );
      // number of tokens * oracle_rate
      const senderCheckCollateral = parseInt(
        web3Utils.toWei('129.74', 'mwei').toString(),
      );
      const secondSenderCheckCollateral = parseInt(
        web3Utils.toWei('38.922', 'mwei').toString(),
      );
      const LpCheckCollateral = parseInt(
        web3Utils.toWei('25.948', 'mwei').toString(),
      );
      const prevSenderBalance = parseInt(
        (await collateralInstance.balanceOf.call(sender)).toString(),
      );
      const settleTx = await poolInstance.settleEmergencyShutdown(
        derivativeAddress,
        {
          from: sender,
        },
      );
      truffleAssert.eventEmitted(settleTx, 'Settlement', ev => {
        return (
          ev.account == sender &&
          ev.pool == poolAddress &&
          ev.numTokens == numTokens &&
          ev.collateralSettled == senderCheckCollateral
        );
      });
      const actualSenderBalance = parseInt(
        (await collateralInstance.balanceOf.call(sender)).toString(),
      );
      assert.equal(
        prevSenderBalance + senderCheckCollateral,
        actualSenderBalance,
        'Wrong sender balance after settle',
      );
      const prevSecondSenderBalance = parseInt(
        (await collateralInstance.balanceOf.call(secondSender)).toString(),
      );
      await poolInstance.settleEmergencyShutdown(derivativeAddress, {
        from: secondSender,
      });
      const actualSecondSenderBalance = parseInt(
        (await collateralInstance.balanceOf.call(secondSender)).toString(),
      );
      assert.equal(
        prevSecondSenderBalance + secondSenderCheckCollateral,
        actualSecondSenderBalance,
        'Wrong sender balance after settle',
      );

      const prevLPBalance = parseInt(
        (await collateralInstance.balanceOf.call(liquidityProvider)).toString(),
      );
      await poolInstance.settleEmergencyShutdown(derivativeAddress, {
        from: liquidityProvider,
      });
      const actualLPBalance = parseInt(
        (await collateralInstance.balanceOf.call(liquidityProvider)).toString(),
      );
      assert.equal(
        prevLPBalance + poolBalance + LpCheckCollateral,
        actualLPBalance,
        'Wrong sender balance after settle',
      );
      senderSynthTokenBalance = parseInt(
        (await synthTokenInstance.balanceOf.call(sender)).toString(),
      );
      secondSenderSynthTokenBalance = parseInt(
        (await synthTokenInstance.balanceOf.call(secondSender)).toString(),
      );
      assert.equal(senderSynthTokenBalance, 0, 'Synthetic balance not 0');
      assert.equal(secondSenderSynthTokenBalance, 0, 'Synthetic balance not 0');
    });
    it('Revert if sender is not a token holder or the LP', async () => {
      const actualTime = parseInt(
        (await timerInstance.getCurrentTime()).toString(),
      );
      await mockOracle.pushPrice(
        web3Utils.utf8ToHex(priceFeedIdentifier),
        actualTime,
        web3Utils.toWei('1.3'),
      );
      await truffleAssert.reverts(
        poolInstance.settleEmergencyShutdown(derivativeAddress, {
          from: wrongSender,
        }),
        'Account has nothing to settle',
      );
    });
  });

  describe('Derivatives linking', async () => {
    it('Can add derivative', async () => {
      derivativePayload = encodeDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        synthTokenInstance.address,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        derivativeAdmins,
        derivativePools,
      );
      const newDerivative = await deployerInstance.deployOnlyDerivative.call(
        derivativeVersion,
        derivativePayload,
        poolAddress,
        { from: maintainer },
      );
      await deployerInstance.deployOnlyDerivative(
        derivativeVersion,
        derivativePayload,
        poolAddress,
        { from: maintainer },
      );
      const addDerivativetx = await poolInstance.addDerivative(newDerivative, {
        from: maintainer,
      });
      truffleAssert.eventEmitted(addDerivativetx, 'AddDerivative', ev => {
        return ev.pool == poolAddress && ev.derivative == newDerivative;
      });
      const isAdmitted = await poolInstance.isDerivativeAdmitted.call(
        newDerivative,
      );
      assert.equal(isAdmitted, true, 'Derivative not admitted');
      const allDerivatives = await poolInstance.getAllDerivatives.call();
      assert.equal(allDerivatives.length, 2, 'Wrong number of derivatives');
      assert.equal(
        allDerivatives[0],
        derivativeAddress,
        'Wrong old derivative',
      );
      assert.equal(allDerivatives[1], newDerivative, 'Wrong old derivative');
    });
    it('Revert if add derivative with a different collateral', async () => {
      const wrongCollateralInstance = await TestnetERC20.new(
        'Wrong USDC',
        'USDC',
        6,
      );
      const collateralWhitelistInstance = await AddressWhitelist.deployed();
      await collateralWhitelistInstance.addToWhitelist(
        wrongCollateralInstance.address,
      );
      const derivativeZero = ZERO_ADDRESS;
      derivativePayload = encodeDerivative(
        wrongCollateralInstance.address,
        secondPriceFeedIdentifier,
        secondSyntheticName,
        secondSyntheticSymbol,
        syntheticTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        derivativeAdmins,
        derivativePools,
      );
      poolPayload = encodePoolOnChainPriceFeed(
        derivativeZero,
        synthereumFinderAddress,
        poolVersion,
        roles,
        isContractAllowed,
        secondStartingCollateralization,
        fee,
      );
      const addresses = await deployerInstance.deployPoolAndDerivative.call(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPoolAndDerivative(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        poolInstance.addDerivative(addresses.derivative, { from: maintainer }),
        'Wrong collateral of the new derivative',
      );
    });
    it('Revert if add derivative with a different synthetic token', async () => {
      derivativePayload = encodeDerivative(
        collateralAddress,
        priceFeedIdentifier,
        syntheticName,
        syntheticSymbol,
        syntheticTokenAddress,
        collateralRequirement,
        disputeBondPct,
        sponsorDisputeRewardPct,
        disputerDisputeRewardPct,
        minSponsorTokens,
        withdrawalLiveness,
        liquidationLiveness,
        excessBeneficiary,
        derivativeAdmins,
        derivativePools,
      );
      poolPayload = encodePoolOnChainPriceFeed(
        derivativeAddress,
        synthereumFinderAddress,
        poolVersion,
        roles,
        isContractAllowed,
        startingCollateralization,
        fee,
      );
      const addresses = await deployerInstance.deployPoolAndDerivative.call(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      await deployerInstance.deployPoolAndDerivative(
        derivativeVersion,
        poolVersion,
        derivativePayload,
        poolPayload,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        poolInstance.addDerivative(addresses.derivative, { from: maintainer }),
        'Wrong synthetic token',
      );
    });
    it('Revert if add derivative already included in the pool', async () => {
      await truffleAssert.reverts(
        poolInstance.addDerivative(derivativeAddress, { from: maintainer }),
        'Derivative has already been included',
      );
    });
    it('Can remove derivative', async () => {
      const removeDerivativetx = await poolInstance.removeDerivative(
        derivativeAddress,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(removeDerivativetx, 'RemoveDerivative', ev => {
        return ev.pool == poolAddress && ev.derivative == derivativeAddress;
      });
      const isAdmitted = await poolInstance.isDerivativeAdmitted.call(
        derivativeAddress,
      );
      assert.equal(isAdmitted, false, 'Derivative still admitted');
      const allDerivatives = await poolInstance.getAllDerivatives.call();
      assert.equal(allDerivatives.length, 0, 'Number of derivatives must be 0');
    });
    it('Revert if remove a derivative not included', async () => {
      await truffleAssert.reverts(
        poolInstance.removeDerivative(wrongDerivativeAddr, {
          from: maintainer,
        }),
        'Derivative not included',
      );
    });
  });

  describe('Roles of derivative managment', async () => {
    beforeEach(async () => {
      await managerInstance.grantSynthereumRole(
        [derivativeAddress],
        [adminRole],
        [poolInstance.address],
        { from: maintainer },
      );
    });
    afterEach(async () => {
      await managerInstance.revokeSynthereumRole(
        [derivativeAddress],
        [adminRole],
        [poolInstance.address],
        { from: maintainer },
      );
    });
  });

  describe('Fee functions', async () => {
    it('Check fees values', async () => {
      const feeOutput = await poolInstance.getFeeInfo.call();
      assert.equal(
        feeOutput.feePercentage.rawValue,
        web3Utils.toWei(feePercentage),
        'Wrong fee percentage',
      );
      assert.equal(
        feeOutput.feeRecipients[0],
        liquidityProvider,
        'Wrong LP address',
      );
      assert.equal(feeOutput.feeRecipients[1], DAO, 'Wrong DAO address');
      assert.equal(feeOutput.feeProportions[0], 50, 'Wrong first proportion');
      assert.equal(feeOutput.feeProportions[1], 50, 'Wrong second proportion');
    });
    it('Set fee percentage', async () => {
      const newFeePerc = web3Utils.toWei('0.1');
      await poolInstance.setFeePercentage(newFeePerc, { from: maintainer });
      const feeOutput = await poolInstance.getFeeInfo.call();
      assert.equal(
        feeOutput.feePercentage.rawValue,
        newFeePerc,
        'Wrong fee percentage',
      );
    });
    it('Set fee recipients', async () => {
      const newFeePerc = web3Utils.toWei('0.1');
      await poolInstance.setFeeRecipients([sender, secondSender], [40, 60], {
        from: maintainer,
      });
      const feeOutput = await poolInstance.getFeeInfo.call();
      assert.equal(feeOutput.feeRecipients[0], sender, 'Wrong LP address');
      assert.equal(
        feeOutput.feeRecipients[1],
        secondSender,
        'Wrong DAO address',
      );
      assert.equal(feeOutput.feeProportions[0], 40, 'Wrong first proportion');
      assert.equal(feeOutput.feeProportions[1], 60, 'Wrong second proportion');
    });
    it('Set fee', async () => {
      const newFeePerc = web3Utils.toWei('0.1');
      const newFee = {
        feePercentage: {
          rawValue: newFeePerc,
        },
        feeRecipients: [sender, secondSender],
        feeProportions: [30, 70],
      };
      await poolInstance.setFee(newFee, { from: maintainer });
      const feeOutput = await poolInstance.getFeeInfo.call();
      assert.equal(
        feeOutput.feePercentage.rawValue,
        newFeePerc,
        'Wrong fee percentage',
      );
      assert.equal(feeOutput.feeRecipients[0], sender, 'Wrong LP address');
      assert.equal(
        feeOutput.feeRecipients[1],
        secondSender,
        'Wrong DAO address',
      );
      assert.equal(feeOutput.feeProportions[0], 30, 'Wrong first proportion');
      assert.equal(feeOutput.feeProportions[1], 70, 'Wrong second proportion');
    });
    it('Revert if sender is not the maintainer', async () => {
      const newFeePerc = web3Utils.toWei('0.1');
      await truffleAssert.reverts(
        poolInstance.setFeePercentage(newFeePerc, { from: sender }),
        'Sender must be the maintainer',
      );
    });
    it('Revert if fee percentage is more than 100%', async () => {
      const newFeePerc = web3Utils.toWei('1.01');
      await truffleAssert.reverts(
        poolInstance.setFeePercentage(newFeePerc, { from: maintainer }),
        'Fee Percentage must be less than 100%',
      );
    });
    it('Revert if number of recipients and proportions is different', async () => {
      await truffleAssert.reverts(
        poolInstance.setFeeRecipients([sender, secondSender], [40], {
          from: maintainer,
        }),
        'Fee recipients and fee proportions do not match',
      );
    });
    it('Check correct fee calculations', async () => {
      const amount = web3Utils.toWei('1000', 'mwei');
      const feeToCheck = web3Utils.toWei('2', 'mwei');
      const feeAmountOutput = await poolInstance.calculateFee.call(amount);
      assert.equal(feeAmountOutput, feeToCheck, 'Correct fee');
    });
  });

  describe('Starting collatralization ratio', async () => {
    it('Check ratio', async () => {
      const ratio = await poolInstance.getStartingCollateralization.call();
      assert.equal(ratio, startingCollateralization, 'Wrong starting ratio');
    });
    it('Set ratio', async () => {
      const newRatio = '1600000';
      await poolInstance.setStartingCollateralization(newRatio, {
        from: maintainer,
      });
      const ratio = await poolInstance.getStartingCollateralization.call();
      assert.equal(ratio, newRatio, 'Wrong starting ratio');
    });
  });

  describe('Check if access is allowed to contracts', async () => {
    let proxyContract;
    let proxyMintParams;
    let testAmount = web3Utils.toWei('1000', 'mwei');
    beforeEach(async () => {
      proxyContract = await ContractAllowed.new(
        poolAddress,
        collateralInstance.address,
      );
      proxyMintParams = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
      };
      await collateralInstance.allocateTo(proxyContract.address, testAmount);
    });
    it('Revert if contracts are not allowed ', async () => {
      await truffleAssert.reverts(
        proxyContract.mintInPool(proxyMintParams, testAmount),
        'Account must be an EOA',
      );
    });
    it('Check success if contract is allowed ', async () => {
      const prevStatus = await poolInstance.isContractAllowed.call();
      assert.equal(prevStatus, false, 'Wrong previous status');
      await poolInstance.setIsContractAllowed(true, { from: maintainer });
      const actualStatus = await poolInstance.isContractAllowed.call();
      assert.equal(actualStatus, true, 'Wrong actual status');
      await proxyContract.mintInPool(proxyMintParams, testAmount);
    });
    it('Revert if set the same status ', async () => {
      await truffleAssert.reverts(
        poolInstance.setIsContractAllowed(false, { from: maintainer }),
        'Contract flag already set',
      );
    });
  });
});
