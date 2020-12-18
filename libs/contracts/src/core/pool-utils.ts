import { formatAmount } from '@jarvis-network/web3-utils/base/big-number';
import { t } from '@jarvis-network/web3-utils/base/meta';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { getTokenBalance } from '@jarvis-network/web3-utils/eth/contracts/erc20';
import { allSymbols } from '../config/data/all-synthetic-asset-symbols';
import { SupportedNetworkName } from '../config/supported-networks';
import { SynthereumRealmWithWeb3 } from '../core/types';

export async function getPoolBalances<Net extends SupportedNetworkName>(
  realm: SynthereumRealmWithWeb3<Net>,
) {
  const balanceOf = (address: AddressOn<Net>) =>
    getTokenBalance(realm.collateralToken, address);
  const balances = await Promise.all(
    allSymbols.map(async symbol =>
      t(symbol, await balanceOf(realm.ticInstances[symbol].address)),
    ),
  );

  return balances;
}
