/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: './.env.migration' });

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
      const migrate = require(`../migrations/${scriptName}`);
      await migrate(null, networkName, accounts);
    } catch (e) {
      console.log(e);
    }
  }

  function index(filename) {
    return parseInt(filename.split('_')[0], 10);
  }

  const accounts = await web3.eth.getAccounts();
  const baseDir = path.resolve(__dirname, '..', 'migrations');
  const migrationScripts = fs
    .readdirSync(baseDir)
    .filter(x => fs.lstatSync(`${baseDir}/${x}`).isFile())
    .sort((a, b) => index(a) - index(b));
  const realScriptName = migrationScripts.find(
    x => x.split('.js')[0].split('_').slice(2).join('_') === scriptName,
  );
  if (realScriptName) {
    await runMigration(realScriptName, network.name, accounts);
  } else if (scriptName.startsWith('add_')) {
    const fileName = migrationScripts.find(x => x.includes(scriptName));
    if (!fileName) {
      throw new Error(`Migration script '${scriptName}' not found.`);
    }
    console.log({ realScriptName, scriptName, fileName });
    await runMigration(fileName, network.name, accounts);
  } else if (scriptName === 'all') {
    // Run only by 'hardhat test'
    for (const script of migrationScripts
      .filter(x => !path.basename(x).slice(3).startsWith('add_'))
      .sort()) {
      console.log('deploy all in order', { script });
      await runMigration(script, network.name, accounts);
    }
  } else {
    console.log(`Migration script '${scriptName}' not found.`);
    process.exit(1);
  }
};
