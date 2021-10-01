import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Button, Icon, Skeleton, styled, useTheme } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { formatExchangeAmount, useWeb3 } from '@jarvis-network/app-toolkit';
import { networkNameToId } from '@jarvis-network/core-utils/dist/eth/networks';

import { State } from '@/state/initialState';
import {
  resetAssetsIfUnsupported,
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

import {
  ExchangeRate,
  SkeletonExchangeRate,
} from '@/components/exchange/ExchangeRate';
import { useExchangeContext } from '@/utils/ExchangeContext';

import { TwoIconsButton } from '@/components/TwoIconsButton';

import { Loader } from '../Loader';

import { Asset, SkeletonAssetChangeButton } from './Asset';
import { Max } from './Max';

const SkeletonContainer = styled.div`
  padding-top: 30px;
`;

const Container = styled(SkeletonContainer)`
  height: 100%;
`;

const ExchangeBox = styled.div`
  margin: 5px 15px;
  display: grid;
  grid-template-columns: auto;
  grid-template-rows: auto;
  grid-template-areas:
    'title'
    'asset-select';
  position: relative;
`;

const AssetSelect = styled.div<{ error?: boolean; invisibleBorder?: boolean }>`
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
      props.invisibleBorder
        ? 'transparent'
        : props.error
        ? props.theme.border.invalid
        : props.theme.border.secondary};
  border-radius: ${props => props.theme.borderRadius.s};
`;

const Title = styled.div`
  font-size: ${props => props.theme.font.sizes.m};
  grid-area: title;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const SkeletonBalanceContainer = styled.span`
  font-size: ${props => props.theme.font.sizes.s};
`;
const Balance = styled(SkeletonBalanceContainer)`
  color: ${props => props.theme.text.secondary};
`;

const SkeletonAmount = styled.input`
  grid-area: amount;
  font-size: ${props => props.theme.font.sizes.l};
  height: 100%;
  margin-top: 5px;
  position: relative;

  > .MuiSkeleton-text {
    position: absolute;
    top: 10px;
  }
`;
const Amount = styled(SkeletonAmount)`
  border: none;
  padding: none;
  background: none;
  color: ${props => props.theme.text.secondary};
  width: 45%;
  outline: none !important;
  font-family: Krub;

  &::placeholder {
    color: currentColor;
  }
`;

const Footer = styled.div`
  margin: 10px 15px 15px;
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
    assetReceivePrice,
    payString,
    receiveString,
    shouldRedeemAndSwap,
    shouldSwapAndMint,
    routeNotFound,
    isLoading,
    path,
    maxMint,
    maximumSentValue,
    maximumSynthSentValue,
  } = useExchangeContext();

  const theme = useTheme();

  const { isSwapLoaderVisible, payAsset, receiveAsset } = useReduxSelector(
    state => ({
      isSwapLoaderVisible: state.app.isSwapLoaderVisible,
      payAsset: state.exchange.payAsset,
      receiveAsset: state.exchange.receiveAsset,
    }),
  );

  const { active, chainId: networkId } = useWeb3();

  useEffect(() => {
    if (networkId !== networkNameToId.polygon) {
      if (
        payAsset === 'jPHP' ||
        payAsset === 'jSGD' ||
        receiveAsset === 'jPHP' ||
        receiveAsset === 'jSGD'
      ) {
        setTimeout(() => {
          dispatch(resetAssetsIfUnsupported());
        }, 0);
      }
    }
  }, [networkId, payAsset, receiveAsset, dispatch]);

  const wallet = useReduxSelector(
    state => (paySymbol && state.wallet[paySymbol]) || null,
  );

  const balance = wallet ? wallet.amount : new FPN(0);

  const insufficientBalance = new FPN(payString).gt(balance);

  const maxMintState = maxMint && maxMint[assetReceive?.symbol as string];
  const insufficientLiquidityInSyntheticPool =
    assetReceive?.synthetic &&
    maxMintState &&
    maxMintState.price === assetReceivePrice &&
    new FPN(receiveString).gt(maxMintState.max);

  const insufficientBalanceDueToSlippage =
    (shouldSwapAndMint || shouldRedeemAndSwap) &&
    base === 'receive' &&
    (assetPay?.synthetic ? maximumSynthSentValue : maximumSentValue)?.gt(
      balance,
    );

  const updateBase = (baseValue: State['exchange']['base']) => {
    dispatch(setBase(baseValue));
  };

  const updatePay = (inputValue: State['exchange']['pay']) => {
    dispatch(setPay({ pay: inputValue }));
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

    return (
      !Number(payString) ||
      !Number(receiveString) ||
      insufficientBalance ||
      insufficientLiquidityInSyntheticPool ||
      insufficientBalanceDueToSlippage ||
      ((shouldSwapAndMint || shouldRedeemAndSwap) &&
        (routeNotFound || (isLoading && !path)))
    );
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

    return active
      ? (shouldSwapAndMint || shouldRedeemAndSwap) &&
        isLoading &&
        !path &&
        (base === 'pay' ? Number(pay) : Number(receive))
        ? 'Calculating...'
        : 'Swap'
      : 'Sign in';
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

  const errorMessage = insufficientBalance
    ? 'Insufficient funds'
    : insufficientBalanceDueToSlippage
    ? 'Insufficient balance due to slippage'
    : active &&
      assetPay &&
      assetReceive &&
      ((!assetPay.synthetic && !assetPay.collateral) ||
        (!assetReceive.synthetic && !assetReceive.collateral)) &&
      routeNotFound &&
      (base === 'pay' ? Number(pay) : Number(receive))
    ? 'Insufficient liquidity'
    : null;

  const amount = wallet && (
    <Balance>Balance: {wallet.amount.format(5)}</Balance>
  );

  const inputFieldsShouldHaveRedBorder = Boolean(
    errorMessage || insufficientLiquidityInSyntheticPool,
  );

  return (
    <Container>
      <ExchangeBox>
        <Title>You swap {amount}</Title>
        <AssetSelect error={inputFieldsShouldHaveRedBorder}>
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
      <ExchangeBox>
        <Title>For</Title>
        <AssetSelect error={inputFieldsShouldHaveRedBorder}>
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
        <ErrorMessage>
          {insufficientLiquidityInSyntheticPool
            ? 'Insufficient liquidity in pool'
            : ''}
        </ErrorMessage>
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

const FlipAssetsPlaceholder = styled.div`
  height: 27px;
`;

export function SkeletonMainForm(): JSX.Element {
  return (
    <SkeletonContainer>
      <SkeletonAmountWithTitle showBalance width={71} />
      <FlipAssetsPlaceholder />
      <SkeletonAmountWithTitle width={24} />
      <Footer>
        <SkeletonExchangeRate />

        <Skeleton
          variant="rectangular"
          height={60}
          sx={{ marginTop: '25px', borderRadius: '10px' }}
        />
      </Footer>
    </SkeletonContainer>
  );
}

function SkeletonAmountWithTitle({
  width,
  showBalance,
}: {
  width: number;
  // eslint-disable-next-line react/require-default-props
  showBalance?: boolean;
}) {
  return (
    <ExchangeBox>
      <Title>
        <Skeleton variant="text" width={width} />
        {showBalance && (
          <SkeletonBalanceContainer>
            <Skeleton variant="text" width={110} />
          </SkeletonBalanceContainer>
        )}
      </Title>
      <AssetSelect invisibleBorder>
        <SkeletonAmount as="div">
          <Skeleton variant="text" width={74} />
        </SkeletonAmount>
        <SkeletonAssetChangeButton />
      </AssetSelect>
    </ExchangeBox>
  );
}
