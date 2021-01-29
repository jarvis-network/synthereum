import BN from 'bn.js';
import { throwError } from '@jarvis-network/web3-utils/base/asserts';
import { Amount } from '@jarvis-network/web3-utils/base/big-number';
import { t } from '@jarvis-network/web3-utils/base/meta';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import {
  getTokenBalance,
  weiToTokenAmount,
} from '@jarvis-network/web3-utils/eth/contracts/erc20';
import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import { Web3On } from '@jarvis-network/web3-utils/eth/web3-instance';
import {
  allSupportedSymbols,
  SyntheticSymbol,
} from '../config/data/all-synthetic-asset-symbols';
import { SupportedNetworkName } from '../config/supported-networks';
import {
  IDerivative_Abi,
  SynthereumPool_Abi,
  SynthereumTIC_Abi,
} from '../contracts/abi';
import { IDerivative } from '../contracts/typechain';
import { PoolContract, PoolVersion } from './types/pools';
import { SynthereumRealmWithWeb3 } from './types/realm';
import { NonPayableTransactionObject } from '@jarvis-network/web3-utils';

export interface PoolAddressWithDerivates<Version extends PoolVersion> {
  result: PoolContract<Version>;
  derivativeAddress: IDerivative;
}
export async function getPool<
  Net extends SupportedNetworkName,
  Version extends PoolVersion
>(
  web3: Web3On<Net>,
  version: Version,
  poolAddress: AddressOn<Net>,
): Promise<PoolAddressWithDerivates<Version>> {
  if (version === 'v1') {
    const result = getContract(web3, SynthereumTIC_Abi, poolAddress).instance;
    const derivatesAddress = (await result.methods
      .derivative()
      .call()) as AddressOn<Net>;
    return {
      result: result as PoolContract<Version>,
      derivativeAddress: getContract(web3, IDerivative_Abi, derivatesAddress)
        .instance,
    };
  } else if (version === 'v2') {
    const result = getContract(web3, SynthereumPool_Abi, poolAddress).instance;
    const derivatesAddresses = (await result.methods
      .getAllDerivatives()
      .call()) as AddressOn<Net>[];

    return {
      result: result as PoolContract<Version>,
      derivativeAddress: getContract(
        web3,
        IDerivative_Abi,
        derivatesAddresses[derivatesAddresses.length - 1],
      ).instance,
    };
  }
  throwError(`Unsupported pool version: '${version}'`);
}

export async function getPoolBalances<
  Net extends SupportedNetworkName,
  Version extends PoolVersion
>(realm: SynthereumRealmWithWeb3<Net>, version: Version = 'v1' as Version) {
  const balanceOf = (address: AddressOn<Net>) =>
    getTokenBalance(realm.collateralToken, address);
  const balances = await Promise.all(
    allSupportedSymbols.map(async symbol =>
      t(symbol, await balanceOf(realm.pools[version][symbol].address)),
    ),
  );

  return balances;
}

export async function depositInAllPools<
  Net extends SupportedNetworkName,
  Version extends PoolVersion
>(
  realm: SynthereumRealmWithWeb3<Net>,
  version: Version = 'v1' as Version,
  amount: Amount,
  gasPrice?: number,
) {
  const keys = Object.keys(realm.pools[version]);
  const perPool = amount.div(new BN(keys.length)) as Amount;
  const collateral = realm.collateralToken;
  const finalAmount = weiToTokenAmount({
    wei: perPool,
    decimals: collateral.decimals,
  }).toString(10);
  const web3 = realm.web3;
  let nonce = await web3.eth.getTransactionCount(web3.defaultAccount!);
  gasPrice = gasPrice ?? parseFloat(await web3.eth.getGasPrice());
  return Promise.all(
    keys.map(async symbol => {
      const address = realm.pools[version][symbol as SyntheticSymbol].address;
      await sendTx({
        web3: web3,
        gasPrice,
        tx: collateral.instance.methods.transfer(address, finalAmount),
        nonce: nonce++,
      });
    }),
  );
}

export async function sendTx<Result, Net extends SupportedNetworkName>({
  web3,
  gasPrice,
  nonce,
  tx,
  sender,
}: {
  web3: Web3On<Net>;
  gasPrice?: number;
  nonce?: number;
  tx: NonPayableTransactionObject<Result>;
  sender?: AddressOn<Net>;
}) {
  const from = sender ?? web3.defaultAccount ?? undefined;
  const gas = await tx.estimateGas({
    from,
    nonce,
  });
  const params = {
    from,
    gas,
    gasPrice,
    nonce,
  };
  await tx.send(params);
}
