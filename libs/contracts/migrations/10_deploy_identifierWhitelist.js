module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumIdentifierWhitelist',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const identifiersWhitelistConfig = require('../data/whitelist/identifiers.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { SynthereumIdentifierWhitelist, SynthereumFinder } =
    migrate.getContracts(artifacts);
  const {
    getKeysForNetwork,
    deploy,
    isPublicNetwork,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const admin = process.env.FORKCHAINID
    ? accounts[0]
    : rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  const roles = { admin: admin, maintainer: maintainer };
  const keys = getKeysForNetwork(network, accounts);
  await deploy(web3, deployer, network, SynthereumIdentifierWhitelist, roles, {
    from: keys.deployer,
  });
  const identifierWhitelistInterface = await web3.utils.stringToHex(
    'IdentifierWhitelist',
  );
  const synthereumIdentifierWhitelist = await getExistingInstance(
    web3,
    SynthereumIdentifierWhitelist,
    '@jarvis-network/synthereum-contracts',
  );
  await synthereumFinder.methods
    .changeImplementationAddress(
      identifierWhitelistInterface,
      synthereumIdentifierWhitelist.options.address,
    )
    .send({ from: maintainer });
  console.log('SynthereumIdentifierWhitelist added to SynthereumFinder');
  const identifiersWhitelistElements = identifiersWhitelistConfig[networkId];
  if (isPublicNetwork(network)) {
    for (let j = 0; j < identifiersWhitelistElements.length; j++) {
      await synthereumIdentifierWhitelist.methods
        .addToWhitelist(web3.utils.utf8ToHex(identifiersWhitelistElements[j]))
        .send({ from: maintainer });
      console.log(`   Add '${identifiersWhitelistElements[j]}' identifier`);
    }
  }
}
