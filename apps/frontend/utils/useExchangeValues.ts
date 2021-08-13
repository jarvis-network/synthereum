import { useReduxSelector } from '@/state/useReduxSelector';
import { useRate } from '@/utils/useRate';
import { calcExchange } from '@/utils/calcExchange';
import {
  primaryCollateralSymbol,
  synthereumConfig,
} from '@jarvis-network/synthereum-contracts/dist/config';
import { useWeb3 } from '@jarvis-network/app-toolkit';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { useMemo } from 'react';

export const useExchangeValues = () => {
  const {
    base,
    pay,
    receive,
    assetPay,
    assetReceive,
    collateralAsset,
  } = useReduxSelector(state => ({
    ...state.exchange,
    assetPay: state.assets.list.find(a => a.symbol === state.exchange.payAsset),
    assetReceive: state.assets.list.find(
      a => a.symbol === state.exchange.receiveAsset,
    ),
    collateralAsset: state.assets.list.find(
      a => a.symbol === primaryCollateralSymbol,
    )!,
  }));

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

  const paySymbol = assetPay?.symbol || null;
  const receiveSymbol = assetReceive?.symbol || null;

  const rate = useRate(paySymbol, receiveSymbol);

  const { payValue, receiveValue, fee, transactionCollateral } =
    calcExchange({
      assetPay,
      assetReceive,
      base,
      pay,
      receive,
      feePercentage,
      collateralAsset,
    }) || {};

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
