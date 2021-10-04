import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { styled, themeValue } from '@jarvis-network/ui';
import { useTransactionSpeed } from '@jarvis-network/app-toolkit';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';

import { setBase, setPay } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { useExchangeContext } from '@/utils/ExchangeContext';

import { useSwap } from './useSwap';
import { useMemo } from 'use-memo-one';

const Container = styled.button`
  color: ${themeValue(
    {
      light: theme => theme.text.secondary,
    },
    theme => theme.text.medium,
  )};
  border: 1px solid ${props => props.theme.border.secondary};
  padding: 5px 7px;
  border-radius: ${props => props.theme.borderRadius.s};
  background: transparent;
  outline: none !important;
  text-transform: uppercase;
  cursor: pointer;
  margin-top: 8px;
  font-size: ${props => props.theme.font.sizes.m};
  font-family: Krub;
  font-weight: 300;
`;

const oneGwei = 1000 * 1000 * 1000;
const twenty = new FPN(20);
const one = new FPN(1);
export const Max: React.FC = () => {
  const dispatch = useDispatch();
  const { assetPay, path: p } = useExchangeContext();
  const swap = useSwap();
  const transactionSpeedContext = useTransactionSpeed();
  const [estimation, setEstimation] = useState(0);

  const s = useReduxSelector(state => {
    if (!assetPay) {
      return null;
    }
    const wallet = state.wallet[assetPay.symbol];
    if (!wallet) {
      return null;
    }

    return {
      max: wallet.amount,
      transactionSpeed: state.exchange.transactionSpeed,
    };
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => s && s.max, [s && s.max && s.max.format(18)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const path = useMemo(() => p, [p && p.map(token => token.address).join()]);

  useEffect(() => {
    if (!assetPay?.native || !swap || !path || !m) return;

    let requested = false;
    let canceled = false;
    let divisor = one;
    let timeoutId = 0;

    function estimate() {
      if (requested) return;

      requested = true;
      const mm = m && (divisor.gt(one) ? m.div(divisor) : m);
      if (mm?.eq(FPN.ZERO)) return;
      swap!(mm)
        .estimatePromise.then((value: number) => {
          if (!canceled) {
            setEstimation(value);
            requested = false;
          }
        })
        .catch(() => {
          if (!canceled) {
            divisor = divisor.mul(twenty);
            requested = false;
            clearTimeout(timeoutId);
            timeoutId = (setTimeout(estimate, 1000) as unknown) as number;
          }
        });
    }

    const intervalId = setInterval(estimate, 30 * 1000);

    estimate();

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetPay, setEstimation, path, m]);

  if (!s) return null;

  const { max, transactionSpeed } = s;

  const handleClick = () => {
    const reducedMax = assetPay!.native
      ? estimation
        ? max.sub(
            FPN.fromWei(estimation).mul(
              new FPN(
                assertNotNull(transactionSpeedContext)[transactionSpeed] *
                  oneGwei,
              ),
            ),
          )
        : max.sub(new FPN('0.01'))
      : max;
    const formattedMax = (reducedMax.lt(new FPN(0))
      ? max.add(FPN.fromWei(1))
      : reducedMax
    )
      .format(18)
      .replace(/(\.0{18}|0*)$/, '');
    dispatch(
      setPay({
        pay: formattedMax,
        gasLimit: assetPay?.native ? estimation : 0,
      }),
    );
    dispatch(setBase('pay'));
  };
  return <Container onClick={handleClick}>Max</Container>;
};
