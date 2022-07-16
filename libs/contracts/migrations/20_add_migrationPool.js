const rolesConfig = require('../data/roles.json');
const {
  getExistingInstance,
} = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const migration = require('../data/deployment/migrations.json');
const {
  encodeMultiLpLiquidityPoolMigration,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const {
  logTransactionOutput,
} = require('@jarvis-network/core-utils/dist/eth/contracts/print-tx');
const { log } = require('@jarvis-network/core-utils/dist/logging');
const { toNetworkId } = require('@jarvis-network/core-utils/dist/eth/networks');

module.exports = async function (deployer, network, accounts) {
  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  global.web3 = web3;

  const synthereumDeployer = await getExistingInstance(
    web3,
    SynthereumDeployer,
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
  const migrationPool = migration[networkId].pools;
  if (migration[networkId].isEnabled === true) {
    if (migration[networkId].version === 6) {
      for (let j = 0; j < migrationPool.length; j++) {
        log(`   Migrating '${migrationPool[j]}' pool`);

        const migrationPayload = encodeMultiLpLiquidityPoolMigration(
          migrationPool[j],
          migration[networkId].version,
          '0x',
        );
        console.log(
          migrationPool[j],
          migration[networkId].version,
          migrationPayload,
        );
        const gasEstimation = await synthereumDeployer.methods
          .migratePool(
            migrationPool[j],
            migration[networkId].version,
            migrationPayload,
          )
          .estimateGas({ from: maintainer });
        if (gasEstimation != undefined) {
          const tx = await synthereumDeployer.methods
            .migratePool(
              migrationPool[j],
              migration[networkId].version,
              migrationPayload,
            )
            .send({ from: maintainer });
          const { transactionHash } = tx;
          await logTransactionOutput({
            log,
            web3,
            txhash: transactionHash,
            contractName: migrationPool[j],
            txSummaryText: 'migratePool',
          });
        }
      }
    }
  }
};
