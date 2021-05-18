// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="string.prototype.replaceall.d.ts" />

import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-truffle5';
import '@nomiclabs/hardhat-web3';
import 'solidity-coverage';

import 'hardhat-gas-reporter';

import { dirname, basename, join, resolve, relative } from 'path';
import { promises as fs, constants as fsConstants } from 'fs';

import { TASK_COMPILE, TASK_TEST } from 'hardhat/builtin-tasks/task-names';

import replaceAll from 'string.prototype.replaceall';

import {
  TASK_VERIFY_VERIFY,
  TASK_VERIFY_GET_MINIMUM_BUILD,
  TASK_VERIFY_VERIFY_MINIMUM_BUILD,
} from '@nomiclabs/hardhat-etherscan/dist/src/constants';
import type { HardhatUserConfig } from 'hardhat/config';
import { task, task as createOrModifyHardhatTask } from 'hardhat/config';

import { getInfuraEndpoint } from '@jarvis-network/core-utils/dist/apis/infura';
/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
/* eslint-disable import/first */

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

import { parse } from '@solidity-parser/parser';
import { Token } from '@solidity-parser/parser/dist/src/types';
import globby from 'globby';
import rmrf from 'rmrf';
import { exec } from 'child-process-promise';
import removeComments from 'strip-comments';
import { parseBoolean } from '@jarvis-network/core-utils/dist/base/asserts';
import fse from 'fs-extra';

createOrModifyHardhatTask(TASK_VERIFY_GET_MINIMUM_BUILD).setAction(() =>
  Promise.resolve(1),
);

createOrModifyHardhatTask(TASK_VERIFY_VERIFY_MINIMUM_BUILD).setAction(() =>
  Promise.resolve(false),
);

createOrModifyHardhatTask(TASK_COMPILE).setAction((args, hre, runSuper) =>
  ((hre as unknown) as { skipCompile?: boolean }).skipCompile
    ? Promise.resolve()
    : runSuper(args),
);

/*
// Alternate method to fix `Fail - Unable to verify` error when verifying
createOrModifyHardhatTask(TASK_VERIFY_GET_CONTRACT_INFORMATION).setAction(
  async (args, _hre, runSuper) => {
    const result = await runSuper(args);

    const { libraries } = result.compilerInput.settings;
    if (libraries) {
      if (!result.libraryLinks) {
        result.libraryLinks = {};
      }
      // eslint-disable-next-line guard-for-in
      for (const library in libraries) {
        result.libraryLinks[library] = libraries[library];
      }
    }
    delete result.compilerInput.settings.libraries;

    return result;
  },
);
*/

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
    const accounts = await hre.web3.eth.getAccounts();
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

function getModuleName(path: string) {
  const partsOfPath = path.split('/');
  return path[0] === '@'
    ? `${partsOfPath[0]}/${partsOfPath[1]}`
    : partsOfPath[0];
}

async function gatherFiles(
  contractPath: string,
  dir: string,
  moduleName?: string,
  gathered: string[] = [contractPath],
) {
  const contractDir = dirname(resolve(contractPath));
  const contractCopyPath = moduleName
    ? join(
      dir,
      relative(contractDir.split(moduleName)[0], contractDir),
      basename(contractPath),
    )
    : join(dir, relative(dirname(dir), contractDir), basename(contractPath));

  let mainContractContent = await fs.readFile(contractPath, 'utf-8');

  await fs.mkdir(dirname(contractCopyPath), { recursive: true });

  const externalImports: Record<string, string> = {};

  const { children } = ((await parse(mainContractContent)) as unknown) as {
    children: Token[];
  };

  for (const child of children) {
    if (child.type === 'ImportDirective') {
      const { path: importedContractPath } = (child as unknown) as {
        type: 'ImportDirective';
        path: string;
      };

      let externalModule: string | undefined;
      let abosolutePath: string;
      if (
        importedContractPath.indexOf('./') !== 0 &&
        importedContractPath.indexOf('../') !== 0
      ) {
        externalModule = getModuleName(importedContractPath);
        abosolutePath = require.resolve(importedContractPath);
        externalImports[importedContractPath] = `${relative(
          dirname(contractCopyPath),
          dir,
        )}/${importedContractPath}`;
      } else {
        if (moduleName) externalModule = moduleName;
        // eslint-disable-next-line no-await-in-loop
        abosolutePath = await resolve(contractDir, importedContractPath);
      }

      if (!gathered.includes(abosolutePath)) {
        gathered.push(abosolutePath);
        // eslint-disable-next-line no-await-in-loop
        await gatherFiles(abosolutePath, dir, externalModule, gathered);
      }
    }
  }

  // eslint-disable-next-line guard-for-in
  for (const i in externalImports) {
    mainContractContent = replaceAll(
      mainContractContent,
      i,
      externalImports[i],
    );
  }

  await fs.writeFile(contractCopyPath, mainContractContent, {
    encoding: 'utf-8',
  });

  return contractCopyPath;
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

function getNetworkFile(network: NetworkName) {
  return `./networks/${networkNameToId[network]}.json`;
}
async function getDeployedContractsForNetwork(network: NetworkName) {
  const path = getNetworkFile(network);
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

function minifyCode(originalCode: string): string {
  const firstLine =
    originalCode.startsWith('// SPDX-License-Identifier') ||
    originalCode.startsWith('//SPDX-License-Identifier')
      ? originalCode.split('\n')[0]
      : '';

  const withoutComments = removeComments(originalCode);
  const withoutTrailingWhitespace = withoutComments.replace(/^\s+$/gm, '');
  return (
    firstLine + withoutTrailingWhitespace.replace(/(\r\n|\r|\n){3,}/gm, '\n\n')
  );
}

async function getAllFilesLength(files: string[]): Promise<number> {
  return (
    await Promise.all(files.map(async file => (await fs.stat(file)).size))
  ).reduce((a, b) => a + b);
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
        skipUma,
      }: { migrationScript: string; noVerify: boolean; skipUma: false },
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

      const { name: network } = hre.network;
      if (
        !skipUma &&
        (((network !== 'mainnet' &&
          network !== 'ropsten' &&
          network !== 'rinkeby' &&
          network !== 'kovan') ||
          parseBoolean(process.env.NEW_UMA_INFRASTRUCTURE)) ??
          false)
      ) {
        await fse.copy(
          resolve(
            dirname(require.resolve('@jarvis-network/uma-core')),
            'contracts',
          ),
          './deploy',
        );

        (hre as {
          migrationScript?: string;
        }).migrationScript = 'uma'; // Used in test/truffle-fixture.js
        const testPath = `./cache/test-uma.js`;
        await fs.writeFile(
          testPath,
          `
  contract('uma', accounts => {
    it('Migration is ok', async () => {
      assert.equal(1, 1);
    });
  });
        `,
          'utf-8',
        );

        await hre.run(TASK_TEST, { testFiles: [testPath] });

        process.env.NEW_UMA_INFRASTRUCTURE = 'true';

        await clean();
      }

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
            skipUma: true,
          });
        }

        return;
      }

      const migrationScriptPath = await getMigrationScriptPath(migrationScript);

      const localNetwork = !network || network.endsWith('_fork');

      const lengthBefore = localNetwork
        ? 0
        : (await getDeployedContractsForNetwork(network as NetworkName)).length;

      // Search for calls to artifacts.require and get value of first argument
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const contractNames = require(migrationScriptPath).getContracts() as string[];
      delete require.cache[require.resolve(migrationScriptPath)];

      /* eslint-disable no-await-in-loop */
      const srcPath = resolve('./contracts');
      const contractPaths = await Promise.all(
        contractNames.map(async name => {
          if (name.includes('/')) {
            const resolvedPath = require.resolve(`${name}.sol`);
            return gatherFiles(resolvedPath, sources, getModuleName(name));
          }

          return gatherFiles(
            await findContract({
              name,
              dir: srcPath,
            }),
            sources,
          );
        }),
      );
      /* eslint-enable no-await-in-loop */

      if (!noVerify && !localNetwork) {
        // Etherscan has a limit of 500k chars when verifying contracts
        const files = (await globby(`${resolve(sources)}/**/*.sol`)).sort(); // Starts with folders that begin with `@` if any

        /* eslint-disable no-await-in-loop */
        // 480_000 wasn't enough
        for (let i = 0; (await getAllFilesLength(files)) > 470_000; i++) {
          if (i >= files.length) {
            throw new Error(
              'Could not decrease contracts enough to pass verification',
            );
          }

          const file = files[i];
          await fs.writeFile(
            file,
            // eslint-disable-next-line no-await-in-loop
            minifyCode(await fs.readFile(file, 'utf-8')),
            'utf-8',
          );
          console.log(`Removed comments from ${basename(file)}`);
        }
        /* eslint-enable no-await-in-loop */
      }

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

      const findContractPathInProject = (contractName: string) =>
        `${relative(
          __dirname,
          contractPaths[contractNames.indexOf(contractName)],
        )}:${contractName}`;

      if (!noVerify && !localNetwork) {
        const contracts = await getDeployedContractsForNetwork(
          network as NetworkName,
        );
        const newDeployedContracts = Array.from({
          length: contracts.length - lengthBefore,
        }).map((_, index) => contracts[lengthBefore + index]);

        /* eslint-disable no-await-in-loop */
        for (const { contractName, address } of newDeployedContracts) {
          const contract = findContractPathInProject(contractName);

          for (; ;) {
            try {
              ((hre as unknown) as {
                skipCompile?: boolean;
              }).skipCompile = true;
              await hre.run(TASK_VERIFY_VERIFY, {
                address,
                constructorArguments: (
                  await getDeployedContractsConstructorArgumentsForNetwork(
                    network as NetworkName,
                  )
                )[address],
                contract,
              });
              delete ((hre as unknown) as { skipCompile?: boolean })
                .skipCompile;
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
                `hardhat verify ${address} --constructor-args ${constructorArgs} --contract '${contract}' --network ${network}`,
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
