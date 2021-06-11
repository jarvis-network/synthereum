import {
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import {
  AbiFor,
  getContract,
} from '@jarvis-network/core-utils/dist/eth/contracts/get-contract';
import { ERC20 } from '@jarvis-network/core-utils/dist/eth/contracts/typechain/ERC20';
import {
  NetworkName,
  Web3On,
} from '@jarvis-network/core-utils/dist/eth/web3-instance';
import { ERC20_Abi as abi } from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import { useMemo } from 'react';

export function useERC20Contract(
  address?: AddressOn<NetworkName>,
): ERC20 | null {
  const web3 = useBehaviorSubject(
    useCoreObservables().web3$,
  ) as Web3On<NetworkName> | null;

  return (
    useMemo(
      () =>
        web3 && address
          ? getContract(web3, abi as AbiFor<ERC20>, address)
          : null,
      [web3, address],
    )?.instance || null
  );
}
