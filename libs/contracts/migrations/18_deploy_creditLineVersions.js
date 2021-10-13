module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'SynthereumCreditLineLib',
  'SynthereumFactoryVersioning',
  'CreditLineFactory',
  '@uma/core/contracts/oracle/implementation/Finder',
  '@uma/core/contracts/common/implementation/AddressWhitelist',
  '@uma/core/contracts/oracle/implementation/IdentifierWhitelist',
  'TestnetSelfMintingERC20',
  '@uma/core/contracts/common/implementation/Timer',
  '@uma/core/contracts/oracle/implementation/Registry',
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
  const umaContracts = require('../data/uma-contract-dependencies.json');
  const {
    ZERO_ADDRESS,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    SynthereumFinder,
    SynthereumCreditLineLib,
    SynthereumFactoryVersioning,
    CreditLineFactory,
  } = migrate.getContracts(artifacts);

  const selfMintingVersions = require('../data/selfMinting-versions.json');
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');

  const networkId = await toNetworkId(network);
  const synthereumFactoryVersioning = await getExistingInstance(
    web3,
    SynthereumFactoryVersioning,
  );
  const synthereumFinder = await getExistingInstance(web3, SynthereumFinder);
  const maintainer = rolesConfig[networkId]?.maintainer ?? accounts[1];
  const admin = rolesConfig[networkId]?.admin ?? accounts[0];
  const roles = { admin: admin, maintainers: [maintainer] };

  if (selfMintingVersions[networkId]?.CreditLineFactory?.isEnabled ?? true) {
    const keys = getKeysForNetwork(network, accounts);

    // //hardhat
    if (SynthereumCreditLineLib.setAsDeployed) {
      await deploy(web3, deployer, network, SynthereumCreditLineLib, {
        from: keys.deployer,
      });
      const libInstance = await SynthereumCreditLineLib.deployed();
      // Due to how truffle-plugin works, it statefully links it
      // and throws an error if its already linked. So we'll just ignore it...
      try {
        await CreditLineFactory.link(libInstance);
      } catch (e) {
        // Allow this to fail in the Buidler case.
        console.log(e);
      }
    } else {
      // Truffle
      await deploy(web3, deployer, network, SynthereumCreditLineLib, {
        from: keys.deployer,
      });

      const libInstance = await SynthereumCreditLineLib.deployed();

      deployer.link(CreditLineFactory, libInstance);
    }

    // Deploy derivative factory
    await deploy(
      web3,
      deployer,
      network,
      CreditLineFactory,
      synthereumFinder.options.address,
      { from: keys.deployer },
    );

    const creditLineFactory = await getExistingInstance(
      web3,
      CreditLineFactory,
    );

    const factoryInterface = await web3.utils.stringToHex('CreditLineFactory');
    await synthereumFactoryVersioning.methods
      .setFactory(
        factoryInterface,
        selfMintingVersions[networkId]?.CreditLineFactory?.version ?? 1,
        creditLineFactory.options.address,
      )
      .send({ from: maintainer });
    console.log('CreditLineFactory added to synthereumFactoryVersioning');
  }
}
