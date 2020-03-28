const web3Utils = require("web3-utils");
const { constants } = require("@openzeppelin/test-helpers");

const assets = require("../synthetic-assets.json");

var TICFactory = artifacts.require("TICFactory");
var ChainlinkPriceFeed = artifacts.require("./ChainlinkPriceFeed.sol");

module.exports = function(deployer, network, accounts) {
  const supportedMove = web3Utils.toWei("0.1", "ether");
  const withdrawLimit = "1000000000000000000000000000000000000";
  const provider = accounts[0]; // Whoever the liquidity provider should be


  let networkId = "*";
  let marginCurrency = constants.ZERO_ADDRESS;
  let returnCalculator = constants.ZERO_ADDRESS;

  if (
    network === "develop-fork"
    || network === "develop-fork-fork"
    || network === "kovan-fork"
    || network === "kovan"
  ) {
    networkId = "42";
    // Kovan UMA Return Calculator address
    returnCalculator = "0xad8fD1f418FB860A383c9D4647880af7f043Ef39";
    // Kovan rDAI address
    marginCurrency = "0x462303f77a3f17Dbd95eb7bab412FE4937F9B9CB";
  }

  let params = {
    defaultPenalty: web3Utils.toWei("1", "ether"),
    supportedMove,
    fixedYearlyFee: "0",
    withdrawLimit,
    disputeDeposit: web3Utils.toWei("1", "ether"),
    expiry: 0, // Temporarily set no expiry
    returnType: "0", // Linear
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
