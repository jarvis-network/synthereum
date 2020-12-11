import React from 'react';
import { useDispatch } from 'react-redux';
import { Button, Icon, styled, themeValue } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { State } from '@/state/initialState';
import {
  setBase,
  setPay,
  setPayAsset,
  setReceive,
  setReceiveAsset,
} from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { Asset as AssetType } from '@/data/assets.ts';

import { ExchangeRate } from '@/components/exchange/ExchangeRate';
import { Fees } from '@/components/exchange/Fees';
import { useRate } from '@/utils/useRate';

import { Asset } from './Asset';
import { Max } from './Max';

interface Props {}

const ExchangeBox = styled.div<{ error: boolean }>`
  margin: 15px 30px;
  border: 1px solid
    ${props =>
      !props.error ? props.theme.border.secondary : props.theme.border.invalid};
  padding: 5px 10px 12px 15px;
  display: grid;
  grid-template-columns: auto auto;
  grid-template-rows: auto auto;
  grid-template-areas:
    'title max'
    'amount asset';
  position: relative;

  &:nth-child(2) {
    margin-top: 20px;
  }
`;

const Title = styled.div`
  font-size: ${props => props.theme.font.sizes.s};
  grid-area: title;
`;

const Amount = styled.input`
  grid-area: amount;
  border: none;
  padding: none;
  background: none;
  color: ${themeValue(
    {
      light: theme => theme.text.secondary,
    },
    theme => theme.text.medium,
  )};
  font-size: 14px;
  width: 50%;
  outline: none !important;
  margin-top: 5px;
  font-family: Krub;

  &::placeholder {
    color: currentColor;
  }
`;

const Footer = styled.div`
  margin: 0 30px;
`;

const IconButton = styled.button`
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  margin-left: 50px;
  outline: none !important;
  align-self: flex-start;

  svg {
    width: 24px;
    height: 24px;
    fill: ${props => props.theme.text.primary};
  }
`;

const SwapButton = styled(Button)`
  font-weight: normal;
  font-family: 'Krub';
  width: 100%;
  text-align: center;
  margin-top: 25px;
  box-shadow: ${props => props.theme.shadow.small};

  &:disabled {
    box-shadow: none;
  }
`;

const ErrorMessage = styled.div`
  position: absolute;
  bottom: -14px;
  font-size: 8px;
  color: ${props => props.theme.text.invalid};
  left: 0;
`;

const allowedKeys = [...'0123456789.'.split('')];

const handleKeyPress = (
  e: React.KeyboardEvent<HTMLInputElement>,
  asset: AssetType,
) => {
  if (e.currentTarget.selectionStart !== e.currentTarget.selectionEnd) {
    return;
  }

  const parts = e.currentTarget.value.split('.');
  const decimals = parts[1] || '';

  if (
    !allowedKeys.includes(e.key) ||
    (e.key === '.' && e.currentTarget.value.includes('.')) ||
    decimals.length >= asset.decimals
  ) {
    e.preventDefault();
  }
};

export const MainForm: React.FC<Props> = () => {
  const dispatch = useDispatch();
  const { base, pay, receive, payAsset, receiveAsset } = useReduxSelector(
    state => state.exchange,
  );
  const { assetPay, assetReceive } = useReduxSelector(state => {
    return {
      assetPay: state.assets.list.find(a => a.symbol === payAsset),
      assetReceive: state.assets.list.find(a => a.symbol === receiveAsset),
    };
  });
  const wallet = useReduxSelector(state => state.wallet[payAsset] || null);
  const rate = useRate(payAsset, receiveAsset);

  const balance = wallet ? wallet.amount : new FPN(0);

  const payValue =
    base === 'pay' ? pay : rate ? new FPN(receive).div(rate.rate).format() : '';

  const receiveValue =
    base === 'receive'
      ? receive
      : rate
      ? new FPN(pay).mul(rate.rate).format()
      : '';

  const insufficientBalance = new FPN(pay).gt(balance);

  const updateBase = (baseValue: State['exchange']['base']) => {
    dispatch(setBase(baseValue));
  };

  const updatePay = (inputValue: State['exchange']['pay']) => {
    dispatch(setPay(inputValue));
  };

  const updateReceive = (inputValue: State['exchange']['receive']) => {
    dispatch(setReceive(inputValue));
  };

  const flipValues = () => {
    dispatch(setPayAsset(receiveAsset));
    dispatch(setReceiveAsset(payAsset));

    if (base === 'pay') {
      updateBase('receive');
      updateReceive(payValue);
      return;
    }
    updateBase('pay');
    updatePay(receiveValue);
  };

  const swapDisabled =
    !Number(payValue) || !Number(receiveValue) || insufficientBalance;

  const fees = (!swapDisabled || true) && <Fees />;

  return (
    <>
      <ExchangeBox error={insufficientBalance}>
        <Title>You pay</Title>
        <Max />
        <Amount
          value={payValue}
          onKeyPress={e => handleKeyPress(e, assetPay!)}
          onChange={e => {
            updateBase('pay');
            updatePay(e.target.value);
          }}
          onFocus={e => {
            if (!Number(payValue) && payValue.length) {
              updatePay('');
            }
          }}
          disabled={!assetPay}
          placeholder="0"
        />
        <Asset type="pay" />
        <ErrorMessage>
          {insufficientBalance && 'Insufficient funds'}
        </ErrorMessage>
      </ExchangeBox>
      <IconButton onClick={flipValues}>
        <Icon icon="IoIosArrowRoundDown" />
      </IconButton>
      <ExchangeBox error={false}>
        <Title>You receive</Title>
        <Amount
          value={receiveValue}
          onKeyPress={e => handleKeyPress(e, assetReceive!)}
          onChange={e => {
            updateBase('receive');
            updateReceive(e.target.value);
          }}
          onFocus={e => {
            if (!Number(receiveValue) && receiveValue.length) {
              updateReceive('');
            }
          }}
          disabled={!assetReceive}
          placeholder="0"
        />
        <Asset type="receive" />
      </ExchangeBox>
      <Footer>
        <ExchangeRate />
        <SwapButton disabled={swapDisabled} type="success">
          Swap
        </SwapButton>
      </Footer>
      {fees}
    </>
  );
};
