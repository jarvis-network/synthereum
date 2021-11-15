import { useReduxSelector } from '@/state/useReduxSelector';
import { useRate } from '@/utils/useRate';
import { calcExchange } from '@/utils/calcExchange';
import { useWeb3 } from '@jarvis-network/app-toolkit';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { synthereumConfig } from '@jarvis-network/synthereum-ts/dist/config';
import { useMemo } from 'react';

import { useAssets } from './useAssets';

export const useExchangeValues = () => {
  const { chainId: networkId } = useWeb3();

  const feePercentage = useMemo(
    () =>
      FPN.fromWei(
        networkId
          ? synthereumConfig[networkId as 42].fees.feePercentage
          : '2000000000000000',
      ),
    [networkId],
  );

  const assets = useAssets();
  const { base, pay, receive, assetPay, assetReceive } = useReduxSelector(
    state => ({
      ...state.exchange,
      assetPay: assets.find(a => a.symbol === state.exchange.payAsset),
      assetReceive: assets.find(a => a.symbol === state.exchange.receiveAsset),
    }),
  );

  const paySymbol = assetPay?.symbol || null;
  const receiveSymbol = assetReceive?.symbol || null;

  const rate = useRate(paySymbol, receiveSymbol);

  const {
    payValue,
    receiveValue,
    netCollateral,
    grossCollateral,
    transactionCollateral,
  } = calcExchange({
    assetPay,
    assetReceive,
    base,
    pay,
    receive,
    fee: feePercentage,
  });

  const fee =
    grossCollateral && netCollateral
      ? grossCollateral.sub(netCollateral)
      : null;

  const payString = payValue?.format() || '';
  const receiveString = receiveValue?.format() || '';

  return {
    fee,
    base,
    pay,
    receive,
    paySymbol,
    receiveSymbol,
    assetPay,
    assetReceive,
    rate,
    payValue,
    payString,
    receiveValue,
    receiveString,
    transactionCollateral,
    feePercentage,
  };
};
