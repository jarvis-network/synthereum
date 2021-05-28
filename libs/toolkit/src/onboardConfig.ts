import { Initialization } from 'bnc-onboard/dist/src/interfaces';
import { filterEmpty } from '@jarvis-network/core-utils/dist/base/optional';
import { getInfuraEndpoint } from '@jarvis-network/core-utils/dist/apis/infura';
import { SupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';

const ONBOARD_API_KEY = process.env.NEXT_PUBLIC_ONBOARD_API_KEY;

// Note: UI crashes instantly when walletConnect is used without an key
// Others will just fail on selecting them.

const getWalletConnect = () => {
  if (!process.env.NEXT_PUBLIC_INFURA_API_KEY) {
    return null;
  }
  return {
    walletName: 'walletConnect',
    infuraKey: process.env.NEXT_PUBLIC_INFURA_API_KEY,
    preferred: true,
  };
};

const getPortis = () => {
  if (!process.env.NEXT_PUBLIC_PORTIS_API_KEY) {
    return null;
  }

  return {
    walletName: 'portis',
    apiKey: process.env.NEXT_PUBLIC_PORTIS_API_KEY,
    preferred: true,
  };
};

const getFortmatic = (networkId: SupportedNetworkId) => {
  const KEY =
    networkId === Network.mainnet
      ? process.env.NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET
      : process.env.NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET;
  if (!KEY) {
    return null;
  }
  return {
    walletName: 'fortmatic',
    apiKey: KEY,
    preferred: true,
  };
};

const getRPCWalletConfig = <T extends string>(
  walletName: T,
  networkId: SupportedNetworkId,
) => {
  if (!process.env.NEXT_PUBLIC_INFURA_API_KEY) {
    return null;
  }
  return {
    walletName,
    rpcUrl: getInfuraEndpoint(
      networkId,
      'https',
      process.env.NEXT_PUBLIC_INFURA_API_KEY,
    ),
    preferred: true,
  };
};

const getOnboardConfig = (networkId: SupportedNetworkId): Initialization => ({
  dappId: ONBOARD_API_KEY,
  hideBranding: true,
  networkId,
  walletCheck: [
    { checkName: 'connect' },
    { checkName: 'derivationPath' },
    { checkName: 'accounts' },
  ],
  walletSelect: {
    heading: ' ',
    description: ' ', // space here to hide default text
    wallets: filterEmpty([
      { walletName: 'metamask', preferred: true },
      getWalletConnect(),
      getPortis(),
      getFortmatic(networkId),
      { walletName: 'authereum', preferred: true },
      { walletName: 'trust', preferred: true },
      { walletName: 'opera', preferred: true },
      { walletName: 'coinbase', preferred: true },
      { walletName: 'operaTouch', preferred: true },
      { walletName: 'status', preferred: true },
      { walletName: 'torus', preferred: true },
      getRPCWalletConfig('walletLink', networkId),
      getRPCWalletConfig('ledger', networkId),
    ]),
  },
});

export { getOnboardConfig };
