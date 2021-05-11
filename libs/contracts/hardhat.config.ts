import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-truffle5';
import '@nomiclabs/hardhat-web3';
import 'solidity-coverage';

import 'hardhat-gas-reporter';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { TASK_TEST } from 'hardhat/builtin-tasks/task-names';
import { TASK_VERIFY_VERIFY } from '@nomiclabs/hardhat-etherscan/dist/src/constants';
import type { HardhatUserConfig } from 'hardhat/config';
import { task } from 'hardhat/config';

import { getInfuraEndpoint } from '@jarvis-network/core-utils/dist/apis/infura';
/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
/* eslint-disable import/first */

// eslint-disable-next-line spaced-comment
/// <reference path="./espree.d.ts" />

import { dirname, basename, join, resolve } from 'path';
import { promises as fs, constants as fsConstants } from 'fs';

import {
  NetworkId,
  NetworkName,
  networkNameToId,
  toNetworkName,
} from '@jarvis-network/core-utils/dist/eth/networks';
import {
  Config,
  generateArtifacts,
} from '@jarvis-network/sol2ts-code-gen/dist/src/full-build-pipeline';

import { task as createOrModifyHardhatTask } from 'hardhat/config';
import { parse } from '@solidity-parser/parser';
import { Token } from '@solidity-parser/parser/dist/types';
import globby from 'globby';
import rmrf from 'rmrf';
import { parse as esParse } from 'espree';
import esquery from 'esquery';
import { exec } from 'child-process-promise';

createOrModifyHardhatTask(TASK_TEST)
  .addFlag('debug', 'Compile without optimizer')
  .setAction(async (taskArgs, hre, runSuper) => {
    const { debug } = taskArgs;
    if (debug) {
      console.log(
        'Debug test mode enabled - unlimited block gas limit and contract size',
      );
      hre.config.networks.hardhat.allowUnlimitedContractSize = true;
      hre.config.networks.hardhat.blockGasLimit = 0x1fffffffffffff;
      hre.config.networks.hardhat.gas = 12000000;
    }
    await runSuper(taskArgs);
  });

createOrModifyHardhatTask(
  'accounts',
  'Prints the list of accounts',
  async (_, hre) => {
    const accounts = await (hre as any).web3.eth.getAccounts();
    console.log(accounts);
  },
);

async function exists(path: string) {
  try {
    await fs.access(path, fsConstants.F_OK);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
  return true;
}

task(TASK_COMPILE, async (args, hre, runSuper) => {
  await runSuper();

  const distBaseDir = './dist/contracts';

  const config: Config = {
    outputPaths: {
      rootDir: hre.config.paths.root,
      abiDir: `${distBaseDir}/abi`,
      typechainDir: `${distBaseDir}/typechain`,
    },
    getAllFullyQualifiedNames: () => hre.artifacts.getAllFullyQualifiedNames(),
    readArtifact: filename => hre.artifacts.readArtifact(filename),
    clear: true,
    flat: true,
  };

  await generateArtifacts(config);
});

function addPublicNetwork(config: HardhatUserConfig, chainId: NetworkId) {
  const networkName = toNetworkName(chainId);
  config.networks ??= {};
  config.networks[networkName] = {
    chainId,
    url: getInfuraEndpoint(chainId, 'https'),
    accounts: {
      mnemonic:
        process.env.MNEMONIC ??
        // contents are irrelevant, only used for CI builds
        'ripple ship viable club inquiry act trap draft supply type again document',
    },
    timeout: 60e3,
  };

  const port = process.env.CUSTOM_LOCAL_NODE_PORT || '8545';
  const localRpc = process.env.GITLAB_CI
    ? `http://trufflesuite-ganache-cli:${port}`
    : `http://127.0.0.1:${port}`;

  config.networks[`${networkName}_fork`] = {
    chainId,
    url: localRpc,
    timeout: 60e3,
  };
}

async function findContract({ dir, name }: { dir: string; name: string }) {
  /* eslint-disable no-await-in-loop */
  for (const solidityFile of await globby(`${dir}/**/*.sol`)) {
    const { children } = ((await parse(
      await fs.readFile(solidityFile, 'utf-8'),
    )) as unknown) as {
      children: Token[];
    };

    if (
      children.find(
        child =>
          child.type === 'ContractDefinition' &&
          name ===
          ((child as unknown) as {
            type: 'ContractDefinition';
            name: string;
          }).name,
      )
    ) {
      return solidityFile;
    }
  }
  /* eslint-enable no-await-in-loop */

  throw new Error(`Contract with name '${name}' not found`);
}

async function gatherFiles(
  contractPath: string,
  dir: string,
  gathered: string[] = [contractPath],
) {
  const contractDir = dirname(resolve(contractPath));
  const contractRelativePath = contractDir.split(__dirname)[1];
  const tmpMainContractPath = join(
    dir,
    contractRelativePath,
    basename(contractPath),
  );

  const mainContractContent = await fs.readFile(contractPath, 'utf-8');

  await fs.mkdir(dirname(tmpMainContractPath), { recursive: true });

  await fs.writeFile(tmpMainContractPath, mainContractContent, {
    encoding: 'utf-8',
  });

  const { children } = ((await parse(mainContractContent)) as unknown) as {
    children: Token[];
  };

  for (const child of children) {
    if (child.type === 'ImportDirective') {
      const { path: importedContractPath } = (child as unknown) as {
        type: 'ImportDirective';
        path: string;
      };

      if (
        importedContractPath.indexOf('./') !== 0 &&
        importedContractPath.indexOf('../') !== 0
      ) {
        throw new Error(
          `Unsupported contract import '${importedContractPath}'`,
        );
      }

      // eslint-disable-next-line no-await-in-loop
      const abosolutePath = await resolve(contractDir, importedContractPath);
      if (!gathered.includes(abosolutePath)) {
        gathered.push(abosolutePath);
        // eslint-disable-next-line no-await-in-loop
        await gatherFiles(abosolutePath, dir, gathered);
      }
    }
  }

  return tmpMainContractPath;
}

const migrationsGlobPattern = './migrations/??_deploy_*.js';
async function getMigrationScriptPath(
  migrationScript: string,
): Promise<string> {
  for (const migrationScriptPath of await globby(migrationsGlobPattern)) {
    if (migrationScriptPath.endsWith(`deploy_${migrationScript}.js`)) {
      return migrationScriptPath;
    }
  }
  throw new Error(`Migration script '${migrationScript}' not supported`);
}

async function getDeployedContractsForNetwork(network: NetworkName) {
  const path = `./networks/${networkNameToId[network]}.json`;
  if (!exists(path)) return [];

  return JSON.parse(await fs.readFile(path, 'utf-8')) as {
    contractName: string;
    address: string;
    transactionHash?: string;
  }[];
}

async function getDeployedContractsConstructorArgumentsForNetwork(
  network: NetworkName,
) {
  return JSON.parse(
    await fs.readFile(
      `./networks/${networkNameToId[network]}_args.json`,
      'utf-8',
    ),
  ) as Record<string, unknown[]>;
}

async function writeArgumentsFileForAddress(
  network: NetworkName,
  address: string,
  path: string,
) {
  const args = (
    await getDeployedContractsConstructorArgumentsForNetwork(network)
  )[address];

  await fs.writeFile(path, `module.exports = ${JSON.stringify(args)}`, 'utf-8');
}

const TASK_DEPLOY = 'deploy';
createOrModifyHardhatTask(
  TASK_DEPLOY,
  'Tests, deploys, and verifies a contract',
)
  .addFlag(
    'noVerify',
    'Skip Etherscan verification (automatically skipped if network is fork or hardhat)',
  )
  .addPositionalParam('migrationScript', `Name of migration script to deploy`)
  .setAction(
    async (
      {
        migrationScript,
        noVerify,
      }: { migrationScript: string; noVerify: boolean },
      hre,
    ) => {
      const { sources, artifacts, cache } = hre.config.paths;
      async function clean(withSources = true) {
        if (withSources) rmrf(sources);
        rmrf(artifacts);
        rmrf(cache);
        await Promise.all([
          withSources ? fs.mkdir(sources) : Promise.resolve(),
          fs.mkdir(artifacts),
          fs.mkdir(cache),
        ]);
      }

      await clean();

      if (migrationScript === 'all') {
        for (const migrationScriptPath of await globby(migrationsGlobPattern)) {
          // eslint-disable-next-line no-await-in-loop
          await hre.run(TASK_DEPLOY, {
            migrationScript: migrationScriptPath
              .split('/')
              .reverse()[0]
              .split('_deploy_')[1]
              .split('.js')[0],
            noVerify,
          });
        }
        return;
      }

      const migrationScriptPath = await getMigrationScriptPath(migrationScript);

      const { name: network } = hre.network;
      const localNetwork = !network || network.endsWith('_fork');

      const lengthBefore = localNetwork
        ? 0
        : (await getDeployedContractsForNetwork(network as NetworkName)).length;

      // Search for calls to artifacts.require and get value of first argument
      const contractNames = esquery(
        esParse(await fs.readFile(migrationScriptPath, 'utf-8'), {
          ecmaVersion: 12,
        }) as any,
        'CallExpression[callee.object.name="artifacts"][callee.property.name="require"]',
      ).map(node => (node as any).arguments[0].value) as string[];

      /* eslint-disable no-await-in-loop */
      for (const contractName of contractNames) {
        await gatherFiles(
          await findContract({
            name: contractName,
            dir: resolve('./contracts'),
          }),
          sources,
        );
      }
      /* eslint-enable no-await-in-loop */

      // Check https://gitlab.com/jarvis-network/base/tools/hardhat/-/blob/jarvis-publish/hardhat-etherscan@0.1.0/packages/hardhat-etherscan/src/index.ts
      // if (stripComments) { // TODO: If too big (do only in npm first)
      //   files = minifyContracts(files);
      // }

      (hre as {
        migrationScript?: string;
      }).migrationScript = migrationScript; // Used in test/truffle-fixture.js
      const testPath = `./cache/test-${migrationScript}.js`;
      await fs.writeFile(
        testPath,
        `
contract('${migrationScript}', accounts => {
  it('Migration is ok', async () => {
    assert.equal(1, 1);
  });
});
      `,
        'utf-8',
      );
      await hre.run(TASK_TEST, { testFiles: [testPath] });

      if (!noVerify && !localNetwork) {
        const contracts = await getDeployedContractsForNetwork(
          network as NetworkName,
        );
        /* eslint-disable no-await-in-loop */
        for (const { contractName, address } of Array.from({
          length: contracts.length - lengthBefore,
        }).map((_, index) => contracts[lengthBefore + index])) {
          await clean(false);

          for (; ;) {
            try {
              await hre.run(TASK_VERIFY_VERIFY, {
                address,
                constructorArguments: (
                  await getDeployedContractsConstructorArgumentsForNetwork(
                    network as NetworkName,
                  )
                )[address],
              });
              break;
            } catch (error) {
              if (
                error.message.includes(
                  'Reason: The Etherscan API responded that the address',
                ) &&
                error.message.includes('does not have bytecode')
              ) {
                console.warn(
                  'Etherscan has not yet indexed the new deployed contract. Waiting 10s.',
                );
                await timeout(10 * 1000);
                // eslint-disable-next-line no-continue
                continue;
              }
              console.error(
                'Verification for',
                address,
                'failed with error:',
                error,
              );
              console.warn('Trying verification using command line');
              const constructorArgs = join(cache, `args_${contractName}.js`);
              await writeArgumentsFileForAddress(
                network as NetworkName,
                address,
                constructorArgs,
              );
              const {
                stdout,
                stderr,
              } = await exec(
                `hardhat verify ${address} --constructor-args ${constructorArgs} --network ${network}`,
                { capture: ['stderr', 'stdout'] },
              );
              process.stdout.write(stdout);
              process.stderr.write(stderr);
              break;
            }
          }
        }
        /* eslint-enable no-await-in-loop */
      }
    },
  );

function timeout(time: number) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, time));
}

export const config = {
  solidity: {
    version: '0.6.12',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    root: '.',
    sources: './deploy',
    artifacts: './artifacts',
    cache: './cache',
    tests: './test',
  },
  networks: {
    hardhat: {
      gas: 11500000,
      blockGasLimit: 11500000,
      allowUnlimitedContractSize: false,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
  mocha: {
    timeout: 1800000,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

addPublicNetwork(config, 1);
addPublicNetwork(config, 42);
addPublicNetwork(config, 4);

export default config;
