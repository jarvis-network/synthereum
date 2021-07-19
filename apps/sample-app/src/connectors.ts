import { InjectedConnector } from '@web3-react/injected-connector';
import { WalletConnectConnector } from '@web3-react/walletconnect-connector';
import { FortmaticConnector } from '@web3-react/fortmatic-connector';
import { PortisConnector } from '@web3-react/portis-connector';
import { TorusConnector } from '@web3-react/torus-connector';

const RPC_URLS: { [chainId: number]: string } = {
  1: 'https://mainnet.infura.io/v3/0490b932d1644f6387124848d92fe32f' as string,
  42: 'https://kovan.infura.io/v3/0490b932d1644f6387124848d92fe32f' as string,
};

export const injected = new InjectedConnector({
  supportedChainIds: [1, 42],
});

export const walletconnect = new WalletConnectConnector({
  rpc: { 1: RPC_URLS[1], 42: RPC_URLS[42] },
  bridge: 'https://bridge.walletconnect.org',
  qrcode: true,
  pollingInterval: 100000,
});

export const fortmatic = new FortmaticConnector({
  apiKey: 'pk_test_2EFA70A16CF3D24E',
  chainId: 1,
});

export const portis = new PortisConnector({
  dAppId: '965b011b-1bcd-4d6f-8116-9f2ab514a245',
  networks: [1, 42],
});

export const torus = new TorusConnector({
  chainId: 1,
});
