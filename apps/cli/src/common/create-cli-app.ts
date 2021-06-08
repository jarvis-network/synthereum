import type { Argv } from 'yargs';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import { networkIdToName } from '@jarvis-network/core-utils/dist/eth/networks';
import { log, logError } from '@jarvis-network/core-utils/dist/logging';
import {
  parseSupportedNetworkId,
  SupportedNetworkId,
} from '@jarvis-network/synthereum-ts/dist/config';
import { Web3On } from '@jarvis-network/core-utils/dist/eth/web3-instance';

type ArgvWithNet<ExtraArgs> = Argv<
  {
    network: SupportedNetworkId;
  } & ExtraArgs
>;

export function createCliApp<ExtraArgs>(
  cli: ArgvWithNet<ExtraArgs>,
  mainFunc: (params: {
    web3: Web3On<SupportedNetworkId>;
    netId: SupportedNetworkId;
    argv: typeof cli['argv'];
  }) => Promise<void>,
): void {
  const { argv } = cli;
  const { network } = argv;
  const netId = parseSupportedNetworkId(network);
  const web3 = getInfuraWeb3(netId);
  log('web3 instance connected to:', networkIdToName[netId]);
  mainFunc({
    web3,
    netId,
    argv,
  })
    .then(_ => process.exit(0))
    .catch(err => {
      logError(err);
      process.exit(1);
    });
}
