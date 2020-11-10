import React from 'react';
import { useDispatch } from 'react-redux';
import { Button, Icon, styled } from '@jarvis-network/ui';

import { State } from '@/state/initialState';
import {
  setBase,
  setPay,
  setPayAsset,
  setReceive,
  setReceiveAsset,
} from '@/state/slices/exchange';

import { ExchangeRate } from '@/components/exchange/ExchangeRate';
import { useRate } from '@/utils/useRate';

import { useReduxSelector } from '@/state/useReduxSelector';

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
  color: ${props => props.theme.text.secondary};
  font-size: 14px;
  width: 50%;
  outline: none !important;
  margin-top: 5px;
  font-family: Krub;
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

  svg {
    width: 24px;
    height: 24px;
  }
`;

const SwapButton = styled(Button)`
  font-weight: normal;
  font-family: 'Krub';
  width: 100%;
  text-align: center;
  margin-top: 25px;
`;

const ErrorMessage = styled.div`
  position: absolute;
  bottom: -14px;
  font-size: 8px;
  color: ${props => props.theme.text.invalid};
  left: 0;
`;

export const MainForm: React.FC<Props> = () => {
  const dispatch = useDispatch();
  const { base, pay, receive, payAsset, receiveAsset } = useReduxSelector(
    state => state.exchange,
  );
  const wallet = useReduxSelector(state => state.wallet[payAsset] || null);
  const rate = useRate(payAsset, receiveAsset);

  const balance = wallet ? wallet.amount : 0;

  const payValue =
    base === 'pay' ? pay : rate ? String(Number(receive) / rate.rate) : '';
  const receiveValue =
    base === 'receive' ? receive : rate ? String(Number(pay) * rate.rate) : '';

  const insufficientBalance = Number(payValue) > balance;

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

  return (
    <>
      <ExchangeBox error={insufficientBalance}>
        <Title>You pay</Title>
        <Max />
        <Amount
          value={payValue}
          onChange={e => {
            updateBase('pay');
            updatePay(e.target.value);
          }}
          onBlur={e => {
            if (!e.target.value) {
              updatePay('0');
            }
          }}
          disabled={!payAsset}
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
          onChange={e => {
            updateBase('receive');
            updateReceive(e.target.value);
          }}
          onBlur={e => {
            if (!e.target.value) {
              updateReceive('0');
            }
          }}
          disabled={!receiveAsset}
        />
        <Asset type="receive" />
      </ExchangeBox>
      <Footer>
        <ExchangeRate />
        <SwapButton disabled={swapDisabled} type="success">
          Swap
        </SwapButton>
      </Footer>
    </>
  );
};
