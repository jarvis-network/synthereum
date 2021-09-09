import {
  useMulticallMultipleAddresses,
  Falsy,
} from '@jarvis-network/app-toolkit';
import { ERC20_Abi as erc20Abi } from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import { AbiItem } from 'ethereum-multicall/dist/esm/models';

export interface TokenBalance {
  type: 'BigNumber';
  hex: string;
}
export function useTokenBalances(
  tokenAddresses: Address[],
  walletAddress?: Address,
): (TokenBalance[] | Falsy)[] {
  return useMulticallMultipleAddresses(
    walletAddress ? tokenAddresses : [],
    (erc20Abi as unknown) as AbiItem[],
    'balanceOf',
    walletAddress ? [walletAddress] : [],
  );
}
