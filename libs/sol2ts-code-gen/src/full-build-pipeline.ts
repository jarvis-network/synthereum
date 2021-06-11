/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

import { mkdir, rmdir, writeFile, rm } from 'fs/promises';
import { join, resolve } from 'path';

import { from, lastValueFrom } from 'rxjs';
import { filter, map, mergeAll, mergeMap, mergeWith } from 'rxjs/operators';

import {
  initTypechain,
  runTypeChain,
  saveCommonTypes,
} from './code-gen/typechain';
import { writeHeaderFile } from './code-gen/drivers';
import { execTask } from './utils';
import { compileTypeScriptFiles } from './code-gen/typescript';

export interface Artifact {
  contractName: string;
  sourceName: string;
  abi: unknown[];
}

export interface Config {
  outputPaths: {
    rootDir: string;
    abiDir: string;
    typechainDir: string;
  };
  getAllFullyQualifiedNames: () => Promise<string[]>;
  readArtifact: (fullName: string) => Promise<Artifact>;
  clear: boolean;
  flat: boolean;
  only?: string[];
  except?: string[];
}

export async function generateArtifacts(config: Config): Promise<void> {
  const { abiDir, typechainDir, rootDir } = config.outputPaths;

  console.log('Starting sol2-ts-code-gen');

  const typechain = initTypechain();

  await prepareOutputDirs(config);

  await lastValueFrom(
    from(config.getAllFullyQualifiedNames())
      .pipe(
        mergeAll(),
        filter(f => includeFile(f.split(':')[0], config.only, config.except)),
        mergeMap(f => config.readArtifact(f)),
        filter(a => a.abi.length > 0),
        map(({ abi, sourceName, contractName }) => ({
          contents: `${JSON.stringify(abi, null, 2)}\n`,
          path: join(
            abiDir,
            config.flat ? '' : sourceName,
            `${contractName}.json`,
          ),
        })),
        mergeMap(async ({ contents, path }) => {
          console.log('Saving ABI file:', path);
          await writeFile(path, contents, 'utf-8');
          return { path, contents };
        }),
        mergeMap(info => runTypeChain(typechain, info, typechainDir)),
      )
      .pipe(mergeWith(from(saveCommonTypes(typechain, typechainDir)))),
  );

  const importTagged = {
    types: ['Tagged'],
    module: '@jarvis-network/core-utils/dist/base/tagged-type',
  };

  await execTask('Generating index.ts of all *.json ABI files', () =>
    writeHeaderFile(abiDir, abiDir, {
      ext: '.json',
      imports: [{ types: ['AbiItem'], module: 'web3-utils' }, importTagged],
    }),
  );

  await execTask('Generating index.ts of all *.d.ts TypeChain', () =>
    writeHeaderFile(typechainDir, typechainDir, {
      ext: '.d.ts',
      unionName: 'KnownContract',
      unionTypeMapFun: type => `Tagged<${type}, '${type}'>`,
      imports: [importTagged],
    }),
  );

  await execTask('Compiling index.ts files', async () => {
    const files = [
      resolve(rootDir, abiDir, 'index.ts'),
      resolve(rootDir, typechainDir, 'index.ts'),
    ];
    compileTypeScriptFiles({
      files,
      tsConfigDir: rootDir,
    });
    for (const file of files) {
      await rm(file);
      console.log('Deleted:', file);
    }
  });
}

async function prepareOutputDirs(config: Config) {
  const { rootDir, ...outputPaths } = config.outputPaths;

  for (let dir of Object.values(outputPaths)) {
    dir = resolve(dir);
    // Validate output paths:
    if (!dir.startsWith(rootDir))
      throw new Error('resolved path must be inside of project directory');
    if (dir === rootDir)
      throw new Error('resolved path must not be root directory');
    // Clean previous artifacts:
    if (config.clear) await rmdir(dir, { recursive: true });
    // Create dirs if necessary:
    await mkdir(dir, { recursive: true });
  }
}

function includeFile(
  filename: string,
  inclusions?: string[],
  exclusions?: string[],
) {
  return (
    (inclusions?.some(re => filename.match(re)) ?? true) &&
    !exclusions?.some(re => filename.match(re))
  );
}
