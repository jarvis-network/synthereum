import React, { FC } from 'react';
import {
  styled,
  Button,
  useTheme,
  Flag,
  OnMobile,
  Icon,
  Tooltip,
} from '@jarvis-network/ui';
import { Global, css } from '@emotion/react';

import { useExchangeContext } from '@/utils/ExchangeContext';
import { useReduxSelector } from '@/state/useReduxSelector';

import { formatExchangeAmount } from '@jarvis-network/app-toolkit';

import { useAssets } from '@/utils/useAssets';
import { assetsPolygon } from '@/data/assets';
import { warningSeverity } from '@/utils/uniswap';

import { Loader } from '../Loader';

import { Fees } from './Fees';

interface SwapConfirmProps {
  onConfim: () => void;
}

const ConfirmationContainer = styled.div`
  height: calc(100% - ${props => props.theme.borderRadius.m});
  padding: 10px 15px 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    justify-content: flex-start;
    overflow-y: auto;
    padding-bottom: 60px;
  }
`;

const Content = styled.div`
  margin-left: -15px;
  margin-right: -15px;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding: 30px 0;
  }
`;

const Empty = styled.div``;

const ConfirmButton = styled(Button)`
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

const Line = styled.div`
  font-size: ${props => props.theme.font.sizes.l};
  border-bottom: 1px solid ${props => props.theme.border.primary};
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Key = styled.div`
  display: flex;
  align-items: center;
`;

const Value = styled(Key)`
  text-align: right;

  img {
    width: 22px;
    height: 22px;
    margin: 0 5px;
  }
`;

const Label = styled.div`
  font-weight: 500;
  font-size: ${props => props.theme.font.sizes.m};
`;

const TokenName = styled.span`
  min-width: 50px;
`;

const TokenValue = styled.span`
  color: ${props => props.theme.text.medium};
  padding-left: 4px;
`;

const CustomFees = styled(Fees)``;

const PriceImpact = styled(Value)<{ severity: 0 | 1 | 2 | 3 | 4 }>`
  color: ${props =>
    props.severity === 0 || props.severity === 1
      ? 'unset'
      : props.severity === 2
      ? '#ffd166'
      : '#ff3838'};
  font-weight: ${props =>
    props.severity > 2 ? '600' : props.severity > 0 ? '500' : 'normal'};
`;

type HasSymbol = { symbol: string };

export const SwapConfirm: FC<SwapConfirmProps> = ({ onConfim }) => {
  const theme = useTheme();

  const {
    payString,
    paySymbol,
    assetPay,
    receiveString,
    receiveSymbol,
    assetReceive,
    minimumReceiveValue,
    maximumSentValue,
    minimumSynthReceiveValue,
    maximumSynthSentValue,
    shouldSwapAndMint,
    path,
    priceImpact,
  } = useExchangeContext();

  const minReceiveValue = minimumSynthReceiveValue || minimumReceiveValue;
  const maxSentValue = maximumSynthSentValue || maximumSentValue;

  const assets = useAssets();

  const isSwapLoaderVisible = useReduxSelector(
    state => state.app.isSwapLoaderVisible,
  );

  return (
    <ConfirmationContainer>
      <Global
        styles={css`
          .path-item-tooltip-container {
            width: 32px;
            height: 22px;
            display: inline-block;

            > .tooltip {
              bottom: auto;
              top: -40px;
              width: auto;
              left: 50%;
              transform: translateX(-50%);
            }
          }
        `}
      />
      <Empty />
      <Content>
        <Line>
          <Label>Resume</Label>
        </Line>
        <Line>
          <Key>
            Exchange: <TokenValue>{formatExchangeAmount(payString)}</TokenValue>
          </Key>
          <Value>
            <Flag flag={assetPay!.icon} />
            <TokenName>{paySymbol}</TokenName>
          </Value>
        </Line>
        <Line>
          <Key>
            For: <TokenValue>{formatExchangeAmount(receiveString)}</TokenValue>
          </Key>
          <Value>
            <Flag flag={assetReceive!.icon} />
            <TokenName>{receiveSymbol}</TokenName>
          </Value>
        </Line>
        {minReceiveValue && (
          <Line>
            <Key>
              Minimum amount received:{' '}
              <TokenValue>
                {formatExchangeAmount(minReceiveValue.format())}
              </TokenValue>
            </Key>
            <Value>
              <Flag flag={assetReceive!.icon} />
              <TokenName>{receiveSymbol}</TokenName>
            </Value>
          </Line>
        )}
        {maxSentValue && (
          <Line>
            <Key>
              Maximum amount sent:{' '}
              <TokenValue>
                {formatExchangeAmount(maxSentValue.format())}
              </TokenValue>
            </Key>
            <Value>
              <Flag flag={assetPay!.icon} />
              <TokenName>{paySymbol}</TokenName>
            </Value>
          </Line>
        )}
        {path && (
          <Line>
            <Key>Route: </Key>
            <Value>
              {(shouldSwapAndMint
                ? (path as HasSymbol[]).concat(assetReceive as HasSymbol)
                : [assetPay as HasSymbol].concat(path as HasSymbol[])
              )
                .map(({ symbol }) =>
                  assets === assetsPolygon && symbol === 'WMATIC'
                    ? 'MATIC'
                    : symbol === 'WETH9' || symbol === 'WETH'
                    ? 'ETH'
                    : symbol,
                )
                .map((symbol, index, array) => (
                  <React.Fragment key={symbol}>
                    <Tooltip
                      wrapperClassName="path-item-tooltip-container"
                      tooltip={symbol}
                      position="top"
                    >
                      <Flag
                        flag={
                          assets.find(asset => symbol === asset.symbol)?.icon
                        }
                      />
                    </Tooltip>
                    {index !== array.length - 1 && (
                      <Icon icon="BsArrowRight" style={{ marginLeft: 3 }} />
                    )}
                  </React.Fragment>
                ))}
            </Value>
          </Line>
        )}
        {priceImpact && (
          <Line>
            <Key>Price Impact:</Key>
            <PriceImpact severity={warningSeverity(priceImpact)}>
              {priceImpact.toFixed(2)}%
            </PriceImpact>
          </Line>
        )}
        <OnMobile>
          <CustomFees />
        </OnMobile>
      </Content>
      <ConfirmButton
        type="success"
        onClick={onConfim}
        size="l"
        disabled={isSwapLoaderVisible}
      >
        {isSwapLoaderVisible ? (
          <Loader size="s" color={theme.text.secondary} />
        ) : (
          'Confirm'
        )}
      </ConfirmButton>
    </ConfirmationContainer>
  );
};
