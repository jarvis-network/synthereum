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

      let TDCreatorAddr = "";
      let marginCurrency = "";
      let returnCalculator = "";

      const supportedMove = web3Utils.toWei("0.2", "ether");
      const provider = accounts[0]; // Whoever the liquidity provider should be
      const withdrawLimit = "1000000000000000000000000000000000000";

      let params = {
          priceFeedAddress: ProvablePriceFeed.address,
          defaultPenalty: web3Utils.toWei("1", "ether"),
          supportedMove,
          product: identifier,
          fixedYearlyFee: "0",
          withdrawLimit,
          disputeDeposit: web3Utils.toWei("1", "ether"),
          startingTokenPrice: price,
          expiry: 0, // Temporarily set no expiry
          returnType: "0", // Linear
          startingUnderlyingPrice: price,
          name: "SynEuro",
          symbol: "synEUR"
      };

      if (
        network === "develop-fork"
        || network === "develop-fork-fork"
        || network === "kovan-fork"
        || network === "kovan"
      ) {
        TDCreatorAddr = "0xad7c5516b25661e0A204646b08024cD82ffe6C48";
        returnCalculator = "0xad8fD1f418FB860A383c9D4647880af7f043Ef39";

        // Kovan rDAI address
        marginCurrency = "0x462303f77a3f17Dbd95eb7bab412FE4937F9B9CB";

        params.returnCalculator = returnCalculator;
        params.marginCurrency = marginCurrency;
      }

      return deployer.deploy(TIC, TDCreatorAddr, params, provider);
    })
    .catch(err => console.log(err));
};
