import { InjectedConnector } from '@web3-react/injected-connector';
import { WalletConnectConnector } from '@web3-react/walletconnect-connector';

const RPC_URLS: { [chainId: number]: string } = {
  1: 'https://mainnet.infura.io/v3/0490b932d1644f6387124848d92fe32f' as string,
  42: 'https://kovan.infura.io/v3/0490b932d1644f6387124848d92fe32f' as string,
};

export const injected = new InjectedConnector({
  supportedChainIds: [1, 42],
});

export const walletconnect = new WalletConnectConnector({
  rpc: { 1: RPC_URLS[1] },
  bridge: 'https://bridge.walletconnect.org',
  qrcode: true,
  pollingInterval: 100000,
});
