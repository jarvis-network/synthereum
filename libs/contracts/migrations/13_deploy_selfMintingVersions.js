module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumFactoryVersioning',
  'CreditLineLib',
  'CreditLine',
  'CreditLineFactory',
]);

async function migrate(deployer, network, accounts) {
  require('dotenv').config({ path: './.env.migration' });
  const {
    parseBoolean,
  } = require('@jarvis-network/core-utils/dist/base/asserts');
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const {
    ZERO_ADDRESS,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    SynthereumFinder,
    SynthereumFactoryVersioning,
    CreditLineLib,
    CreditLine,
    CreditLineFactory,
  } = migrate.getContracts(artifacts);

  const selfMintingVersions = require('../data/selfMinting-versions.json');
  const {
    RegistryRolesEnum,
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const synthereumFactoryVersioning = await getExistingInstance(
    web3,
    SynthereumFactoryVersioning,
    '@jarvis-network/synthereum-contracts',
  );
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  if (selfMintingVersions[networkId]?.CreditLineFactory?.isEnabled ?? true) {
    const keys = getKeysForNetwork(network, accounts);
    //hardhat
    const { contract: creditLineLib } = await deploy(
      web3,
      deployer,
      network,
      CreditLineLib,
      { from: keys.deployer },
    );

    // Due to how truffle-plugin works, it statefully links it
    // and throws an error if its already linked. So we'll just ignore it...
    try {
      await CreditLine.link(creditLineLib);
    } catch (e) {
      // Allow this to fail in the Buidler case.
    }

    // deploy creditLine implementation
    await deploy(web3, deployer, network, CreditLine, {
      from: keys.deployer,
    });
    const creditLineImpl = await getExistingInstance(
      web3,
      CreditLine,
      '@jarvis-network/synthereum-contracts',
    );

    // Deploy self-minting factory
    await deploy(
      web3,
      deployer,
      network,
      CreditLineFactory,
      synthereumFinder.options.address,
      creditLineImpl.options.address,
      { from: keys.deployer },
    );

    const creditLineFactory = await getExistingInstance(
      web3,
      CreditLineFactory,
      '@jarvis-network/synthereum-contracts',
    );
    const factoryInterface = await web3.utils.stringToHex('SelfMintingFactory');
    await synthereumFactoryVersioning.methods
      .setFactory(
        factoryInterface,
        selfMintingVersions[networkId]?.CreditLineFactory?.version ?? 2,
        creditLineFactory.options.address,
      )
      .send({ from: maintainer });
    console.log('CreditLineFactory added to synthereumFactoryVersioning');
  }
}
