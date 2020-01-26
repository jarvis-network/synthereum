const web3Utils = require("web3-utils");
var TIC = artifacts.require("TIC");
var ProvablePriceFeed = artifacts.require("./ProvablePriceFeed.sol");

module.exports = function(deployer, network, accounts) {
  const identifier = web3Utils.toHex("EUR/USD");

  deployer
    .then(() => ProvablePriceFeed.deployed())
    .then(feed => feed.latestPrice(identifier))
    .then(latestPrice => {
      const price = latestPrice.price.toString();

      let params = {};
      let TDCreator = "";
      let marginCurrency = "";
      let provider = accounts[0]; // Whoever the liquidity provider should be

      // kovan fork is used by truffle migration dry-run
      if (network === "kovan-fork" || network === "kovan") {
        TDCreator = "0xad7c5516b25661e0A204646b08024cD82ffe6C48";
        const withdrawLimit = "1000000000000000000000000000000000000";
        const returnCalculator = "0xad8fD1f418FB860A383c9D4647880af7f043Ef39";
        // Kovan rDAI address
        marginCurrency = "0x462303f77a3f17Dbd95eb7bab412FE4937F9B9CB";

        params = {
          priceFeedAddress: ProvablePriceFeed.address,
          defaultPenalty: web3Utils.toWei("1", "ether"),
          supportedMove: web3Utils.toWei("0.2", "ether"),
          product: identifier,
          fixedYearlyFee: "0",
          withdrawLimit,
          disputeDeposit: web3Utils.toWei("1", "ether"),
          returnCalculator,
          startingTokenPrice: price,
          expiry: 0, // Temporarily set no expiry
          marginCurrency,
          returnType: "0", // Linear
          startingUnderlyingPrice: price,
          name: "SynEuro",
          symbol: "synEUR"
        }
      }

      return deployer.deploy(TIC, TDCreator, params, marginCurrency, provider);
    })
    .catch(err => console.log(err));
};
