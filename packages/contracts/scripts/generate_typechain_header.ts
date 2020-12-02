import { promises as fs, readFileSync, lstatSync } from 'fs';
import { basename, normalize, resolve } from 'path';
import { strict as assert } from 'assert';
import { merge as _merge } from 'lodash';
import { DeepPartial } from '@jarvis-network/web3-utils/base/meta';

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
  assert(
    lstatSync(contractsDir).isDirectory(),
    `'${contractsDir}' is not a directory.`,
  );
  const importTagged = {
    types: ['Tagged'],
    module: '@jarvis-network/web3-utils/base/tagged-type',
  };
  await execTask(
    'Generating index.ts of all *.json ABI files',
    writeHeaderFile(`${contractsDir}/abi`, {
      ext: '.json',
      imports: [{ types: ['AbiItem'], module: 'web3-utils' }, importTagged],
    }),
  );
  await execTask(
    'Generating index.ts of all *.d.ts TypeChain',
    writeHeaderFile(`${contractsDir}/typechain`, {
      ext: '.d.ts',
      unionName: 'KnownContract',
      unionTypeMapFun: type => `Tagged<${type}, '${type}'>`,
      imports: [importTagged],
    }),
  );
  logSeparate('All header files generated successfully.');
}

async function writeHeaderFile(dir: string, headerGenParams: HeaderGenParams) {
  const path = normalize(dir);
  const files = await fs.readdir(dir);
  const entries = files
    .filter(f => basename(f) !== 'index.ts')
    .map(f => normalize(`${dir}/${f}`));
  if (entries.length !== files.length) {
    console.log(`'${path}/index.ts' exists - overwriting.`);
  }
  const headerContent = generateHeader(entries, headerGenParams);
  await fs.writeFile(`${path}/index.ts`, headerContent, 'utf-8');
}

interface TypeImport {
  module: string;
  types: string[];
}

interface HeaderGenParams {
  ext: string;
  unionName?: string;
  unionTypeMapFun?: (type: string) => string;
  imports?: TypeImport[];
}

function generateHeader(
  typePaths: string[],
  { ext, unionName, unionTypeMapFun, imports }: HeaderGenParams,
) {
  const names: string[] = typePaths.map(p => stripExt(basename(p), ext));
  let output =
    '/* File autogenerated by synthereum-lib. Do not edit manually. */\n\n';

  output += mkImports(imports ?? []);

  if (unionName && unionName.length > 0)
    output +=
      mkUnionType(
        unionName,
        names.filter(n => n !== 'types').map(unionTypeMapFun ?? (x => x)),
      ) + '\n';

  output += typePaths
    .map((filepath, i) => {
      const name = names[i];
      return ext !== '.json'
        ? generateDTsImport(filepath, name)
        : shouldGenerateAbiJsonImport(filepath)
        ? mkAbiJsonExport(name)
        : '';
    })
    .filter(x => x.length)
    .join('\n');
  return output;
}

function generateDTsImport(filename: string, name: string): string {
  assert(
    filename.slice(-5) === '.d.ts',
    `Expected '.d.ts' file extension, but got filename: '${filename}'`,
  );
  const allExportedSymbols = getAllModuleExports(filename);

  // Specially handle the `types.d.ts` file:
  if (name === 'types') {
    return mkExportTypesFrom(allExportedSymbols, './types');
  }

  const auxiliaryTypes = allExportedSymbols.filter(t => t !== name);

  let result =
    mkImport({ module: './' + name, types: [name] }) +
    mkExportTypesFrom([name]);

  if (auxiliaryTypes.length) {
    const importedAsTypes = auxiliaryTypes.map(t => `${t} as ${name}_${t}`);
    const exportTypes = auxiliaryTypes
      .map(t => '  ' + mkExportTypeAlias(t, `${name}_${t}`))
      .join('');

    result +=
      mkImport({ module: './' + name, types: importedAsTypes }) +
      `export namespace ${name}_Events {\n${exportTypes}}\n`;
  }

  return result;
}

export function getAllModuleExports(moduleFileName: string): string[] {
  const ts = readFileSync(moduleFileName, 'utf-8');
  return [...ts.matchAll(/export [\w]+? ([\w].+?)[ <]/g)].map(x => x[1]);
}

function shouldGenerateAbiJsonImport(filename: string) {
  const json = JSON.parse(readFileSync(filename, 'utf-8'));
  return (json.abi as any[])?.length > 0;
}

type WrappableString = (maxLineLength: number) => string;

function mkAbiJsonExport(name: string) {
  return (
    mkImport({
      module: `../typechain/${name}`,
      types: [name],
    }) +
    mkJsonExport(`${name}_Abi`, `./${name}`, max =>
      mkGenericTypeInstance('Tagged', ['AbiItem[]', name], max),
    )
  );
}

function mkJsonExport(
  name: string,
  filename: string,
  asType?: WrappableString,
  maxLength = 80,
): string {
  const start = `export const ${name} = require('${filename}.json').abi`;
  maxLength -= 4 + start.length + 1;
  return start + (asType ? ` as ${asType(maxLength)};\n` : ';\n');
}

function mkGenericTypeInstance(
  name: string,
  typeArgs: string[],
  maxLength: number,
) {
  maxLength -= name.length + 2;
  return `${name}<${mkCommaList(typeArgs, {
    maxLength,
    leadingSymbol: { ifBreak: '\n  ', ifNoBreak: '' },
    endingSymbol: { ifBreak: '\n', ifNoBreak: '' },
  })}>`;
}

function mkImports(imports: TypeImport[]): string {
  return imports.map(i => mkImport(i)).join('') + nlIf(imports.length > 0);
}

function mkImport(
  { types: ts, module: m }: TypeImport,
  maxLength = 80,
): string {
  maxLength -= 23 + m.length;
  return `import type {${mkCommaList(ts, { maxLength })}} from '${m}';\n`;
}

function mkExportTypesFrom(types: string[], from?: string, maxLength = 80) {
  const hasFrom = from && from.length;
  const fromLen = hasFrom ? 8 + from!.length : 0;
  const baselineLength = 14 + fromLen;
  maxLength -= baselineLength;
  return (
    `export type {${mkCommaList(types, { maxLength })}}` +
    (hasFrom ? ` from '${from}';\n` : ';\n')
  );
}

function mkExportTypeAlias(exportedName: string, typeExpr: string) {
  return `export type ${exportedName} = ${typeExpr};\n`;
}

function mkUnionType(unionName: string, types: string[]) {
  const startingLength = 15 + unionName.length;
  const remainingLen = 80 - startingLength;
  return `export type ${unionName} =${mkPipeList(types, remainingLen)};\n`;
}

function mkPipeList(items: string[], maxLength: number) {
  return mkList(items, {
    maxLength,
    leadingSymbol: { ifBreak: '\n  | ', ifNoBreak: ' ' },
    endingSymbol: { ifBreak: '', ifNoBreak: '' },
    separator: { ifBreak: '| ', ifNoBreak: ' | ' },
    ifBreakPlaceSeparatorAfterNewline: true,
  });
}

function mkCommaList(
  items: string[],
  customConfig: DeepPartial<MkListConfig> & { maxLength: number },
) {
  const defaultConfig: Partial<MkListConfig> = {
    leadingSymbol: { ifBreak: '\n  ', ifNoBreak: ' ' },
    endingSymbol: { ifBreak: ',\n', ifNoBreak: ' ' },
    separator: { ifBreak: ',', ifNoBreak: ', ' },
    ifBreakPlaceSeparatorAfterNewline: false,
  };
  const finalConfig = _merge(defaultConfig, customConfig);
  return mkList(items, finalConfig);
}

interface MkListConfig {
  maxLength: number;
  leadingSymbol: { ifBreak: string; ifNoBreak: string };
  endingSymbol: { ifBreak: string; ifNoBreak: string };
  separator: { ifBreak: string; ifNoBreak: string };
  ifBreakPlaceSeparatorAfterNewline: boolean;
}

function mkList(
  list: string[],
  {
    maxLength = 80,
    leadingSymbol = { ifNoBreak: ' ', ifBreak: '\n  ' },
    endingSymbol = { ifNoBreak: ' ', ifBreak: '' },
    separator = { ifBreak: ',', ifNoBreak: ', ' },
    ifBreakPlaceSeparatorAfterNewline = false,
  }: Partial<MkListConfig>,
) {
  const newlineIndent = '\n  ';
  maxLength -=
    leadingSymbol.ifNoBreak.length +
    endingSymbol.ifNoBreak.length +
    (list.length - 1) * separator.ifNoBreak.length;
  const breakList =
    list.length !== 1 &&
    !isSumLessThanOrEqualTo(list, expr => expr.length, maxLength);
  const key = breakList ? 'ifBreak' : 'ifNoBreak';
  const leading = leadingSymbol[key];
  const ending = endingSymbol[key];
  const sep = !breakList
    ? separator.ifNoBreak
    : ifBreakPlaceSeparatorAfterNewline
    ? newlineIndent + separator.ifBreak
    : separator.ifBreak + newlineIndent;
  return leading + list.join(sep) + ending;
}

function isSumLessThanOrEqualTo<T>(
  array: T[],
  mapItemToNumber: (item: T) => number,
  max: number,
) {
  return (
    accumulateUntil(
      array,
      0,
      (result, next) => result + mapItemToNumber(next),
      result => result <= max,
    ) <= max
  );
}

type Iteration<State, Next, Result = State> = (
  state: State,
  next: Next,
) => Result;

function accumulateUntil<Elem, Result>(
  array: Elem[],
  initialState: Result,
  combine: Iteration<Result, Elem>,
  shouldContinue: (state: Result) => boolean,
) {
  let state = initialState;
  for (let i = 0; i < array.length; i++) {
    state = combine(state, array[i]);
    if (!shouldContinue(state)) break;
  }
  return state;
}

/**
 * Generates a new line if `x` is true.
 */
function nlIf(x: boolean) {
  return x ? '\n' : '';
}

/**
 * Strips `ext` from the end of `fileName` while asserting that `fileName` ends with `ext`.
 */
function stripExt(fileName: string, ext: string) {
  assert(ext.length < fileName.length, 'File name too short');
  assert(
    fileName.slice(-ext.length) == ext,
    `File name '${fileName}' doesn't end with extension '${ext}'`,
  );
  return fileName.slice(0, fileName.length - ext.length);
}

async function execTask(msg: string, task: Promise<void>) {
  logSeparate(msg);
  await task;
  console.log('DONE');
}

function logSeparate(msg: string) {
  console.log(`-------------------\n${msg}`);
}
