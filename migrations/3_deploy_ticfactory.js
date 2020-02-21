const { constants } = require("@openzeppelin/test-helpers");
var TICFactory = artifacts.require("TICFactory");

module.exports = function(deployer, network) {
  let TDCreatorAddr = constants.ZERO_ADDRESS;

  if (
    network === "develop-fork"
    || network === "develop-fork-fork"
    || network === "kovan-fork"
    || network === "kovan"
  ) {
    TDCreatorAddr = "0xad7c5516b25661e0A204646b08024cD82ffe6C48";
  }

  deployer.deploy(TICFactory, TDCreatorAddr);
};
