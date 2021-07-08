import {
  NetworkId,
  networkIdToName,
} from '@jarvis-network/core-utils/dist/eth/networks';
import { MAIN_NETWORK_ID } from '@jarvis-network/app-toolkit';

export const getEtherscanTransactionURL = (
  txHash: string,
  networkId: NetworkId,
) =>
  `https://${
    networkId === MAIN_NETWORK_ID ? '' : `${networkIdToName[networkId]}.`
  }etherscan.io/tx/${txHash}`;
