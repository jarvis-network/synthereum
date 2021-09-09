import { assets, assetsPolygon } from '@/data/assets';
import { useWeb3 } from '@jarvis-network/app-toolkit';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';

export function useAssets() {
  const { chainId: networkId } = useWeb3();
  return networkId === Network.polygon || networkId === Network.mumbai
    ? assetsPolygon
    : assets;
}
