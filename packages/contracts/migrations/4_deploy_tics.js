const web3Utils = require('web3-utils');

const config = require('../truffle-config.js');
const contracts = require('../contract-dependencies.json');
const assets = require('../synthetic-assets.json');
const TICConfig = require('../tic-config.json');
const feeConfig = require('../fees.json');
const rolesConfig = require('../roles.json');

var TICFactory = artifacts.require('TICFactory');

module.exports = function (deployer, network, accounts) {
  const networkId = config.networks[network.replace(/-fork$/, '')].network_id;

  // Kovan collateral address
  collateralAddress = contracts[networkId]['collateralAddress'];

  //Benficiary address in case of inflationary collateral token
  excessTokenBeneficiary = rolesConfig[networkId].maintainer;

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

      let params = {
        ...TICConfig,
        collateralAddress,
        ...assetParams,
        excessTokenBeneficiary,
      };
      params.priceFeedIdentifier = web3Utils.toHex(
        assetParams.priceFeedIdentifier,
      );
      console.log(params);
      const factory = await TICFactory.deployed();
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
