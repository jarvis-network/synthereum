import { writeFile } from 'fs/promises';
import { basename, join } from 'path';

import Web3V1 from '@typechain/web3-v1';

import { startingComments } from './drivers';
import { FileInfo } from './types';
import { formatWithPrettier } from './prettier';

export function initTypechain(): Web3V1 {
  return new Web3V1({
    // unused:
    cwd: '/',
    // unused:
    outDir: '.',
    // unused:
    target: 'web3-v1',
    // unused:
    flags: {
      environment: undefined,
      alwaysGenerateOverloads: false,
    },
    // unused:
    filesToProcess: [],
    // unused:
    allFiles: [],
  });
}

export async function runTypeChain(
  typechain: Web3V1,
  info: FileInfo,
  outputDir: string,
): Promise<void> {
  const { contents, path: tsName } = typechain.transformFile(info) as FileInfo;
  await formatAndSaveFile({
    contents,
    path: outputFilename(outputDir, tsName),
  });
}

export async function saveCommonTypes(
  typechain: Web3V1,
  outputDir: string,
): Promise<void> {
  const infos = typechain.afterRun();
  await Promise.all(
    infos.map(({ contents, path: originalPath }) =>
      formatAndSaveFile({
        contents,
        path: outputFilename(outputDir, originalPath),
      }),
    ),
  );
}

function outputFilename(outputDir: string, name: string) {
  return join(outputDir, basename(name).replace(/\.d\.ts$/, '.d.ts'));
}

async function formatAndSaveFile({ contents, path }: FileInfo) {
  const output = startingComments + contents;
  const formatted = await formatWithPrettier({ path, contents: output });
  console.log('Saving TS file:', path);
  await writeFile(path, formatted);
}
