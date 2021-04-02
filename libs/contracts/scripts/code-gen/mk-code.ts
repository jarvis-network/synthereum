import { DeepPartial } from '@jarvis-network/core-utils/dist/base/meta';
import { isSumLessThanOrEqualTo } from '@jarvis-network/core-utils/dist/base/array-fp-utils';
import _merge from 'lodash/merge';

export interface TypeImport {
  module: string;
  types: string[];
}

type WrappableString = (maxLineLength: number) => string;

export function mkAbiJsonExport(name: string): string {
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
  const start = `export const ${name} = require('${filename}.json')`;
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

export function mkImports(imports: TypeImport[]): string {
  return imports.map(i => mkImport(i)).join('') + nlIf(imports.length > 0);
}

export function mkImport(
  { types: ts, module: m }: TypeImport,
  maxLength = 80,
): string {
  maxLength -= 23 + m.length;
  return `import type {${mkCommaList(ts, { maxLength })}} from '${m}';\n`;
}

export function mkExportTypesFrom(
  types: string[],
  from?: string,
  maxLength = 80,
): string {
  const hasFrom = from && from.length;
  const fromLen = hasFrom ? 8 + from!.length : 0;
  const baselineLength = 14 + fromLen;
  maxLength -= baselineLength;
  return `export type {${mkCommaList(types, { maxLength })}}${
    hasFrom ? ` from '${from}';\n` : ';\n'
  }`;
}

export function mkExportTypeAlias(
  exportedName: string,
  typeExpr: string,
): string {
  return `export type ${exportedName} = ${typeExpr};\n`;
}

export function mkUnionType(unionName: string, types: string[]): string {
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

/**
 * Generates a new line if `x` is true.
 */
function nlIf(x: boolean) {
  return x ? '\n' : '';
}
