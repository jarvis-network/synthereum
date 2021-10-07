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
    networkId === Network.mainnet || networkId === Network.polygon
      ? ''
      : `${networkIdToName[networkId]}.`
  }${
    networkId === Network.polygon || networkId === Network.mumbai
      ? 'polygonscan.com'
      : 'etherscan.io'
  }/tx/${txHash}`;
