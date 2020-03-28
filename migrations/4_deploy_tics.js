const web3Utils = require("web3-utils");

const config = require("../truffle-config.js");
const contracts = require("../contract-dependencies.json");
const assets = require("../synthetic-assets.json");
const TICConfig = require("../TIC-config.json");

var TICFactory = artifacts.require("TICFactory");
var ChainlinkPriceFeed = artifacts.require("./ChainlinkPriceFeed.sol");

module.exports = function(deployer, network, accounts) {
  const provider = accounts[0]; // Whoever the liquidity provider should be

  const networkId = config.networks[network.replace(/-fork$/, "")].network_id;

  // Kovan UMA Return Calculator address
  returnCalculator = contracts[networkId]["returnCalculator"];
  // Kovan rDAI address
  marginCurrency = contracts[networkId]["marginCurrency"];

  let params = {
    defaultPenalty: TICConfig["defaultPenalty"],
    supportedMove: TICConfig["supportedMove"],
    fixedYearlyFee: TICConfig["fixedYearlyFee"],
    withdrawLimit: TICConfig["withdrawLimit"],
    disputeDeposit: TICConfig["disputeDeposit"],
    expiry: TICConfig["expiry"],
    returnType: TICConfig["returnType"],
    returnCalculator,
    marginCurrency
  };

  console.log("\n");

  for (let asset of assets) {
    const identifier = web3Utils.toHex(asset.identifier);

    console.log(`   Deploying '${asset.symbol}'`);

    deployer
      .then(() => ChainlinkPriceFeed.deployed())
      .then(async feed => {
        const price = await feed.latestPrice(identifier);
        return price;
      })
      .then(async latestPrice => {
        const price = latestPrice.price.toString();
        params.startingTokenPrice = price;
        params.startingUnderlyingPrice = price;

        params.product = identifier;
        params.priceFeedAddress = ChainlinkPriceFeed.address;
        params.name = asset.name;
        params.symbol = asset.symbol;

        const factory = await TICFactory.deployed();
        return await factory.createTIC(params, provider);
      })
      .catch(err => console.log(err));
  }
};
