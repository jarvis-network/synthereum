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
