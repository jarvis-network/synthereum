import React from 'react';
import { useDispatch } from 'react-redux';
import { Button, Icon, styled, useTheme } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { formatExchangeAmount, useWeb3 } from '@jarvis-network/app-toolkit';

import { State } from '@/state/initialState';
import {
  setBase,
  setPay,
  setPayAsset,
  setReceive,
  setReceiveAsset,
} from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import {
  setAuthModalVisible,
  setExchangeConfirmationVisible,
} from '@/state/slices/app';
import { Asset as AssetType } from '@/data/assets';

import { ExchangeRate } from '@/components/exchange/ExchangeRate';
import { useExchangeValues } from '@/utils/useExchangeValues';

import { TwoIconsButton } from '@/components/TwoIconsButton';

import { Loader } from '../Loader';

import { Asset } from './Asset';
import { Max } from './Max';

const Container = styled.div`
  height: 100%;
  padding-top: 30px;
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
      !props.error ? props.theme.border.secondary : props.theme.border.invalid};
  border-radius: ${props => props.theme.borderRadius.s};
`;

const Title = styled.div`
  font-size: ${props => props.theme.font.sizes.m};
  grid-area: title;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const Balance = styled.span`
  color: ${props => props.theme.text.secondary};
  font-size: ${props => props.theme.font.sizes.s};
`;

const Amount = styled.input`
  grid-area: amount;
  border: none;
  padding: none;
  background: none;
  color: ${props => props.theme.text.secondary};
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
    background: ${props => props.theme.background.secondary};
  }
`;

const ErrorMessage = styled.div`
  position: absolute;
  bottom: -14px;
  font-size: 8px;
  color: ${props => props.theme.text.invalid};
  left: 0;
`;

const allowedKeys = '0123456789.,'.split('');

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
    ((e.key === '.' || e.key === ',') && e.currentTarget.value.includes('.')) ||
    (decimals.length >= asset.decimals && !somethingSelected)
  ) {
    e.preventDefault();
  }
};

export const MainForm: React.FC = () => {
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

  const theme = useTheme();

  const isSwapLoaderVisible = useReduxSelector(
    state => state.app.isSwapLoaderVisible,
  );

  const { active } = useWeb3();

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

  const isSwapDisabled = () => {
    if (isSwapLoaderVisible) {
      return true;
    }

    if (!active) {
      return false;
    }

    return !Number(payString) || !Number(receiveString) || insufficientBalance;
  };

  const handleSwapButtonClick = () => {
    if (!active) {
      return dispatch(setAuthModalVisible(true));
    }

    return dispatch(setExchangeConfirmationVisible(true));
  };

  const getSwapButtonLabel = () => {
    if (isSwapLoaderVisible) {
      return <Loader size="s" color={theme.text.secondary} />;
    }

    return active ? 'Swap' : 'Sign in';
  };

  const getFormattedPay = () => {
    if (base === 'pay') {
      return pay;
    }

    return formatExchangeAmount(payString);
  };

  const getFormattedReceive = () => {
    if (base === 'receive') {
      return receive;
    }

    return formatExchangeAmount(receiveString);
  };

  const errorMessage = insufficientBalance ? 'Insufficient funds' : null;

  const amount = wallet && (
    <Balance>Balance: {wallet.amount.format(5)}</Balance>
  );

  return (
    <Container>
      <ExchangeBox error={Boolean(errorMessage)}>
        <Title>You swap {amount}</Title>
        <AssetSelect error={Boolean(errorMessage)}>
          <Amount
            value={getFormattedPay()}
            inputMode="decimal"
            onKeyPress={e => handleKeyPress(e, assetPay!)}
            onChange={e => {
              updateBase('pay');
              updatePay(e.target.value.replace(',', '.'));
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
      <TwoIconsButton onClick={flipValues}>
        <Icon icon="IoIosArrowRoundUp" />
        <Icon icon="IoIosArrowRoundDown" />
      </TwoIconsButton>
      <ExchangeBox error={false}>
        <Title>For</Title>
        <AssetSelect error={Boolean(errorMessage)}>
          <Amount
            value={getFormattedReceive()}
            inputMode="decimal"
            onKeyPress={e => handleKeyPress(e, assetReceive!)}
            onChange={e => {
              updateBase('receive');
              updateReceive(e.target.value.replace(',', '.'));
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
        <SwapButton
          disabled={isSwapDisabled()}
          type="success"
          onClick={handleSwapButtonClick}
          size="l"
        >
          {getSwapButtonLabel()}
        </SwapButton>
      </Footer>
    </Container>
  );
};
