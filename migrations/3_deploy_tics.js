const web3Utils = require("web3-utils");

const config = require("../truffle-config.js");
const contracts = require("../contract-dependencies.json");
const assets = require("../synthetic-assets.json");
const TICConfig = require("../TIC-config.json");

var TICFactory = artifacts.require("TICFactory");

module.exports = function(deployer, network, accounts) {
  const liquidityProvider = accounts[0]; // Whoever the liquidity provider should be

  const networkId = config.networks[network.replace(/-fork$/, "")].network_id;

  // Kovan rDAI address
  collateralAddress = contracts[networkId]["collateralAddress"];

  console.log("\n");

  const deployments = Promise.all(assets.map(async asset => {
    console.log(`   Deploying '${asset.syntheticSymbol}'`);

    let params = { ...TICConfig, collateralAddress, ...asset };
    params.priceFeedIdentifier = web3Utils.toHex(asset.priceFeedIdentifier);

    const factory = await TICFactory.deployed();
    return await factory.createTIC(params, liquidityProvider);
  }));

  deployer.then(() => deployments).catch(err => console.log(err));
};
