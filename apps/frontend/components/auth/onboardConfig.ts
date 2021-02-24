import { Initialization } from 'bnc-onboard/dist/src/interfaces';
import { filterEmpty } from '@jarvis-network/web3-utils/base/optional';
import { getInfuraEndpoint } from '@jarvis-network/web3-utils/apis/infura';
import { parseSupportedNetworkId } from '@jarvis-network/synthereum-contracts/dist/src/config';

const MAIN_NETWORK_ID = 1;
export const NETWORK_ID = parseSupportedNetworkId(
  Number(process.env.NEXT_PUBLIC_NETWORK_ID) || 42,
);
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
  };
};

const getPortis = () => {
  if (!process.env.NEXT_PUBLIC_PORTIS_API_KEY) {
    return null;
  }

  return {
    walletName: 'portis',
    apiKey: process.env.NEXT_PUBLIC_PORTIS_API_KEY,
  };
};

const getFortmatic = () => {
  const KEY =
    NETWORK_ID === MAIN_NETWORK_ID
      ? process.env.NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET
      : process.env.NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET;
  if (!KEY) {
    return null;
  }
  return {
    walletName: 'fortmatic',
    apiKey: KEY,
  };
};

const getSquareLink = () => {
  if (!process.env.NEXT_PUBLIC_SQUARELINK_API_KEY) {
    return null;
  }
  return {
    walletName: 'squarelink',
    apiKey: process.env.NEXT_PUBLIC_SQUARELINK_API_KEY,
  };
};

const getRPCWalletConfig = <T extends string>(walletName: T) => {
  if (!process.env.NEXT_PUBLIC_INFURA_API_KEY) {
    return null;
  }
  return {
    walletName,
    rpcUrl: getInfuraEndpoint(
      NETWORK_ID,
      'https',
      process.env.NEXT_PUBLIC_INFURA_API_KEY,
    ),
  };
};

type OnboardConfig = Pick<
  Initialization,
  'dappId' | 'networkId' | 'walletSelect' | 'hideBranding'
>;

const getOnboardConfig = (): OnboardConfig => {
  return {
    dappId: ONBOARD_API_KEY,
    hideBranding: true,
    networkId: NETWORK_ID,
    walletSelect: {
      heading: 'Sing Up/In with your wallet',
      description: ' ', // space here to hide default text
      wallets: filterEmpty([
        { walletName: 'metamask' },
        getWalletConnect(),
        getPortis(),
        getFortmatic(),
        getSquareLink(),
        { walletName: 'dapper' },
        { walletName: 'authereum' },
        { walletName: 'trust' },
        { walletName: 'opera' },
        { walletName: 'coinbase' },
        { walletName: 'operaTouch' },
        { walletName: 'status' },
        { walletName: 'torus' },
        getRPCWalletConfig('walletLink'),
        getRPCWalletConfig('ledger'),
      ]),
    },
  };
};

export { getOnboardConfig };
