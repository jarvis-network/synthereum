const TICFactory = artifacts.require("TICFactory");
const TIC = artifacts.require("TIC");
const IERC20 = artifacts.require("IERC20");
const ExpiringMultiParty = artifacts.require("ExpiringMultiParty");
const Finder = artifacts.require("Finder");
const MockOracle = artifacts.require("MockOracle");

const web3Utils = require("web3-utils");

const contracts = require("../contract-dependencies.json");
const assets = require("../synthetic-assets.json");
const ticConfig = require("../tic-config.json");

module.exports = {
  createOracle: async networkId => {
    const { identifierWhitelist } = contracts[networkId];
    return await MockOracle.new(identifierWhitelist);
  },

  createFinder: async (networkId, mockOracleAddress) => {
    const { identifierWhitelist, storeAddress } = contracts[networkId];

    const finder = await Finder.new();

    const mockOracleInterfaceName = web3Utils.toHex("Oracle");
    await finder.changeImplementationAddress(mockOracleInterfaceName, mockOracleAddress);

    const identifierWhitelistInterfaceName = web3Utils.toHex("IdentifierWhitelist");
    await finder.changeImplementationAddress(
      identifierWhitelistInterfaceName,
      identifierWhitelist
    );

    const storeInterfaceName = web3Utils.toHex("Store");
    await finder.changeImplementationAddress(storeInterfaceName, storeAddress);

    return finder;
  },

  createDerivative: async (networkId, finderAddress, blocktime) => {
    const isTest = false;
    const withdrawalLiveness = 3600;
    const liquidationLiveness = 3600;

    const { collateralAddress, tokenFactoryAddress } = contracts[networkId];

    const {
      priceFeedIdentifier,
      syntheticName,
      syntheticSymbol,
      collateralRequirement,
    } = assets[0];

    const priceFeedIdentifierHex = web3Utils.toHex(priceFeedIdentifier);

    const {
      disputeBondPct,
      sponsorDisputeRewardPct,
      disputerDisputeRewardPct
    } = ticConfig;

    const expirationTimestamp = blocktime + 2628000;

    const params = {
      isTest,
      finderAddress,
      tokenFactoryAddress,
      withdrawalLiveness,
      liquidationLiveness,
      collateralAddress,
      priceFeedIdentifier: priceFeedIdentifierHex,
      syntheticName,
      syntheticSymbol,
      collateralRequirement,
      expirationTimestamp,
      disputeBondPct,
      sponsorDisputeRewardPct,
      disputerDisputeRewardPct
    };

    return await ExpiringMultiParty.new(params);
  },

  createTIC: async (derivativeAddress, protocolOwner, liquidityProvider) => {
    const { startingCollateralization } = assets[0];

    const fee = {
      "mintFee": { "rawValue": web3Utils.toWei("0.001") },
      "mintFeeRecipients": [protocolOwner, liquidityProvider],
      "mintFeeProportions": [50, 50],
      "interestFeeRecipients": [protocolOwner, liquidityProvider],
      "interestFeeProportions": [10, 90]
    };

    return await TIC.new(
      derivativeAddress,
      liquidityProvider,
      liquidityProvider,
      startingCollateralization,
      fee
    );
  },

  depositLPCollateral: async (tic, collateralToken, account, collateralAmount) => {
    const lpCollateral = web3Utils.toWei(collateralAmount);
    await collateralToken.approve(tic.address, lpCollateral, { from: account });
    await tic.deposit(lpCollateral, { from: account });
  },

  createMintRequest: async (tic, collateralToken, account, collateralAmount, numTokens) => {
    const userCollateral = web3Utils.toWei(collateralAmount);
    const mintFee = web3Utils.toBN(await tic.calculateMintFee(userCollateral));

    const totalCollateral = web3Utils.toBN(userCollateral).add(mintFee).toString();
    await collateralToken.approve(tic.address, totalCollateral, { from: account });

    const numTokensWei = web3Utils.toWei(numTokens);
    await tic.mintRequest(userCollateral, numTokensWei, { from: account });
  },

  approveMintRequests: async (tic, account) => {
    const mintRequests = await tic.getMintRequests({ from: account });
    await Promise.all(mintRequests.map(mintRequest => {
      return tic.approveMint(mintRequest["mintID"], { from: account });
    }));
  },

  rejectMintRequests: async (tic, account) => {
    const mintRequests = await tic.getMintRequests({ from: account });
    await Promise.all(mintRequests.map(mintRequest => {
      return tic.rejectMint(mintRequest["mintID"], { from: account });
    }));
  },

  createRedeemRequest: async (tic, syntheticToken, account, collateralAmount, numTokens) => {
    const userCollateral = web3Utils.toWei(collateralAmount);
    await syntheticToken.approve(tic.address, userCollateral, { from: account });

    const numTokensWei = web3Utils.toWei(numTokens);
    await tic.redeemRequest(userCollateral, numTokensWei, { from: account });
  },

  approveRedeemRequests: async (tic, account) => {
    const redeemRequests = await tic.getRedeemRequests({ from: account });
    await Promise.all(redeemRequests.map(redeemRequest => {
      return tic.approveRedeem(redeemRequest["redeemID"], { from: account });
    }));
  },

  rejectRedeemRequests: async (tic, account) => {
    const redeemRequests = await tic.getRedeemRequests({ from: account });
    await Promise.all(redeemRequests.map(redeemRequest => {
      return tic.rejectRedeem(redeemRequest["redeemID"], { from: account });
    }));
  },

  createExchangeRequest: async (
    tic,
    syntheticToken,
    account,
    destTIC,
    numTokens,
    destNumTokens
  ) => {
    const numTokensWei = web3Utils.toWei(numTokens);
    const destNumTokensWei = web3Utils.toWei(destNumTokens);
    await syntheticToken.approve(tic.address, numTokensWei, { from: account });
    await tic.exchangeRequest(destTIC.address, numTokensWei, destNumTokensWei, { from: account });
  },

  approveExchangeRequests: async (tic, account) => {
    const exchangeRequests = await tic.getExchangeRequests({ from: account });
    await Promise.all(exchangeRequests.map(exchangeRequest => {
      return tic.approveExchange(exchangeRequest["exchangeID"], { from: account });
    }));
  },

  rejectExchangeRequests: async (tic, account) => {
    const exchangeRequests = await tic.getExchangeRequests({ from: account });
    await Promise.all(exchangeRequests.map(exchangeRequest => {
      return tic.rejectExchange(exchangeRequest["exchangeID"], { from: account });
    }));
  },

  expireAtPrice: async (derivative, mockOracle, price) => {
    await derivative.expire();

    const queries = await mockOracle.getPendingQueries();
    const priceWei = web3Utils.toWei(price);
    await mockOracle.pushPrice(queries[0]["identifier"], queries[0]["time"], priceWei);
  },

  settleExpired: async (tic, syntheticToken, account, syntheticBalance) => {
    await syntheticToken.approve(tic.address, syntheticBalance, { from: account });
    await tic.settleExpired({ from: account });
  },

  calculateTokenValue: (numTokens, price) => {
    return web3Utils.toBN(numTokens)
      .mul(web3Utils.toBN(web3Utils.toWei(price)))
      .div(web3Utils.toBN(web3Utils.toWei("1")));
  }
};
