require('dotenv').config({ path: './.env.migration' });
const { parseBoolean } = require('@jarvis-network/core-utils/dist/base/asserts');
//Synthereum contracts to deploy Synthereum infrastructure for local hardhat test
const deployFinder = require('../migrations/1_deploy_finder.js');
const deployDeployer = require('../migrations/2_deploy_deployer.js');
const deployPoolRegistry = require('../migrations/3_deploy_pool_registry.js');
const deployFactoryVersioning = require('../migrations/4_deploy_factory_versioning.js');
const deployManager = require('../migrations/5_deploy_manager.js');
const deployDerivativeVersions = require('../migrations/6_deploy_derivative_versions.js');
const deployPoolVersions = require('../migrations/7_deploy_pool_versions.js');
const deployPriceFeed = require('../migrations/8_deploy_price_feed.js');
const deployPoolAndDerivative = require('../migrations/9_add_pool_and_derivative.js');
const deployOnlyPool = require('../migrations/10_add_only_pool.js');
const deployOnlyDerivative = require('../migrations/11_add_only_derivative.js');

//Uma contracts to deploy Uma infrastructure for local hardhat test
const umaDeployFinder = require('@jarvis-network/uma-core/migrations/2_deploy_finder.js');
const umaDeployTimer = require('@jarvis-network/uma-core/migrations/3_deploy_timer.js');
const UmaDeployVotingToken = require('@jarvis-network/uma-core/migrations/4_deploy_voting_token.js');
const UmaDeployVoting = require('@jarvis-network/uma-core/migrations/5_deploy_voting.js');
const UmaDeployRegistry = require('@jarvis-network/uma-core/migrations/6_deploy_registry.js');
const UmaDeployFinancialAdmin = require('@jarvis-network/uma-core/migrations/7_deploy_financial_contracts_admin.js');
const UmaDeployStore = require('@jarvis-network/uma-core/migrations/8_deploy_store.js');
const UmaDeployGovernor = require('@jarvis-network/uma-core/migrations/9_deploy_governor.js');
const UmaDeployDesignatedVotingFactory = require('@jarvis-network/uma-core/migrations/10_deploy_designated_voting_factory.js');
const UmaDeployOptimisticOracle = require('@jarvis-network/uma-core/migrations/11_deploy_optimistic_oracle.js');

module.exports = async ({ network, web3 }) => {
  const accounts = await web3.eth.getAccounts();
  const networkId = await web3.eth.net.getId();
  const newUmaDeployment =
    parseBoolean(process.env.NEW_UMA_INFRASTRUCTURE) ?? false;
  if (
    (networkId != 1 && networkId != 3 && networkId != 4 && networkId != 42) ||
    newUmaDeployment
  ) {
    await umaDeployFinder(null, network.name, accounts);
    await umaDeployTimer(null, network.name, accounts);
    await UmaDeployVotingToken(null, network.name, accounts);
    await UmaDeployVoting(null, network.name, accounts);
    await UmaDeployRegistry(null, network.name, accounts);
    await UmaDeployFinancialAdmin(null, network.name, accounts);
    await UmaDeployStore(null, network.name, accounts);
    await UmaDeployGovernor(null, network.name, accounts);
    await UmaDeployDesignatedVotingFactory(null, network.name, accounts);
    await UmaDeployOptimisticOracle(null, network.name, accounts);
  }
  if (process.env.MIGRATION_TYPE == 'finder') {
    console.log('Deploying finder...');
    await deployFinder(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'deployer') {
    console.log('Deploying deployer...');
    await deployDeployer(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'poolRegistry') {
    console.log('Deploying pool registry...');
    await deployPoolRegistry(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'factoryVersioning') {
    console.log('Deploying factory versioning...');
    await deployFactoryVersioning(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'manager') {
    console.log('Deploying manager...');
    await deployManager(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'derivativeVersions') {
    console.log('Deploying derivative versions...');
    await deployDerivativeVersions(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'poolVersions') {
    console.log('Deploying pool versions...');
    await deployPoolVersions(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'priceFeed') {
    console.log('Deploying price feed...');
    await deployPriceFeed(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'pool-and-derivative') {
    console.log('Deploying pool and derivatives...');
    await deployPoolAndDerivative(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'only-pool') {
    console.log('Deploying only pool...');
    await deployOnlyPool(null, network.name, accounts);
  } else if (process.env.MIGRATION_TYPE == 'only-derivative') {
    console.log('Deploying only derivatives...');
    await deployOnlyDerivative(null, network.name, accounts);
  } else {
    console.log('Deploying all...');
    await deployFinder(null, network.name, accounts);
    await deployDeployer(null, network.name, accounts);
    await deployPoolRegistry(null, network.name, accounts);
    await deployFactoryVersioning(null, network.name, accounts);
    await deployManager(null, network.name, accounts);
    await deployDerivativeVersions(null, network.name, accounts);
    await deployPoolVersions(null, network.name, accounts);
    await deployPriceFeed(null, network.name, accounts);
  }
};
