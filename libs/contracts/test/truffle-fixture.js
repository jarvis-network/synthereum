/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: './.env.migration' });
const {
  parseBoolean,
} = require('@jarvis-network/core-utils/dist/base/asserts');

module.exports = async ({
  network,
  web3,
  migrationScript: scriptName = process.env.MIGRATION_TYPE,
}) => {
  async function runMigration(
    // eslint-disable-next-line no-shadow
    scriptName,
    networkName,
    accounts,
    isUma = false,
  ) {
    try {
      console.log(`Deploying ${scriptName}`);
      const migrate = require(isUma
        ? `@jarvis-network/uma-core/migrations/${scriptName}`
        : `../migrations/${scriptName}`);
      await migrate(null, networkName, accounts);
    } catch (e) {
      console.log(e);
    }
  }

  function index(filename) {
    return parseInt(filename.split('_')[0], 10);
  }

  const accounts = await web3.eth.getAccounts();
  const networkId = await web3.eth.net.getId();
  const baseDir = path.resolve(__dirname, '..', 'migrations');
  const migrationScripts = fs
    .readdirSync(baseDir)
    .filter(x => fs.lstatSync(`${baseDir}/${x}`).isFile())
    .sort((a, b) => index(a) - index(b));
  const umaModule = require.resolve('@jarvis-network/uma-core');
  const umaBaseDir = path.resolve(umaModule, '..', 'migrations');
  const umaBaseMigrationScripts = fs
    .readdirSync(umaBaseDir)
    .filter(
      x =>
        fs.lstatSync(`${umaBaseDir}/${x}`).isFile() &&
        index(x) >= 2 &&
        index(x) <= 11,
    )
    .sort((a, b) => index(a) - index(b));
  const realScriptName = migrationScripts.find(
    x => x.split('.js')[0].split('_').slice(2).join('_') === scriptName,
  );
  const newUmaDeployment =
    parseBoolean(process.env.NEW_UMA_INFRASTRUCTURE) ?? false;

  if (
    (networkId !== 1 &&
      networkId !== 3 &&
      networkId !== 4 &&
      networkId !== 42) ||
    newUmaDeployment
  ) {
    for (const script of umaBaseMigrationScripts) {
      await runMigration(script, network.name, accounts, true);
    }
  }
  if (realScriptName) {
    await runMigration(realScriptName, network.name, accounts);
  } else {
    console.log(`Migration script '${scriptName}' not found.`);
    process.exit(1);
  }
};
