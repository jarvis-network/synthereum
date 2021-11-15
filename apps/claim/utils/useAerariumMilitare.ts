import { useWeb3 } from '@jarvis-network/app-toolkit';
import {
  AbiFor,
  getContract,
} from '@jarvis-network/core-utils/dist/eth/contracts/get-contract';
import {
  NetworkName,
  Web3On,
} from '@jarvis-network/core-utils/dist/eth/web3-instance';
import { useMemo } from 'react';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import { ContractInstance } from '@jarvis-network/core-utils/dist/eth/contracts/types';

import { AerariumMilitare } from '@/data/AerariumMilitare';
import { addresses } from '@/data/addresses';
import {
  isSupportedNetwork,
  SupportedNetworkId,
} from '@/utils/supportedNetworks';

import ABI from '../data/abi.json';

export function useAerariumMilitare():
  | (ContractInstance<NetworkName, AerariumMilitare> & {
      networkId: SupportedNetworkId;
    })
  | null {
  const { library: web3, chainId: networkId } = useWeb3();

  return useMemo(
    () =>
      web3 && isSupportedNetwork(networkId)
        ? {
            ...getContract(
              web3 as Web3On<NetworkName>,
              ABI as AbiFor<AerariumMilitare>,
              addresses[networkId].AerariumMilitare as AddressOn<NetworkName>,
            ),
            networkId,
          }
        : null,
    [web3, networkId],
  );
}
