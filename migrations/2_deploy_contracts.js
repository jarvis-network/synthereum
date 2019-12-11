var ProvablePriceFeed = artifacts.require("./ProvablePriceFeed.sol");

module.exports = function(deployer) {
  deployer.deploy(ProvablePriceFeed, true);
};
