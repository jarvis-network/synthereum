import {
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';
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
import {
  isSupportedNetwork,
  SupportedNetworkId,
} from '@jarvis-network/synthereum-contracts/dist/src/config';
import { ContractInfo } from '@jarvis-network/core-utils/dist/eth/contracts/types';

import { AerariumMilitare } from '@/data/AerariumMilitare';
import { addresses } from '@/data/addresses';

import ABI from '../data/abi.json';

export function useAerariumMilitare():
  | (ContractInfo<NetworkName, AerariumMilitare> & {
      networkId: SupportedNetworkId;
    })
  | null {
  const { web3$, networkId$ } = useCoreObservables();
  const web3 = useBehaviorSubject(web3$) as Web3On<NetworkName> | null;
  const networkId = useBehaviorSubject(networkId$);

  return useMemo(
    () =>
      web3 && isSupportedNetwork(networkId)
        ? {
            ...getContract(
              web3,
              ABI as AbiFor<AerariumMilitare>,
              addresses[networkId].AerariumMilitare as AddressOn<NetworkName>,
            ),
            networkId,
          }
        : null,
    [web3, networkId],
  );
}
