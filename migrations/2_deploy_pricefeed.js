const web3Utils = require("web3-utils");
const config = require("../truffle-config.js");
const assets = require("../synthetic-assets.json");
const aggregators = require("../chainlink-aggregators.json");
var ChainlinkPriceFeed = artifacts.require("ChainlinkPriceFeed");

module.exports = function(deployer, network, accounts) {
  const networkId = config.networks[network.replace(/-fork$/, "")].network_id;

  deployer.deploy(ChainlinkPriceFeed)
    .then(() => ChainlinkPriceFeed.deployed())
    .then(feed => {
      return Promise.all(assets.map(asset => {
        const aggregator = aggregators[networkId][asset.identifier];
        const identifier = web3Utils.toHex(asset.identifier);

        return feed.addAggregator(identifier, aggregator);
      }));
    })
    .catch(err => console.log(err));
};
