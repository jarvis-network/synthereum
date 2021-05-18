//helper scripts
const { interfaceName } = require('@jarvis-network/uma-common');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
} = require('../../utils/encoding.js');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
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
const PriceFeedGetter = artifacts.require('PriceFeedGetter');

contract('Synthereum chainlink price feed', function (accounts) {
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
  let newAggregatorAddress = accounts[4];
  let secondNewAggregatorAddress = accounts[5];
  let newAggregatorIdentifier = web3Utils.toHex('TEST/USD');
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
  let priceFeedId;
  beforeEach(async () => {
    priceFeedInstance = await ChainlinkPriceFeed.deployed();
    aggregator = await MockV3Aggregator.deployed();
    checkingPrice = web3Utils.toWei('1.2');
    priceFeedId = web3Utils.toHex('EUR/USD');
  });
  describe('Aggregators managment', async () => {
    it('Add aggregator', async () => {
      const addAggregatortTx = await priceFeedInstance.setAggregator(
        newAggregatorIdentifier,
        newAggregatorAddress,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(addAggregatortTx, 'SetAggregator', ev => {
        return (
          ev.priceIdentifier ==
            web3Utils.padRight(newAggregatorIdentifier, 64) &&
          ev.aggregator == newAggregatorAddress
        );
      });
      await priceFeedInstance.removeAggregator(newAggregatorIdentifier, {
        from: maintainer,
      });
    });
    it('Update aggregator', async () => {
      await priceFeedInstance.setAggregator(
        newAggregatorIdentifier,
        newAggregatorAddress,
        { from: maintainer },
      );
      const updateAggregatortTx = await priceFeedInstance.setAggregator(
        newAggregatorIdentifier,
        secondNewAggregatorAddress,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(updateAggregatortTx, 'SetAggregator', ev => {
        return (
          ev.priceIdentifier ==
            web3Utils.padRight(newAggregatorIdentifier, 64) &&
          ev.aggregator == secondNewAggregatorAddress
        );
      });
      await priceFeedInstance.removeAggregator(newAggregatorIdentifier, {
        from: maintainer,
      });
    });
    it('Revert if the the aggregator of an existing identifier has same address', async () => {
      const addAggregatortTx = await priceFeedInstance.setAggregator(
        newAggregatorIdentifier,
        newAggregatorAddress,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        priceFeedInstance.setAggregator(
          newAggregatorIdentifier,
          newAggregatorAddress,
          { from: maintainer },
        ),
        'Aggregator address is the same',
      );
      await priceFeedInstance.removeAggregator(newAggregatorIdentifier, {
        from: maintainer,
      });
    });
    it('Revert if the transaction for setting the aggregator is not sent by the maintainer', async () => {
      await truffleAssert.reverts(
        priceFeedInstance.setAggregator(
          newAggregatorIdentifier,
          newAggregatorAddress,
          { from: sender },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Remove aggregator', async () => {
      const addAggregatortTx = await priceFeedInstance.setAggregator(
        newAggregatorIdentifier,
        newAggregatorAddress,
        { from: maintainer },
      );
      const removeAggregatorTx = await priceFeedInstance.removeAggregator(
        newAggregatorIdentifier,
        { from: maintainer },
      );
      truffleAssert.eventEmitted(removeAggregatorTx, 'RemoveAggregator', ev => {
        return (
          ev.priceIdentifier == web3Utils.padRight(newAggregatorIdentifier, 64)
        );
      });
    });
    it('Revert if remove a non existing aggregator', async () => {
      await truffleAssert.reverts(
        priceFeedInstance.removeAggregator(newAggregatorIdentifier, {
          from: maintainer,
        }),
        'Price identifier does not exist',
      );
    });
    it('Revert if the transaction for remove the aggregator is not sent by the maintainer', async () => {
      await priceFeedInstance.setAggregator(
        newAggregatorIdentifier,
        newAggregatorAddress,
        { from: maintainer },
      );
      await truffleAssert.reverts(
        priceFeedInstance.removeAggregator(newAggregatorIdentifier, {
          from: sender,
        }),
        'Sender must be the maintainer',
      );
      await priceFeedInstance.removeAggregator(newAggregatorIdentifier, {
        from: maintainer,
      });
    });
    it('Check get aggreagtor view function', async () => {
      await priceFeedInstance.setAggregator(
        newAggregatorIdentifier,
        newAggregatorAddress,
        { from: maintainer },
      );
      const aggregator = await priceFeedInstance.getAggregator.call(
        newAggregatorIdentifier,
      );
      newAggregatorAddress,
        assert.equal(
          newAggregatorAddress,
          aggregator,
          'Wrong aggregator address',
        );
      await priceFeedInstance.removeAggregator(newAggregatorIdentifier, {
        from: maintainer,
      });
    });
    it('Revert if get aggregator does not find aggregator', async () => {
      await truffleAssert.reverts(
        priceFeedInstance.getAggregator(newAggregatorIdentifier, {
          from: sender,
        }),
        'Price identifier does not exist',
      );
    });
  });
  describe('Price feed access', async () => {
    it('Price can be get by an EOA (off-chain)', async () => {
      await priceFeedInstance.getLatestPrice.call(priceFeedId);
    });
    it('Price can be get by a synthereum pool', async () => {
      collateralAddress = (await TestnetERC20.deployed()).address;
      deployerInstance = await SynthereumDeployer.deployed();
      derivativeAdmins = [deployerInstance.address];
      derivativePools = [];
      poolVersion = 4;
      let admin = accounts[0];
      let maintainer = accounts[1];
      let liquidityProvider = accounts[2];
      let roles = {
        admin,
        maintainer,
        liquidityProvider,
      };
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
      derivat = await Derivative.at(derivativeAddress);
      expiration = (await web3.eth.getBlock('latest')).timestamp + 60;
      collateralAmount = web3Utils.toWei('120', 'mwei');
      numTokens = web3Utils.toWei('99.8');
      let MintParameters = {
        derivative: derivativeAddress,
        minNumTokens: numTokens,
        collateralAmount: collateralAmount,
        feePercentage: feePercentageWei,
        expiration: expiration,
        recipient: sender,
      };
      collateralInstance = await TestnetERC20.deployed();
      await collateralInstance.allocateTo(poolAddress, poolStartingDeposit);
      await collateralInstance.allocateTo(sender, collateralAmount);
      await collateralInstance.approve(poolAddress, collateralAmount, {
        from: sender,
      });
      const mintTx = await poolInstance.mint(MintParameters, {
        from: sender,
      });
    });
    it('Revert if price getter is called by a contract that is not a pool', async () => {
      const proxyPriceContract = await PriceFeedGetter.new(
        priceFeedInstance.address,
        'jEUR',
        collateralAddress,
        3,
      );
      await truffleAssert.reverts(
        proxyPriceContract.getPrice.call(priceFeedId),
        'Pool not registred',
      );
    });
  });
  describe('Check price and data getters', async () => {
    beforeEach(async () => {
      let prevAnswer;
      let prevAnswerUnscaled;
      let prevTimestamp;
      let prevRound;
    });
    it('Check latest price', async () => {
      const price = (
        await priceFeedInstance.getLatestPrice.call(priceFeedId)
      ).toString();
      assert.equal(price, checkingPrice, 'Wrong price getter');
    });
    it('Check latest data', async () => {
      newAnswer = web3Utils.toWei('130', 'mwei');
      const updateTx = await aggregator.updateAnswer(newAnswer);
      txTimestamp = (await web3.eth.getBlock(updateTx.receipt.blockNumber))
        .timestamp;
      const data = await priceFeedInstance.getOracleLatestData.call(
        priceFeedId,
      );
      assert.equal(data.startedAt, txTimestamp, 'Wrong starting time');
      assert.equal(data.updatedAt, txTimestamp, 'Wrong updating time');
      assert.equal(data.answer, newAnswer, 'Wrong answer');
      assert.equal(data.roundId, 2, 'Wrong round');
      assert.equal(data.answeredInRound, 2, 'Wrong answer in round');
      assert.equal(data.decimals, 8, 'Wrong decimals');
      prevAnswer = web3Utils.toWei('1.30');
      prevAnswerUnscaled = newAnswer;
      prevTimestamp = txTimestamp;
      prevRound = 2;
    });
    it('Check previous round price', async () => {
      const newAnswer = web3Utils.toWei('140', 'mwei');
      const updateTx = await aggregator.updateAnswer(newAnswer);
      const price = (
        await priceFeedInstance.getRoundPrice.call(priceFeedId, prevRound)
      ).toString();
      assert.equal(price, prevAnswer, 'Wrong previous price getter');
    });
    it('Check previous round data', async () => {
      const newAnswer = web3Utils.toWei('150', 'mwei');
      const updateTx = await aggregator.updateAnswer(newAnswer);
      const prevData = await priceFeedInstance.getOracleRoundData.call(
        priceFeedId,
        prevRound,
      );
      assert.equal(
        prevData.startedAt,
        prevTimestamp,
        'Wrong previous starting time',
      );
      assert.equal(
        prevData.updatedAt,
        prevTimestamp,
        'Wrong previous updating time',
      );
      assert.equal(
        prevData.answer,
        prevAnswerUnscaled,
        'Wrong previous answer',
      );
      assert.equal(prevData.roundId, 2, 'Wrong previous round');
      assert.equal(
        prevData.answeredInRound,
        2,
        'Wrong previous answer in round',
      );
      assert.equal(prevData.decimals, 8, 'Wrong previous decimals');
    });
    it('Revert if oracle price of aggregator is negative or null', async () => {
      let newAnswer = web3Utils.toWei('-140', 'mwei');
      const updateTx = await aggregator.updateAnswer(newAnswer);
      await truffleAssert.reverts(
        priceFeedInstance.getLatestPrice.call(priceFeedId),
        'Negative value',
      );
      newAnswer = web3Utils.toWei('0', 'mwei');
      await truffleAssert.reverts(
        priceFeedInstance.getLatestPrice.call(priceFeedId),
        'Negative value',
      );
    });
  });
});
