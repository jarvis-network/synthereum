const web3Utils = require('web3-utils');

const config = require('../truffle-config.js');
const contracts = require('../src/config/contract-dependencies.json');
const assets = require('../src/config/add-synthetic-assets.json');
const TICConfig = require('../src/config/tic-config.json');
const feeConfig = require('../src/config/fees.json');
const rolesConfig = require('../src/config/roles.json');

var TICFactory = artifacts.require('TICFactory');

module.exports = function (deployer, network, accounts) {
  const networkId = config.networks[network.replace(/-fork$/, '')].network_id;

  // Kovan rDAI address
  collateralAddress = contracts[networkId]['collateralAddress'];

  const fee = {
    feePercentage: {
      rawValue: web3Utils.toWei(feeConfig[networkId].feePercentage.toString()),
    },
    feeRecipients: feeConfig[networkId].feeRecipients,
    feeProportions: feeConfig[networkId].feeProportions,
  };

  const roles = rolesConfig[networkId];

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
      const factory = await TICFactory.at(contracts[networkId]['ticFactory']);
      const { receipt } = await factory.createTIC(
        params,
        startingCollateralization,
        roles,
        fee,
        { from: rolesConfig[networkId].maintainer },
      );
      console.log(`   > gas used: ${receipt.gasUsed}`);
      console.log('\n');
    }),
  );

  deployer.then(() => deployments).catch(err => console.log(err));
};
