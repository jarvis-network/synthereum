//helper scripts
const { interfaceName } = require('@jarvis-network/uma-common');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
} = require('../utils/encoding.js');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumPoolOnChainPriceFeed = artifacts.require(
  'SynthereumPoolOnChainPriceFeed',
);
const MintableBurnableERC20 = artifacts.require('MintableBurnableERC20');
const SynthereumPoolOnChainPriceFeedLib = artifacts.require(
  'SynthereumPoolOnChainPriceFeedLib',
);
const Derivative = artifacts.require('PerpetualPoolParty');
const Timer = artifacts.require('Timer');
const MockOracle = artifacts.require('MockOracle');
const ContractAllowed = artifacts.require('ContractAllowed');
const MockV3Aggregator = artifacts.require('MockV3Aggregator');

contract('Synthereum pool with on chain price feed', function (accounts) {
  let derivativeVersion = 1;

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
    aggregatorInstance = await MockV3Aggregator.deployed();
    aggregatorInstance.updateAnswer(web3Utils.toWei('120', 'mwei'));
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
        'Collateral amount bigger than collateral in the derivative',
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
});
