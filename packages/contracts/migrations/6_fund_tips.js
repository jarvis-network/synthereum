const ERC20 = artifacts.require('ERC20');
const rDAI = artifacts.require('IRToken');
const TIC = artifacts.require('TIC');
const TICFactory = artifacts.require('TICFactory');
const assets = require('../fund-assets.json');
const contracts = require('../contract-dependencies.json');

module.exports = function (deployer, network, accounts) {
  async function fund() {
    const liquidityProvider = accounts[0]; // Whoever the liquidity provider should be
    const networkId = config.networks[network.replace(/-fork$/, '')].network_id;
    const TICFactoryInstance = await TICFactory.at(
      contracts[networkId]['ticFactory'],
    );
    const collateralAddress = contracts[networkId]['collateralAddress'];
    const collateralInstance = await ERC20.at(collateralAddress);

    const deployments = await Promise.all(
      assets.map(async asset => {
        try {
          const TICaddress = await TICFactoryInstance.symbolToTIC.call(
            asset.syntheticSymbol,
          );
          const TICInstance = await TIC.at(TICaddress);
          await collateralInstance.approve(TICInstance.address, asset.amount, {
            from: liquidityProvider,
          });
          console.log(
            `Approved ${web3.utils.fromWei(
              asset.amount,
              'mwei',
            )} $ for TIC pool ${asset.syntheticSymbol}`,
          );
          await TICInstance.deposit(asset.amount, { from: liquidityProvider });
          console.log(
            `TIC pool ${asset.syntheticSymbol} funded with ${web3.utils.fromWei(
              asset.amount,
              'mwei',
            )} $ `,
          );
        } catch (error) {
          console.log(error);
        }
      }),
    );
  }

  deployer.then(async () => await fund()).catch(err => console.log(err));
};
