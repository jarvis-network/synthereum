/// <reference path="./types.d.ts" />

import { parse as parsePath } from 'path';

import yargs from 'yargs/yargs';
import type { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';

import {
  parseSupportedNetworkId,
  SupportedNetworkId,
} from '@jarvis-network/synthereum-ts/dist/config';

export function buildCli(
  scriptName: string,
): Argv<{
  network: SupportedNetworkId;
}> {
  return yargs(hideBin(process.argv))
    .help()
    .parserConfiguration({
      'duplicate-arguments-array': false,
      'flatten-duplicate-arrays': true,
    })
    .scriptName(parsePath(scriptName).name)
    .usage('$0 [options]')
    .option('network', {
      type: 'string',
      array: false,
      default: 1,
      coerce: x => parseSupportedNetworkId(x),
    });
}

export function arrayCliArg(arg: string[] = []): string[] {
  return Array.isArray(arg) && arg.length === 1 && arg[0].indexOf(',') > -1
    ? arg[0].split(',')
    : arg;
}
