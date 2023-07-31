/* eslint-disable no-sequences */
/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./string.prototype.replaceall.d.ts" />

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
import { task, task as createOrModifyHardhatTask } from 'hardhat/config';

import {
  NetworkName,
  networkNameToId,
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
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';

// import fse from 'fs-extra';

const TASK_DEPLOY = 'deploy';

export function modifiyGetMinimumBuild(): void {
  createOrModifyHardhatTask(TASK_VERIFY_GET_MINIMUM_BUILD).setAction(() =>
    Promise.resolve(1),
  );
}

export function modifiyVerifyMinimumBuild(): void {
  createOrModifyHardhatTask(TASK_VERIFY_VERIFY_MINIMUM_BUILD).setAction(() =>
    Promise.resolve(false),
  );
}

export function modifyCompile(contractsPath: string, deployPath: string): void {
  createOrModifyHardhatTask(TASK_COMPILE).setAction(
    async (args, hre, runSuper) => {
      if ((hre as unknown as { skipCompile?: boolean }).skipCompile) return;

      const prepare =
        (hre as unknown as { fromDeployScript?: boolean }).fromDeployScript !==
          true &&
        (hre as unknown as { fromTestScript?: boolean }).fromTestScript !==
          true;

      if (prepare) {
        clean(hre.config.paths);
        await gatherAllFiles(contractsPath, deployPath);
      }
      await runSuper(args);
    },
  );
}

export function modifyTest(contractsPath: string, deployPath: string): void {
  createOrModifyHardhatTask(TASK_TEST)
    .addFlag('debug', 'Compile without optimizer')
    .setAction(async (taskArgs, hre, runSuper) => {
      const { debug } = taskArgs;
      const prepare =
        (hre as unknown as { fromDeployScript?: boolean }).fromDeployScript !==
        true;

      if (prepare) {
        console.log(0, {
          TASK_TEST,
          taskArgs,
          'process.env.MIGRATION_TYPE ': process.env.MIGRATION_TYPE,
        });
        await gatherAllFiles(contractsPath, deployPath);
      }

      if (debug) {
        console.log(
          'Debug test mode enabled - unlimited block gas limit and contract size',
        );
        hre.config.networks.hardhat.allowUnlimitedContractSize = true;
        hre.config.networks.hardhat.blockGasLimit = 0x1fffffffffffff;
        hre.config.networks.hardhat.gas = 12000000;
      }

      console.log(3, {
        TASK_TEST,
        taskArgs,
        'process.env.MIGRATION_TYPE ': process.env.MIGRATION_TYPE,
      });
      console.log('hello', { taskArgs });
      (hre as unknown as { fromTestScript?: boolean }).fromTestScript = true;
      await runSuper(taskArgs);
      delete (hre as unknown as { fromTestScript?: boolean }).fromTestScript;

      if (prepare) {
        delete (
          hre as {
            migrationScript?: string;
          }
        ).migrationScript;
      }
      console.log('goodbye');
    });
}

export function modifyAccounts(): void {
  createOrModifyHardhatTask(
    'accounts',
    'Prints the list of accounts',
    async (_, hre) => {
      const accounts = await hre.web3.eth.getAccounts();
      console.log(accounts);
    },
  );
}

export function modifyDeploy(module: string): void {
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
          skipTest,
          skipClean,
        }: {
          migrationScript: string;
          noVerify: boolean;
          skipTest: boolean;
          skipClean: boolean;
        },
        hre,
      ) => {
        if (!skipClean) await clean(hre.config.paths);

        console.log('1', { skipTest, migrationScript, skipClean });

        const { name: network } = hre.network;
        const migrationsGlobPattern = `${module}/migrations/??_deploy_*.js`;

        if (migrationScript === 'all') {
          for (const migrationScriptPath of await globby(
            migrationsGlobPattern,
          )) {
            // eslint-disable-next-line no-await-in-loop
            await hre.run(TASK_DEPLOY, {
              migrationScript: migrationScriptPath
                .split('/')
                .reverse()[0]
                .split('_deploy_')[1]
                .split('.js')[0],
              noVerify,
              skipTest,
              skipClean,
            });
          }

          return;
        }

        const migrationScriptPath = await getMigrationScriptPath(
          migrationScript,
          migrationsGlobPattern,
        );

        const localNetwork = !network || network.endsWith('_fork');

        const lengthBefore = localNetwork
          ? 0
          : (await getDeployedContractsForNetwork(network as NetworkName))
              .length;

        // Search for calls to artifacts.require and get value of first argument
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const contractNames =
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require(migrationScriptPath).getContracts() as string[];
        delete require.cache[require.resolve(migrationScriptPath)];

        /* eslint-disable no-await-in-loop */
        const srcPath = resolve('./contracts');
        const { sources, cache } = hre.config.paths;
        const contractPaths = await Promise.all(
          contractNames.map(async name => {
            if (name.includes('/')) {
              const resolvedPath = await customResolve(
                `${name.includes(':') ? name.split(':')[0] : name}.sol`,
              );
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

        // Etherscan has a limit of 500k chars when verifying contracts
        const files = (await globby(`${resolve(sources)}/**/*.sol`)).sort(); // Starts with folders that begin with `@` if any

        /* eslint-disable no-await-in-loop */
        // 480_000 wasn't enough
        for (
          let i = 0;
          skipClean
            ? i >= files.length
            : (await getAllFilesLength(files)) > 470_000;
          i++
        ) {
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

        (
          hre as {
            migrationScript?: string;
          }
        ).migrationScript = migrationScript; // Used in test/truffle-fixture.js
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

        (
          hre as {
            fromDeployScript?: boolean;
          }
        ).fromDeployScript = true;

        if (!skipTest) {
          await hre.run(TASK_TEST, { testFiles: [testPath] });
        }
        delete (
          hre as {
            migrationScript?: string;
          }
        ).migrationScript;
        delete (
          hre as {
            fromDeployScript?: boolean;
          }
        ).fromDeployScript;

        const findContractPathInProject = (contractName: string) =>
          `${relative(
            module,
            contractPaths[
              contractNames.findIndex(
                item =>
                  (item.includes(':') ? item.split(':')[1] : item) ===
                  contractName,
              )
            ],
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

            for (;;) {
              try {
                (
                  hre as unknown as {
                    skipCompile?: boolean;
                  }
                ).skipCompile = true;
                await hre.run(TASK_VERIFY_VERIFY, {
                  address,
                  constructorArguments: (
                    await getDeployedContractsConstructorArgumentsForNetwork(
                      network as NetworkName,
                    )
                  )[address],
                  contract,
                });
                delete (hre as unknown as { skipCompile?: boolean })
                  .skipCompile;
                break;
              } catch (error: any) {
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
                const { stdout, stderr } = await exec(
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
}

export function compile(): void {
  task(TASK_COMPILE, async (args, hre, runSuper) => {
    await runSuper();
    if (
      (
        hre as {
          migrationScript?: string;
        }
      ).migrationScript !== 'uma'
    ) {
      const distBaseDir = './dist/contracts';

      const config: Config = {
        outputPaths: {
          rootDir: hre.config.paths.root,
          abiDir: `${distBaseDir}/abi`,
          typechainDir: `${distBaseDir}/typechain`,
        },
        getAllFullyQualifiedNames: () =>
          hre.artifacts.getAllFullyQualifiedNames(),
        readArtifact: filename => hre.artifacts.readArtifact(filename),
        clear: true,
        flat: true,
      };
      await generateArtifacts(config);
    }
  });
}

function gatherAllFiles(contractsPath: string, deployPath: string) {
  return gatherFiles(contractsPath, deployPath);
}

async function clean(
  {
    sources,
    artifacts,
    cache,
  }: { sources: string; artifacts: string; cache: string },
  withSources = true,
) {
  if (withSources) rmrf(sources);
  rmrf(artifacts);
  rmrf(cache);
  await Promise.all([
    withSources ? fs.mkdir(sources) : Promise.resolve(),
    fs.mkdir(artifacts),
    fs.mkdir(cache),
  ]);
}

async function exists(path: string) {
  try {
    await fs.access(path, fsConstants.F_OK);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
  return true;
}

async function findContract({ dir, name }: { dir: string; name: string }) {
  /* eslint-disable no-await-in-loop */
  for (const solidityFile of await globby(`${dir}/**/*.sol`)) {
    const { children } = (await parse(
      await fs.readFile(solidityFile, 'utf-8'),
    )) as unknown as {
      children: Token[];
    };

    if (
      children.find(
        child =>
          child.type === 'ContractDefinition' &&
          name ===
            (
              child as unknown as {
                type: 'ContractDefinition';
                name: string;
              }
            ).name,
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

/**
 * Doesn't resolve symlinks like require.resolve does
 */
async function customResolve(path: string) {
  for (const modulesPath of assertNotNull(require.main).paths) {
    const pathToResolve = `${modulesPath}/${path}`;
    // eslint-disable-next-line no-await-in-loop
    if (await exists(pathToResolve)) {
      return pathToResolve;
    }
  }

  throw new Error(`Module '${path}' not found`);
}

async function gatherFiles(
  contractPath: string,
  dir: string,
  moduleName?: string,
  gathered: string[] = [contractPath],
  importedFrom = '',
) {
  const contractDir = dirname(resolve(contractPath));
  const contractCopyPath = moduleName
    ? join(
        dir,
        relative(contractDir.split(moduleName)[0], contractDir),
        basename(contractPath),
      )
    : join(dir, relative(dirname(dir), contractDir), basename(contractPath));

  let mainContractContent = await readContracts(contractPath, importedFrom);

  await fs.mkdir(dirname(contractCopyPath), { recursive: true });

  const externalImports: Record<string, string> = {};

  const { children } = (await parse(mainContractContent)) as unknown as {
    children: Token[];
  };

  for (const child of children) {
    if (child.type === 'ImportDirective') {
      const { path: importedContractPath } = child as unknown as {
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
        // eslint-disable-next-line no-await-in-loop
        abosolutePath = await customResolve(importedContractPath);
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
        await gatherFiles(
          abosolutePath,
          dir,
          externalModule,
          gathered,
          contractPath,
        );
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

async function readContracts(contractPath: string, importedPath: string) {
  try {
    return await fs.readFile(contractPath, 'utf-8');
  } catch {
    throw new Error(
      `Could not read ${contractPath} which was imported from ${importedPath}`,
    );
  }
}

async function getMigrationScriptPath(
  migrationScript: string,
  migrationsGlobPattern: string,
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

function timeout(time: number) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, time));
}

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
