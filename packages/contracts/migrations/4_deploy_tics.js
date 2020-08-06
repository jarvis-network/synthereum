const web3Utils = require('web3-utils');

const config = require('../truffle-config.js');
const contracts = require('../contract-dependencies.json');
const assets = require('../synthetic-assets.json');
const TICConfig = require('../tic-config.json');

var TICFactory = artifacts.require('TICFactory');

module.exports = function (deployer, network, accounts) {
  const protocolOwner = accounts[0]; // Account to pay protocol fees to
  const liquidityProvider = accounts[0]; // Whoever the liquidity provider should be
  const validator = accounts[1]; // Whoever validates mint and exchange requests

  const networkId = config.networks[network.replace(/-fork$/, '')].network_id;

  // Kovan rDAI address
  collateralAddress = contracts[networkId]['collateralAddress'];

  const fee = {
    mintFee: { rawValue: web3Utils.toWei('0.001') },
    mintFeeRecipients: [protocolOwner, liquidityProvider],
    mintFeeProportions: [50, 50],
    interestFeeRecipients: [protocolOwner, liquidityProvider],
    interestFeeProportions: [10, 90],
  };

  console.log('\n');

  const deployments = Promise.all(
    assets.map(async asset => {
      // Necessary so changes to asset do not persist in other migrations run from the same console
      const assetParams = { ...asset };

      console.log(`   Deploying '${assetParams.syntheticSymbol}'`);
      console.log('   -------------------------------------');

      const startingCollateralization =
        assetParams['startingCollateralization'];
      delete assetParams['startingCollateralization'];

      let params = { ...TICConfig, collateralAddress, ...assetParams };
      params.priceFeedIdentifier = web3Utils.toHex(
        assetParams.priceFeedIdentifier,
      );

      const factory = await TICFactory.deployed();
      const { receipt } = await factory.createTIC(
        params,
        liquidityProvider,
        validator,
        startingCollateralization,
        fee,
      );
      console.log(`   > gas used: ${receipt.gasUsed}`);
      console.log('\n');
    }),
  );

  deployer.then(() => deployments).catch(err => console.log(err));
};
