const web3Utils = require("web3-utils");
const { constants } = require("@openzeppelin/test-helpers");
var ChainlinkPriceFeed = artifacts.require("ChainlinkPriceFeed");

module.exports = function(deployer, network, accounts) {
  const identifier = web3Utils.toHex("EUR/USD");
  let eurAggregator = constants.ZERO_ADDRESS;

  if (network === "kovan" || network === "kovan-fork") {
    eurAggregator = "0xf23CCdA8333f658c43E7fC19aa00f6F5722eB225";
  }

  deployer.deploy(ChainlinkPriceFeed)
    .then(() => ChainlinkPriceFeed.deployed())
    .then(feed => feed.addAggregator(identifier, eurAggregator));
};
