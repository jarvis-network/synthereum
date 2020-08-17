const contracts = require('../contract-dependencies.json');
const assets = require('../synthetic-assets.json');
const TICFactory = artifacts.require('TICFactory');
const rDAi = artifacts.require('IRToken');

module.exports = function (callback) {
  async function checkBalance() {
    try {
      const networkId = await web3.eth.net.getId();
      const factory = await TICFactory.at(contracts[networkId]['ticFactory']);
      const rDai = await rDAi.at(contracts[networkId]['collateralAddress']);
      Promise.all(
        assets.map(async asset => {
          const assetName = asset.syntheticSymbol;
          const ticAddress = await factory.symbolToTIC.call(assetName);
          const collaterTicBalanceInWei = await rDai.balanceOf.call(ticAddress);
          const collaterTicBalance = web3.utils.fromWei(
            collaterTicBalanceInWei,
          );
          console.log(
            `LP collateral of ${assetName} is: ${collaterTicBalance} $`,
          );
        }),
      );
    } catch (error) {
      console.log(error);
    }
  }
  checkBalance();
};
