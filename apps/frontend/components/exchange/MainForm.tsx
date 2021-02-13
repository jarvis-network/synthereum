import React from 'react';
import { useDispatch } from 'react-redux';
import { Button, Icon, styled, themeValue } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import {
  DEFAULT_PAY_ASSET,
  DEFAULT_RECEIVE_ASSET,
  State,
} from '@/state/initialState';
import {
  setBase,
  setPay,
  setPayAsset,
  setReceive,
  setReceiveAsset,
} from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { setFullScreenLoaderVisible } from '@/state/slices/app';
import { Asset as AssetType } from '@/data/assets.ts';

import { ExchangeRate } from '@/components/exchange/ExchangeRate';
import { useExchangeValues } from '@/utils/useExchangeValues';

import { useSwap } from '@/components/exchange/useSwap';

import { Asset } from './Asset';
import { Max } from './Max';

interface Props {}

const Container = styled.div`
  height: 100%;
  padding-top: 8px;
`;

const ExchangeBox = styled.div<{ error: boolean }>`
  margin: 5px 15px;
  display: grid;
  grid-template-columns: auto;
  grid-template-rows: auto;
  grid-template-areas:
    'title'
    'asset-select';
  position: relative;
`;

const AssetSelect = styled.div<{ error: boolean }>`
  grid-area: asset-select;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px 10px 10px;
  height: ${props => props.theme.sizes.row};
  box-sizing: border-box;
  margin-top: 3px;
  border: 1px solid
    ${props =>
    !props.error ? props.theme.border.primary : props.theme.border.invalid};
  border-radius: ${props => props.theme.borderRadius.s};
`;

const Title = styled.div`
  font-size: ${props => props.theme.font.sizes.m};
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
  font-size: ${props => props.theme.font.sizes.l};
  width: 45%;
  outline: none !important;
  margin-top: 5px;
  height: 100%;
  font-family: Krub;

  &::placeholder {
    color: currentColor;
  }
`;

const Footer = styled.div`
  margin: 5px 15px 15px;
`;

const IconButton = styled.button`
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  margin: 6px auto -7px;
  outline: none !important;
  width: 100%;

  svg {
    width: 24px;
    height: 24px;
    margin-left: -8px;
    margin-right: -8px;
    fill: ${props => props.theme.text.secondary};
  }
`;

const SwapButton = styled(Button)`
  font-size: 20px;
  font-weight: normal;
  font-family: 'Krub';
  width: 100%;
  text-align: center;
  margin-top: 25px;
  box-shadow: ${props => props.theme.shadow.small};
  height: ${props => props.theme.sizes.row};

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

const allowedKeys = '0123456789.'.split('');

const MAX_MINT_VALUE = new FPN(500);

const handleKeyPress = (
  e: React.KeyboardEvent<HTMLInputElement>,
  asset: AssetType,
) => {
  const somethingSelected =
    e.currentTarget.selectionStart !== e.currentTarget.selectionEnd;
  const parts = e.currentTarget.value.split('.');
  const decimals = parts[1] || '';

  if (
    !allowedKeys.includes(e.key) ||
    (e.key === '.' && e.currentTarget.value.includes('.')) ||
    (decimals.length >= asset.decimals && !somethingSelected)
  ) {
    e.preventDefault();
  }
};

export const MainForm: React.FC<Props> = () => {
  const dispatch = useDispatch();

  const {
    base,
    pay,
    receive,
    paySymbol,
    receiveSymbol,
    assetPay,
    assetReceive,
    payString,
    receiveString,
  } = useExchangeValues();

  const swap = useSwap();

  const auth = useReduxSelector(state => state.auth);

  const wallet = useReduxSelector(
    state => (paySymbol && state.wallet[paySymbol]) || null,
  );

  const balance = wallet ? wallet.amount : new FPN(0);

  const insufficientBalance = new FPN(payString).gt(balance);

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
    dispatch(setPayAsset(receiveSymbol));
    dispatch(setReceiveAsset(paySymbol));

    if (base === 'pay') {
      updateBase('receive');
      updateReceive(payString);
      return;
    }
    updateBase('pay');
    updatePay(receiveString);
  };

  const reset = () => {
    dispatch(setPayAsset(DEFAULT_PAY_ASSET));
    dispatch(setReceiveAsset(DEFAULT_RECEIVE_ASSET));
    dispatch(setBase('pay'));
    dispatch(setPay('0'));
    dispatch(setReceive('0'));
  };

  const mintingOverLimit =
    paySymbol === 'USDC' && new FPN(payString).gt(MAX_MINT_VALUE);

  const swapDisabled =
    !auth ||
    !Number(payString) ||
    !Number(receiveString) ||
    insufficientBalance ||
    mintingOverLimit;

  const doSwap = async () => {
    dispatch(setFullScreenLoaderVisible(true));
    try {
      await swap?.();
      reset();
    } catch (e) {
      console.error(e); // @TODO needs proper error handler
    }
    dispatch(setFullScreenLoaderVisible(false));
  };

  const getFormattedValue = (value: string) => {
    const [, decimals] = value.split('.');

    if (decimals && decimals.length > 5) {
      return Number(value).toFixed(5);
    }

    return value;
  };

  const getFormattedPay = () => {
    if (base === 'pay') {
      return pay;
    }

    return getFormattedValue(payString);
  };

  const getFormattedReceive = () => {
    if (base === 'receive') {
      return receive;
    }

    return getFormattedValue(receiveString);
  };

  const errorMessage = insufficientBalance
    ? 'Insufficient funds'
    : mintingOverLimit
    ? 'Limit Reached'
    : null;

  return (
    <Container>
      <ExchangeBox error={Boolean(errorMessage)}>
        <Title>You swap</Title>
        <AssetSelect error={Boolean(errorMessage)}>
          <Amount
            value={getFormattedPay()}
            onKeyPress={e => handleKeyPress(e, assetPay!)}
            onChange={e => {
              updateBase('pay');
              updatePay(e.target.value);
            }}
            onFocus={e => {
              e.target.select();

              if (!Number(payString) && payString.length) {
                updatePay('');
              }
            }}
            disabled={!assetPay}
            placeholder="0"
          />
          <Max />
          <Asset type="pay" />
        </AssetSelect>
        <ErrorMessage>{errorMessage}</ErrorMessage>
      </ExchangeBox>
      <IconButton onClick={flipValues}>
        <Icon icon="IoIosArrowRoundUp" />
        <Icon icon="IoIosArrowRoundDown" />
      </IconButton>
      <ExchangeBox error={false}>
        <Title>For</Title>
        <AssetSelect error={Boolean(errorMessage)}>
          <Amount
            value={getFormattedReceive()}
            onKeyPress={e => handleKeyPress(e, assetReceive!)}
            onChange={e => {
              updateBase('receive');
              updateReceive(e.target.value);
            }}
            onFocus={e => {
              e.target.select();

              if (!Number(receiveString) && receiveString.length) {
                updateReceive('');
              }
            }}
            disabled={!assetReceive}
            placeholder="0"
          />
          <Asset type="receive" />
        </AssetSelect>
      </ExchangeBox>
      <Footer>
        <ExchangeRate />
        <SwapButton disabled={swapDisabled} type="success" onClick={doSwap} size="l">
          {auth ? 'Swap' : 'Sign in'}
        </SwapButton>
      </Footer>
    </Container>
  );
};
