import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import {
  useBehaviorSubject,
  useCoreObservables,
  useWeb3,
} from '@jarvis-network/app-toolkit';
import { useV2TradeExactIn } from '@/utils/uniswap';
import { addresses } from '@/data/addresses';
import { isSupportedNetwork } from '@jarvis-network/synthereum-contracts/dist/config';
import { useMemo } from 'use-memo-one';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { ReactNode } from 'react';
import { Asset } from '@/data/assets';

export function DEXValue({
  asset,
  amount,
  wrapper,
}: {
  asset: Asset;
  amount: FPN;
  wrapper: (children: ReactNode) => JSX.Element;
}): JSX.Element | null {
  const { chainId: networkId } = useWeb3();
  const realmAgent = useBehaviorSubject(useCoreObservables().realmAgent$);

  const collateralToken = useMemo(() => {
    if (!networkId || !realmAgent || !realmAgent.activePools.jEUR) return;

    const collateral = realmAgent.activePools.jEUR.collateralToken;
    return new Token(
      networkId,
      collateral.address,
      collateral.decimals,
      collateral.symbol,
    );
  }, [realmAgent, networkId]);

  const currencyAmount = useMemo(() => {
    if (!isSupportedNetwork(networkId)) return;

    const token = new Token(
      networkId,
      asset.native
        ? addresses[networkId as 1][`W${asset.symbol}` as 'WBTC']
        : addresses[networkId as 1][asset.symbol as 'WBTC'],
      asset.decimals,
      asset.symbol,
      asset.name,
    );
    return CurrencyAmount.fromRawAmount(
      token,
      amount.format(token.decimals).replace('.', ''),
    );
  }, [networkId, asset, amount]);

  const { trade } = useV2TradeExactIn(currencyAmount, collateralToken);
  return trade && wrapper(new FPN(trade.outputAmount.toExact()).format(2));
}
