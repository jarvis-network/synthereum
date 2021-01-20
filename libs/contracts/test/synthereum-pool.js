//helper scripts
const { interfaceName } = require('@jarvis-network/uma-common');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const ethers = require('ethers');
const { encodeDerivative, encodePool } = require('../utils/encoding.js');
const {
  generateMintSignature,
  generateRedeemSignature,
  generateExchangeSignature,
} = require('../utils/metasignature.js');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const TestnetERC20 = artifacts.require('TestnetERC20');
const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');
const SynthereumPool = artifacts.require('SynthereumPool');
const MintableBurnableERC20 = artifacts.require('MintableBurnableERC20');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
const SynthereumPoolLib = artifacts.require('SynthereumPoolLib');
const Timer = artifacts.require('Timer');
const MockOracle = artifacts.require('MockOracle');
const UmaFinder = artifacts.require('Finder');
const ContractAllowed = artifacts.require('ContractAllowed');

contract('Synthereum pool', function (accounts) {
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
  let disputeBondPct = web3Utils.toWei('1.5');
  let sponsorDisputeRewardPct = web3Utils.toWei('0.5');
  let disputerDisputeRewardPct = web3Utils.toWei('0.4');
  let minSponsorTokens = web3Utils.toWei('1');
  let withdrawalLiveness = 3600;
  let liquidationLiveness = 3600;
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
  let validator = accounts[3];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
    validator,
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
  //MetaSig params
  //We suppose a starting rate of 1 jEur = 1.2 USDC (EUR/USD = 1.2)
  let collateralAmount = web3Utils.toWei('120', 'mwei');
  let feeAmount = web3Utils.toWei((120 * feePercentage).toString(), 'mwei');
  let totCollAmount = (
    parseInt(collateralAmount) + parseInt(feeAmount)
  ).toString();
  let numTokens;
  let nonce;
  let networkId;
  let version;
  let expiration;
  const mnemonic =
    'test test test test test test test test test test test junk';
  const path = "m/44'/60'/0'/0/3";
  const wallet = ethers.Wallet.fromMnemonic(mnemonic, path);
  let validatorPrivKey = wallet.privateKey.replace('0x', '');

  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 1;
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
    poolPayload = encodePool(
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
    poolInstance = await SynthereumPool.at(poolAddress);
    nonce = (await poolInstance.getUserNonce.call(sender)).toString();
    networkId = await web3.eth.net.getId();
    version = await poolInstance.version.call();
    collateralInstance = await TestnetERC20.deployed();
    expiration = (await web3.eth.getBlock('latest')).timestamp + 60;
    numTokens = web3Utils.toWei('100');
    await collateralInstance.allocateTo(poolAddress, poolStartingDeposit);
    await collateralInstance.allocateTo(sender, totCollAmount);
    await collateralInstance.approve(poolAddress, totCollAmount, {
      from: sender,
    });
    derivativeInstance = await PerpetualPoolParty.at(derivativeAddress);
    synthTokenAddr = await derivativeInstance.tokenCurrency.call();
    synthTokenInstance = await MintableBurnableERC20.at(synthTokenAddr);
    timerInstance = await Timer.deployed();
  });

  describe('Mint synthetic tokens', () => {
    it('Can mint', async () => {
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
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
      const mintTx = await poolInstance.mint(MintParameters, Signature, {
        from: sender,
      });
      truffleAssert.eventEmitted(mintTx, 'Mint', ev => {
        return (
          ev.account == sender &&
          ev.pool == poolAddress &&
          ev.collateralSent == totCollAmount &&
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
          actualCollatBalance.add(web3Utils.toBN(totCollAmount)),
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
      await collateralInstance.allocateTo(secondSender, 2 * totCollAmount);
      await collateralInstance.approve(poolAddress, 2 * totCollAmount, {
        from: secondSender,
      });
      nonce = (await poolInstance.getUserNonce.call(secondSender)).toString();
      Signature = generateMintSignature(
        secondSender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      MintParameters = {
        sender: secondSender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, Signature, {
        from: secondSender,
      });
      //Repeat tx with same user (nonce increased)
      nonce = (await poolInstance.getUserNonce.call(secondSender)).toString();
      Signature = generateMintSignature(
        secondSender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      MintParameters = {
        sender: secondSender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce.toString(),
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, Signature, {
        from: secondSender,
      });
    });
    it('Revert if wrong derivative', async () => {
      derivativeAddress = wrongDerivativeAddr;
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, Signature, { from: sender }),
        'Wrong derivative',
      );
    });
    it('Revert if wrong signature', async () => {
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      Signature.r = web3Utils.keccak256(Signature.r);
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, Signature, { from: sender }),
        'Invalid meta-signature',
      );
    });
    it('Revert if mint tx was sent by a an address different from the one used by metasignature', async () => {
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, Signature, { from: wrongSender }),
        'Wrong user account',
      );
    });
    it('Revert if metaTx is over the timeout', async () => {
      expiration = expiration - 100;
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, Signature, { from: sender }),
        'Meta-signature expired',
      );
    });
    it('Revert if metaTx fee percentage is wrong', async () => {
      feePercentageWei = web3Utils.toWei('0.003');
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, Signature, { from: sender }),
        'Wrong fee percentage',
      );
    });
    it('Revert if nonce is wrong', async () => {
      nonce = 3;
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, Signature, { from: sender }),
        'Invalid nonce',
      );
    });
    it('Revert if pool has not enough collateral deposited by LP to cover position', async () => {
      numTokens = web3Utils.toWei('10000');
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, Signature, { from: sender }),
        'Insufficient collateral available from Liquidity Provider',
      );
    });
    it('Revert if user does not approve collateral to pool', async () => {
      await collateralInstance.approve(poolAddress, 0, { from: sender });
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.mint(MintParameters, Signature, { from: sender }),
        'ERC20: transfer amount exceeds allowance',
      );
    });
  });

  describe('Redeem synthetic tokens', () => {
    let tokensToRedeem;
    let collateralToReceive;
    let feeAmountRedeem;
    let netAmountReceived;
    let RedeemSignature;
    let RedeemParameters;
    beforeEach(async () => {
      // Suppose rate EUR/USDC moved to 1.3
      tokensToRedeem = web3Utils.toWei('50');
      collateralToReceive = web3Utils.toWei('65', 'mwei');
      feeAmountRedeem = web3Utils.toWei(
        (65 * feePercentage).toString(),
        'mwei',
      );
      netAmountReceived =
        parseInt(collateralToReceive) - parseInt(feeAmountRedeem);
      const Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      const MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      const mintTx = await poolInstance.mint(MintParameters, Signature, {
        from: sender,
      });
      await synthTokenInstance.approve(poolAddress, numTokens, {
        from: sender,
      });
    });
    it('Can redeem', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
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

      const redeemTx = await poolInstance.redeem(
        RedeemParameters,
        RedeemSignature,
        { from: sender },
      );
      truffleAssert.eventEmitted(redeemTx, 'Redeem', ev => {
        return (
          ev.account == sender &&
          ev.pool == poolAddress &&
          ev.numTokensSent == tokensToRedeem &&
          ev.collateralReceived == netAmountReceived &&
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
          prevCollatBalance.add(web3Utils.toBN(netAmountReceived)),
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
      // Check gas cost for other redeems
      tokensToRedeem = web3Utils.toWei('30');
      collateralToReceive = web3Utils.toWei('39', 'mwei');
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.redeem(RedeemParameters, RedeemSignature, {
        from: sender,
      });
      tokensToRedeem = web3Utils.toWei('10');
      collateralToReceive = web3Utils.toWei('13', 'mwei');
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.redeem(RedeemParameters, RedeemSignature, {
        from: sender,
      });
    });
    it('Revert if wrong derivative', async () => {
      derivativeAddress = wrongDerivativeAddr;
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: sender,
        }),
        'Wrong derivative',
      );
    });
    it('Revert if wrong signature', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );

      RedeemSignature.r = web3Utils.keccak256(RedeemSignature.r);
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: sender,
        }),
        'Invalid meta-signature',
      );
    });
    it('Revert if mint tx was sent by a an address different from the one used by metasignature', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: wrongSender,
        }),
        'Wrong user account',
      );
    });
    it('Revert if metaTx is over the timeout', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      expiration = expiration - 100;
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: sender,
        }),
        'Meta-signature expired',
      );
    });
    it('Revert if metaTx fee percentage is wrong', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      feePercentageWei = web3Utils.toWei('0.003');
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: sender,
        }),
        'Wrong fee percentage',
      );
    });
    it('Revert if nonce is wrong', async () => {
      nonce = 3;
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: sender,
        }),
        'Invalid nonce',
      );
    });
    it('Revert if user does not approve synth tokens to pool', async () => {
      await synthTokenInstance.approve(poolAddress, 0, { from: sender });
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: sender,
        }),
        'ERC20: transfer amount exceeds allowance',
      );
    });
    it('Revert if try to redeem 0 tokens', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      tokensToRedeem = 0;
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: sender,
        }),
        'Number of tokens to redeem is 0',
      );
    });
    it('Revert if try to redeem more than sender balance', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      tokensToRedeem = web3Utils.toWei('200');
      await synthTokenInstance.approve(poolAddress, tokensToRedeem, {
        from: sender,
      });
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: sender,
        }),
        'Token balance less than token to redeem',
      );
    });
    it('Revert if collateral to redeem bigger than collateral in the derivative', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      collateralToReceive = web3Utils.toWei('100', 'mwei');
      await synthTokenInstance.approve(poolAddress, tokensToRedeem, {
        from: sender,
      });
      RedeemSignature = generateRedeemSignature(
        sender,
        derivativeAddress,
        collateralToReceive,
        tokensToRedeem,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      RedeemParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralToReceive,
        numTokens: tokensToRedeem,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.redeem(RedeemParameters, RedeemSignature, {
          from: sender,
        }),
        'Collateral amount bigger than collateral in the derivative',
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
      poolPayload = encodePool(
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
      destPoolInstance = await SynthereumPool.at(addresses.pool);
      destPoolDerivativeInstance = await PerpetualPoolParty.at(
        addresses.derivative,
      );
      const synthTokenAddr = await destPoolDerivativeInstance.tokenCurrency.call();
      destSynthTokenInstance = await MintableBurnableERC20.at(synthTokenAddr);
      await collateralInstance.allocateTo(
        destPoolInstance.address,
        poolStartingDeposit,
      );
      const Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      const MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, Signature, { from: sender });
      await synthTokenInstance.approve(poolAddress, numTokens, {
        from: sender,
      });
      collAmountExchange = web3Utils.toWei('39', 'mwei');
      numTokensExchange = web3Utils.toWei('30');
      destNumeTokensExchange = web3Utils.toWei('35');
      feeAmountExchange = web3Utils.toWei(
        (39 * feePercentage).toString(),
        'mwei',
      );
    });

    it('Can exchange', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      let ExchangeSignature = generateExchangeSignature(
        sender,
        derivativeAddress,
        destPoolInstance.address,
        destPoolDerivativeInstance.address,
        numTokensExchange,
        collAmountExchange,
        destNumeTokensExchange,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let ExchangeParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        destPoolAddr: destPoolInstance.address,
        destDerivativeAddr: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        collateralAmount: collAmountExchange,
        destNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        nonce: nonce,
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
      const exchangeTx = await poolInstance.exchange(
        ExchangeParameters,
        ExchangeSignature,
        { from: sender },
      );
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
      collAmountExchange = web3Utils.toWei('40', 'mwei');
      numTokensExchange = web3Utils.toWei('30');
      destNumeTokensExchange = web3Utils.toWei('34');
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      ExchangeSignature = generateExchangeSignature(
        sender,
        derivativeAddress,
        destPoolInstance.address,
        destPoolDerivativeInstance.address,
        numTokensExchange,
        collAmountExchange,
        destNumeTokensExchange,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      ExchangeParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        destPoolAddr: destPoolInstance.address,
        destDerivativeAddr: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        collateralAmount: collAmountExchange,
        destNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.exchange(ExchangeParameters, ExchangeSignature, {
        from: sender,
      });
      collAmountExchange = web3Utils.toWei('10', 'mwei');
      numTokensExchange = web3Utils.toWei('14');
      destNumeTokensExchange = web3Utils.toWei('12');
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      ExchangeSignature = generateExchangeSignature(
        sender,
        derivativeAddress,
        destPoolInstance.address,
        destPoolDerivativeInstance.address,
        numTokensExchange,
        collAmountExchange,
        destNumeTokensExchange,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      ExchangeParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        destPoolAddr: destPoolInstance.address,
        destDerivativeAddr: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        collateralAmount: collAmountExchange,
        destNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.exchange(ExchangeParameters, ExchangeSignature, {
        from: sender,
      });
    });

    it('Revert if derivative of destination pool is wrong', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      ExchangeSignature = generateExchangeSignature(
        sender,
        derivativeAddress,
        destPoolInstance.address,
        wrongDerivativeAddr,
        numTokensExchange,
        collAmountExchange,
        destNumeTokensExchange,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      ExchangeParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        destPoolAddr: destPoolInstance.address,
        destDerivativeAddr: wrongDerivativeAddr,
        numTokens: numTokensExchange,
        collateralAmount: collAmountExchange,
        destNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, ExchangeSignature, {
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
      poolPayload = encodePool(
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
      const wrongDestPoolInstance = await SynthereumPool.at(addresses.pool);
      const wrongDestPoolDerivativeInstance = await PerpetualPoolParty.at(
        addresses.derivative,
      );
      const wrongSynthTokenAddr = await wrongDestPoolDerivativeInstance.tokenCurrency.call();
      const wrongDestSynthTokenInstance = await MintableBurnableERC20.at(
        wrongSynthTokenAddr,
      );

      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      ExchangeSignature = generateExchangeSignature(
        sender,
        derivativeAddress,
        wrongDestPoolInstance.address,
        wrongDestPoolDerivativeInstance.address,
        numTokensExchange,
        collAmountExchange,
        destNumeTokensExchange,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      ExchangeParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        destPoolAddr: wrongDestPoolInstance.address,
        destDerivativeAddr: wrongDestPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        collateralAmount: collAmountExchange,
        destNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, ExchangeSignature, {
          from: sender,
        }),
        'Collateral tokens do not match',
      );
    });

    it('Revert if destination pool is not registred', async () => {
      const synthereumPoolLibInstance = await SynthereumPoolLib.deployed();
      await SynthereumPool.link(synthereumPoolLibInstance);
      const feeScaled = fee;
      feeScaled.feePercentage = {
        rawValue: web3Utils.toWei(fee.feePercentage),
      };
      const notRegistredPool = await SynthereumPool.new(
        destPoolDerivativeInstance.address,
        synthereumFinderAddress,
        poolVersion,
        roles,
        isContractAllowed,
        secondStartingCollateralization,
        feeScaled,
      );
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      ExchangeSignature = generateExchangeSignature(
        sender,
        derivativeAddress,
        notRegistredPool.address,
        destPoolDerivativeInstance.address,
        numTokensExchange,
        collAmountExchange,
        destNumeTokensExchange,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      ExchangeParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        destPoolAddr: notRegistredPool.address,
        destDerivativeAddr: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        collateralAmount: collAmountExchange,
        destNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, ExchangeSignature, {
          from: sender,
        }),
        'Destination pool not registred',
      );
      fee.feePercentage = '0.002';
    });
    it('Revert if collateral amount bigger than amount withdrawn from the derivative', async () => {
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      collAmountExchange = web3Utils.toWei('100', 'mwei');
      let ExchangeSignature = generateExchangeSignature(
        sender,
        derivativeAddress,
        destPoolInstance.address,
        destPoolDerivativeInstance.address,
        numTokensExchange,
        collAmountExchange,
        destNumeTokensExchange,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let ExchangeParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        destPoolAddr: destPoolInstance.address,
        destDerivativeAddr: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        collateralAmount: collAmountExchange,
        destNumTokens: destNumeTokensExchange,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, ExchangeSignature, {
          from: sender,
        }),
        'Collateral amount bigger than collateral in the derivative',
      );
    });
    it('Revert if collateral amount in the destination pool is not enough to cover position', async () => {
      const wrongDestTokenNumExchange = web3Utils.toWei('10000');
      nonce = (await poolInstance.getUserNonce.call(sender)).toString();
      collAmountExchange = web3Utils.toWei('39', 'mwei');
      let ExchangeSignature = generateExchangeSignature(
        sender,
        derivativeAddress,
        destPoolInstance.address,
        destPoolDerivativeInstance.address,
        numTokensExchange,
        collAmountExchange,
        wrongDestTokenNumExchange,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let ExchangeParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        destPoolAddr: destPoolInstance.address,
        destDerivativeAddr: destPoolDerivativeInstance.address,
        numTokens: numTokensExchange,
        collateralAmount: collAmountExchange,
        destNumTokens: wrongDestTokenNumExchange,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await truffleAssert.reverts(
        poolInstance.exchange(ExchangeParameters, ExchangeSignature, {
          from: sender,
        }),
        'Insufficient collateral available from Liquidity Provider',
      );
    });
  });
  describe('Deposit into derivative', async () => {
    let collateralToDeposit;
    beforeEach(async () => {
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, Signature, {
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
      poolPayload = encodePool(
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
      await poolInstance.addRoleInDerivative(
        derivativeAddress,
        1,
        secondPoolAddress,
        { from: maintainer },
      );
      const secondPoolInstance = await SynthereumPool.at(secondPoolAddress);
      await collateralInstance.allocateTo(
        secondPoolAddress,
        poolStartingDeposit,
      );
      await collateralInstance.allocateTo(sender, totCollAmount);
      await collateralInstance.approve(secondPoolAddress, totCollAmount, {
        from: sender,
      });
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        secondPoolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await secondPoolInstance.mint(MintParameters, Signature, {
        from: sender,
      });
      Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, Signature, {
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
      Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, Signature, {
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
  describe('Emergency shutdown and setlle', async () => {
    let secondCollateralAmount;
    let secondNumTokens;
    let mockOracle;
    beforeEach(async () => {
      const actualTime = parseInt(
        (await timerInstance.getCurrentTime()).toString(),
      );
      await timerInstance.setCurrentTime(actualTime + 1);
      let Signature = generateMintSignature(
        sender,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      let MintParameters = {
        sender: sender,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, Signature, {
        from: sender,
      });
      secondCollateralAmount = web3Utils.toWei('50', 'mwei');
      secondNumTokens = web3Utils.toWei('40');
      await collateralInstance.allocateTo(secondSender, collateralAmount);
      await collateralInstance.approve(poolAddress, collateralAmount, {
        from: secondSender,
      });
      Signature = generateMintSignature(
        secondSender,
        derivativeAddress,
        secondCollateralAmount,
        secondNumTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      MintParameters = {
        sender: secondSender,
        derivativeAddr: derivativeAddress,
        collateralAmount: secondCollateralAmount,
        numTokens: secondNumTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      await poolInstance.mint(MintParameters, Signature, {
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

      await poolInstance.emergencyShutdown(derivativeAddress, {
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
      const senderCheckCollateral = parseInt(
        web3Utils.toWei('130', 'mwei').toString(),
      );
      const secondSenderCheckCollateral = parseInt(
        web3Utils.toWei('52', 'mwei').toString(),
      );
      const LpCheckCollateral = parseInt(
        web3Utils.toWei('28', 'mwei').toString(),
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
      poolPayload = encodePool(
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
      poolPayload = encodePool(
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
    it('Can add admin', async () => {
      await poolInstance.addRoleInDerivative(derivativeAddress, 0, newAdmin, {
        from: maintainer,
      });
      const isAdmin = await derivativeInstance.hasRole.call('0x00', newAdmin);
      const isPool = await derivativeInstance.hasRole.call(
        web3Utils.soliditySha3('Pool'),
        newAdmin,
      );
      assert.equal(isAdmin, true, 'Wrong admin');
      assert.equal(isPool, false, 'Wrong pool');
    });
    it('Can add pool', async () => {
      const pool = await deployerInstance.deployOnlyPool.call(
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

      await poolInstance.addRoleInDerivative(derivativeAddress, 1, pool, {
        from: maintainer,
      });
      const isAdmin = await derivativeInstance.hasRole.call('0x00', pool);
      const isPool = await derivativeInstance.hasRole.call(
        web3Utils.soliditySha3('Pool'),
        pool,
      );
      assert.equal(isAdmin, false, 'Wrong admin');
      assert.equal(isPool, true, 'Wrong pool');
    });
    it('Can add admin and pool', async () => {
      const pool = await deployerInstance.deployOnlyPool.call(
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

      await poolInstance.addRoleInDerivative(derivativeAddress, 2, pool, {
        from: maintainer,
      });
      const isAdmin = await derivativeInstance.hasRole.call('0x00', pool);
      const isPool = await derivativeInstance.hasRole.call(
        web3Utils.soliditySha3('Pool'),
        pool,
      );
      assert.equal(isAdmin, true, 'Wrong admin');
      assert.equal(isPool, true, 'Wrong pool');
    });
    it('Revert if adding in a derivative a pool with different collateral', async () => {
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
      poolPayload = encodePool(
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
        poolInstance.addRoleInDerivative(derivativeAddress, 2, addresses.pool, {
          from: maintainer,
        }),
        'Collateral tokens do not match',
      );
    });
    it('Revert if adding in a derivative a pool with different synthetic token', async () => {
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
      poolPayload = encodePool(
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
        poolInstance.addRoleInDerivative(derivativeAddress, 2, addresses.pool, {
          from: maintainer,
        }),
        'Synthetic tokens do not match',
      );
    });
    it('Renounce admin', async () => {
      await poolInstance.renounceRoleInDerivative(derivativeAddress, 0, {
        from: maintainer,
      });
      const isAdmin = await derivativeInstance.hasRole.call(
        '0x00',
        poolAddress,
      );
      const isPool = await derivativeInstance.hasRole.call(
        web3Utils.soliditySha3('Pool'),
        poolAddress,
      );
      assert.equal(isAdmin, false, 'Wrong admin');
      assert.equal(isPool, true, 'Wrong pool');
    });
    it('Renounce pool', async () => {
      await poolInstance.renounceRoleInDerivative(derivativeAddress, 1, {
        from: maintainer,
      });
      const isAdmin = await derivativeInstance.hasRole.call(
        '0x00',
        poolAddress,
      );
      const isPool = await derivativeInstance.hasRole.call(
        web3Utils.soliditySha3('Pool'),
        poolAddress,
      );
      assert.equal(isAdmin, true, 'Wrong admin');
      assert.equal(isPool, false, 'Wrong pool');
    });
    it('Renounce admin and pool', async () => {
      await poolInstance.renounceRoleInDerivative(derivativeAddress, 2, {
        from: maintainer,
      });
      const isAdmin = await derivativeInstance.hasRole.call(
        '0x00',
        poolAddress,
      );
      const isPool = await derivativeInstance.hasRole.call(
        web3Utils.soliditySha3('Pool'),
        poolAddress,
      );
      assert.equal(isAdmin, false, 'Wrong admin');
      assert.equal(isPool, false, 'Wrong pool');
    });
  });
  describe('Roles of synthetic token managment', async () => {
    let newDerivative;
    beforeEach(async () => {
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
      newDerivative = await deployerInstance.deployOnlyDerivative.call(
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
      await poolInstance.addDerivative(newDerivative, {
        from: maintainer,
      });
    });

    it('Add new admin', async () => {
      await poolInstance.addRoleInSynthToken(derivativeAddress, 0, newAdmin, {
        from: maintainer,
      });
      const isAdmin = await synthTokenInstance.hasRole('0x00', newAdmin);
      const isMinter = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Minter'),
        newAdmin,
      );
      const isBurner = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Burner'),
        newAdmin,
      );
      assert.equal(isAdmin, true, 'Wrong admin');
      assert.equal(isMinter, false, 'Wrong minter');
      assert.equal(isBurner, false, 'Wrong burner');
    });
    it('Add derivative as minter', async () => {
      await poolInstance.addRoleInSynthToken(
        derivativeAddress,
        1,
        newDerivative,
        { from: maintainer },
      );
      const isAdmin = await synthTokenInstance.hasRole('0x00', newDerivative);
      const isMinter = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Minter'),
        newDerivative,
      );
      const isBurner = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Burner'),
        newDerivative,
      );
      assert.equal(isAdmin, false, 'Wrong admin');
      assert.equal(isMinter, true, 'Wrong minter');
      assert.equal(isBurner, false, 'Wrong burner');
    });
    it('Add derivative as burner', async () => {
      await poolInstance.addRoleInSynthToken(
        derivativeAddress,
        2,
        newDerivative,
        { from: maintainer },
      );
      const isAdmin = await synthTokenInstance.hasRole('0x00', newDerivative);
      const isMinter = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Minter'),
        newDerivative,
      );
      const isBurner = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Burner'),
        newDerivative,
      );
      assert.equal(isAdmin, false, 'Wrong admin');
      assert.equal(isMinter, false, 'Wrong minter');
      assert.equal(isBurner, true, 'Wrong burner');
    });
    it('Add derivative as admin, minter and burner', async () => {
      await poolInstance.addRoleInSynthToken(
        derivativeAddress,
        3,
        newDerivative,
        { from: maintainer },
      );
      const isAdmin = await synthTokenInstance.hasRole('0x00', newDerivative);
      const isMinter = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Minter'),
        newDerivative,
      );
      const isBurner = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Burner'),
        newDerivative,
      );
      assert.equal(isAdmin, true, 'Wrong admin');
      assert.equal(isMinter, true, 'Wrong minter');
      assert.equal(isBurner, true, 'Wrong burner');
    });
    it('Revert if synthetic token is different', async () => {
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
      poolPayload = encodePool(
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
        poolInstance.addRoleInSynthToken(
          derivativeAddress,
          1,
          addresses.derivative,
          { from: maintainer },
        ),
        'Synthetic tokens do not match',
      );
      await truffleAssert.reverts(
        poolInstance.addRoleInSynthToken(
          derivativeAddress,
          2,
          addresses.derivative,
          { from: maintainer },
        ),
        'Synthetic tokens do not match',
      );
      await truffleAssert.reverts(
        poolInstance.addRoleInSynthToken(
          derivativeAddress,
          3,
          addresses.derivative,
          { from: maintainer },
        ),
        'Synthetic tokens do not match',
      );
    });
    it('Renounce admin', async () => {
      await poolInstance.renounceRoleInSynthToken(derivativeAddress, 0, {
        from: maintainer,
      });
      const isAdmin = await synthTokenInstance.hasRole(
        '0x00',
        derivativeAddress,
      );
      const isMinter = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Minter'),
        derivativeAddress,
      );
      const isBurner = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Burner'),
        derivativeAddress,
      );
      assert.equal(isAdmin, false, 'Wrong admin');
      assert.equal(isMinter, true, 'Wrong minter');
      assert.equal(isBurner, true, 'Wrong burner');
    });
    it('Renounce minter', async () => {
      await poolInstance.renounceRoleInSynthToken(derivativeAddress, 1, {
        from: maintainer,
      });
      const isAdmin = await synthTokenInstance.hasRole(
        '0x00',
        derivativeAddress,
      );
      const isMinter = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Minter'),
        derivativeAddress,
      );
      const isBurner = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Burner'),
        derivativeAddress,
      );
      assert.equal(isAdmin, true, 'Wrong admin');
      assert.equal(isMinter, false, 'Wrong minter');
      assert.equal(isBurner, true, 'Wrong burner');
    });
    it('Renounce burner', async () => {
      await poolInstance.renounceRoleInSynthToken(derivativeAddress, 2, {
        from: maintainer,
      });
      const isAdmin = await synthTokenInstance.hasRole(
        '0x00',
        derivativeAddress,
      );
      const isMinter = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Minter'),
        derivativeAddress,
      );
      const isBurner = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Burner'),
        derivativeAddress,
      );
      assert.equal(isAdmin, true, 'Wrong admin');
      assert.equal(isMinter, true, 'Wrong minter');
      assert.equal(isBurner, false, 'Wrong burner');
    });
    it('Renounce admin, burner and minter', async () => {
      await poolInstance.renounceRoleInSynthToken(derivativeAddress, 3, {
        from: maintainer,
      });
      const isAdmin = await synthTokenInstance.hasRole(
        '0x00',
        derivativeAddress,
      );
      const isMinter = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Minter'),
        derivativeAddress,
      );
      const isBurner = await synthTokenInstance.hasRole(
        web3Utils.soliditySha3('Burner'),
        derivativeAddress,
      );
      assert.equal(isAdmin, false, 'Wrong admin');
      assert.equal(isMinter, false, 'Wrong minter');
      assert.equal(isBurner, false, 'Wrong burner');
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
  describe('Check if metasignature are allowed to contracts', async () => {
    let proxyContract;
    let proxyMintParams;
    let proxySignature;
    let testAmount = web3Utils.toWei('1000', 'mwei');
    beforeEach(async () => {
      proxyContract = await ContractAllowed.new(
        poolAddress,
        collateralInstance.address,
      );
      proxyMintParams = {
        sender: proxyContract.address,
        derivativeAddr: derivativeAddress,
        collateralAmount: collateralAmount,
        numTokens: numTokens,
        feePercentage: feePercentageWei,
        nonce: nonce,
        expiration: expiration,
      };
      proxySignature = generateMintSignature(
        proxyContract.address,
        derivativeAddress,
        collateralAmount,
        numTokens,
        feePercentageWei,
        nonce,
        expiration,
        networkId,
        poolAddress,
        version,
        validatorPrivKey,
      );
      await collateralInstance.allocateTo(proxyContract.address, testAmount);
    });
    it('Revert if contracts are not allowed ', async () => {
      await truffleAssert.reverts(
        proxyContract.mintInPool(proxyMintParams, proxySignature, testAmount),
        'Account must be an EOA',
      );
    });
    it('Check success if contract is allowed ', async () => {
      const prevStatus = await poolInstance.isContractAllowed.call();
      assert.equal(prevStatus, false, 'Wrong previous status');
      await poolInstance.setIsContractAllowed(true, { from: maintainer });
      const actualStatus = await poolInstance.isContractAllowed.call();
      assert.equal(actualStatus, true, 'Wrong actual status');
      await proxyContract.mintInPool(
        proxyMintParams,
        proxySignature,
        testAmount,
      );
    });
    it('Revert if set the same status ', async () => {
      await truffleAssert.reverts(
        poolInstance.setIsContractAllowed(false, { from: maintainer }),
        'Contract flag already set',
      );
    });
  });
});
