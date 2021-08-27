import { ERC20_Abi } from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import { parseInteger } from '@jarvis-network/core-utils/dist/base/asserts';

import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import { getContract } from '@jarvis-network/core-utils/dist/eth/contracts/get-contract';
import type { TokenInstance } from '@jarvis-network/core-utils/dist/eth/contracts/types';
import type {
  NetworkName,
  Web3On,
} from '@jarvis-network/core-utils/dist/eth/web3-instance';

export async function getTokenInfo<
  TokenSymbol extends string,
  Net extends NetworkName
>(
  web3: Web3On<Net>,
  address: AddressOn<Net>,
): Promise<TokenInstance<Net, TokenSymbol>> {
  const { instance, connect } = getContract(web3, ERC20_Abi, address);
  const symbol = (await instance.methods.symbol().call()) as TokenSymbol;
  const decimals = parseInteger(await instance.methods.decimals().call());
  return {
    address,
    connect,
    instance,
    symbol,
    decimals,
  };
}
