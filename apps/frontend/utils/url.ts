import {
  NetworkId,
  networkIdToName,
  Network,
} from '@jarvis-network/core-utils/dist/eth/networks';

export const getEtherscanTransactionURL = (
  txHash: string,
  networkId: NetworkId,
): string =>
  `https://${
    networkId === Network.mainnet ? '' : `${networkIdToName[networkId]}.`
  }etherscan.io/tx/${txHash}`;
