module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumCollateralWhitelist',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const collateralsWhitelistConfig = require('../data/whitelist/collaterals.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    SynthereumCollateralWhitelist,
    SynthereumFinder,
  } = migrate.getContracts(artifacts);
  const {
    getKeysForNetwork,
    deploy,
    isPublicNetwork,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = toNetworkId(network);
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(web3, deployer, network, SynthereumCollateralWhitelist, roles, {
    from: keys.deployer,
  });
  const collateralWhitelistInterface = await web3.utils.stringToHex(
    'CollateralWhitelist',
  );
  const synthereumCollateralWhitelist = await getExistingInstance(
    web3,
    SynthereumCollateralWhitelist,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      collateralWhitelistInterface,
      synthereumCollateralWhitelist.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumCollateralWhitelist added to SynthereumFinder');
  const collateralsWhitelistElements = collateralsWhitelistConfig[networkId];
  if (isPublicNetwork(network)) {
    for (let j = 0; j < collateralsWhitelistElements.length; j++) {
      await synthereumCollateralWhitelist.methods
        .addToWhitelist(collateralsWhitelistElements[j])
        .send({ from: maintainer });
      console.log(`   Add '${collateralsWhitelistElements[j]}' collateral`);
    }
  }
}
