const once = require("events.once");
const web3Utils = require("web3-utils");
var ProvablePriceFeed = artifacts.require("./ProvablePriceFeed.sol");

module.exports = function(deployer, network, accounts) {
  const identifier = web3Utils.toHex("EUR/USD");

  const isDryRun = network.endsWith("-fork");

  const forexDayClose = 5;
  const forexHourClose = 21;
  const forexDayOpen = 0;
  const forexHourOpen = 22;
  const currentDate = new Date();
  const currentDay = currentDate.getUTCDay();
  const currentHour = currentDate.getUTCHours();

  const isForexClosed = currentDay > forexDayClose
    || (currentDay === forexDayClose && currentHour >= forexHourClose)
    || (currentDay === forexDayOpen && currentHour <= forexHourOpen);

  if (isDryRun || isForexClosed) {
    deployer.deploy(ProvablePriceFeed, true, "1", identifier);
  } else {
    deployer.deploy(ProvablePriceFeed, true, "", identifier)
      .then(() => {
        ProvablePriceFeed.deployed()
        return once(feed.ProvableUpdate());
      })
      .then(result => {
        console.log(result);
      });
  }
};
