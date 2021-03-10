import { FC } from 'react';
import { styled, Button, useTheme, Flag } from '@jarvis-network/ui';

import { useExchangeValues } from '@/utils/useExchangeValues';
import { formatExchangeAmount } from '@/utils/format';
import { useReduxSelector } from '@/state/useReduxSelector';

import { Loader } from '../Loader';

import { OnMobile } from '../OnMobile';

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
    height: 22px;
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

export const SwapConfirm: FC<SwapConfirmProps> = ({ onConfim }) => {
  const theme = useTheme();

  const {
    payString,
    paySymbol,
    assetPay,
    receiveString,
    receiveSymbol,
    assetReceive,
  } = useExchangeValues();
  const { isSwapLoaderVisible } = useReduxSelector(state => state.app);

  return (
    <ConfirmationContainer>
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
            <Flag flag={assetPay!.icon!} />
            <TokenName>{paySymbol}</TokenName>
          </Value>
        </Line>
        <Line>
          <Key>
            For: <TokenValue>{formatExchangeAmount(receiveString)}</TokenValue>
          </Key>
          <Value>
            <Flag flag={assetReceive!.icon!} />
            <TokenName>{receiveSymbol}</TokenName>
          </Value>
        </Line>
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
