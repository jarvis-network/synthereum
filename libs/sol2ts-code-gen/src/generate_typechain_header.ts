import { promises as fs, lstatSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { strict as assert } from 'assert';

import { writeHeaderFile } from './code-gen/drivers';

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1);
  });

async function main() {
  assert(
    process.argv.length === 3,
    `Usage: node generate_typechain_header <dir>\n  argv: [${process.argv}]`,
  );
  const contractsDir = resolve(process.argv[2]);
  const contractsAbiDir = join(contractsDir, 'abi');
  const contractsBuildDir = join(
    dirname(dirname(contractsDir)),
    `/build/contracts`,
  );
  const contractsDistAbiDir = join(
    dirname(dirname(contractsDir)),
    `dist/src/contracts/abi`,
  );
  assert(
    lstatSync(contractsDir).isDirectory(),
    `'${contractsDir}' is not a directory.`,
  );
  const importTagged = {
    types: ['Tagged'],
    module: '@jarvis-network/core-utils/dist/base/tagged-type',
  };

  await execTask('Copying json files to src', () =>
    copyJsonFiles({
      from: contractsBuildDir,
      to: contractsAbiDir,
    }),
  );
  await execTask('Generating index.ts of all *.json ABI files', () =>
    writeHeaderFile(contractsAbiDir, {
      ext: '.json',
      imports: [{ types: ['AbiItem'], module: 'web3-utils' }, importTagged],
    }),
  );
  await execTask('Generating index.ts of all *.d.ts TypeChain', () =>
    writeHeaderFile(`${contractsDir}/typechain`, {
      ext: '.d.ts',
      unionName: 'KnownContract',
      unionTypeMapFun: type => `Tagged<${type}, '${type}'>`,
      imports: [importTagged],
    }),
  );
  await execTask('Preparing optimized ABI json files', () =>
    prepareAbiJSONFiles({
      from: contractsBuildDir,
      to: [contractsAbiDir, contractsDistAbiDir],
    }),
  );
  logSeparate('All header files generated successfully.');
}

interface CopyOptions {
  from: string;
  to: string;
}

async function copyJsonFiles({ from, to }: CopyOptions) {
  const list = (await fs.readdir(from)).filter(fname =>
    fname.toLowerCase().endsWith('.json'),
  );
  const promises = list.map(async fname => {
    const fromPath = join(from, fname);
    const toPath = join(to, fname);
    await fs.copyFile(fromPath, toPath);
  });

  return Promise.all(promises).then(() => undefined); // then is to satisfy TS
}

interface PrepareAbiOptions {
  from: string;
  to: string[];
}

async function prepareAbiJSONFiles({ to, from }: PrepareAbiOptions) {
  await Promise.all(to.map(t => fs.mkdir(t, { recursive: true })));

  const list = (await fs.readdir(from)).filter(fname =>
    fname.toLowerCase().endsWith('.json'),
  );
  console.info(list.join(', '));
  const promises = list.map(async fname => {
    const contents = JSON.parse(String(await fs.readFile(join(from, fname))));
    if (!contents.abi) {
      throw new Error(`File ${fname} has no abi field.`);
    }
    await Promise.all(
      to.map(t => fs.writeFile(join(t, fname), JSON.stringify(contents.abi))),
    );
  });

  return Promise.all(promises).then(() => undefined); // then is to satisfy TS
}

async function execTask(msg: string, task: () => Promise<void>) {
  logSeparate(msg);
  await task();
  console.log('DONE');
}

function logSeparate(msg: string) {
  console.log(`-------------------\n${msg}`);
}
