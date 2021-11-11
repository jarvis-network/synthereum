import { useWeb3React } from '@web3-react/core';
import { Web3ReactContextInterface } from '@web3-react/core/dist/types';
import Web3 from 'web3';

export function useWeb3(): Web3ReactContextInterface<Web3> {
  return useWeb3React<Web3>();
}
