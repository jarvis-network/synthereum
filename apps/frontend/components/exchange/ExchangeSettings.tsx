import React, { useState } from 'react';
import { Button, styled } from '@jarvis-network/ui';
import { useDispatch } from 'react-redux';
import { useTransactionSpeedContext } from '@jarvis-network/app-toolkit';
import { capitalize } from 'lodash';

import { setTransactionSpeed as setTransactionSpeedAction } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { TransactionSpeed } from '@/state/initialState';
import { setExchangeSettingsVisible } from '@/state/slices/app';

const Container = styled.form`
  height: calc(100% - 15px);
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

const Line = styled.div<{ flexWrap?: boolean }>`
  font-size: ${props => props.theme.font.sizes.l};
  border-bottom: 1px solid ${props => props.theme.border.primary};
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  ${props => (props.flexWrap ? 'flex-wrap: wrap;' : '')}
`;

const Key = styled.div`
  display: flex;
  align-items: center;
`;

const TransactionSpeedButtonsContainer = styled.div`
  flex-basis: 100%;
  display: flex;
  justify-content: center;
`;

const Spacer = styled.div`
  width: 8px;
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

export function ExchangeSettings(): JSX.Element {
  const state = useReduxSelector(s => s.exchange);
  const [transactionSpeed, setTransactionSpeed] = useState(
    state.transactionSpeed,
  );
  const [isEdited, setIsEdited] = useState(false);
  const dispatch = useDispatch();
  const transactionSpeedContext = useTransactionSpeedContext();

  return (
    <Container>
      <Empty />
      <Content>
        <Line flexWrap>
          <Key>Transaction speed:</Key>
          <TransactionSpeedButtonsContainer>
            <GasButton
              selected={transactionSpeed}
              speed={TransactionSpeed.standard}
              setTransactionSpeed={setTransactionSpeed}
              setIsEdited={setIsEdited}
              transactionSpeedContext={transactionSpeedContext}
            />
            <Spacer />
            <GasButton
              selected={transactionSpeed}
              speed={TransactionSpeed.fast}
              setTransactionSpeed={setTransactionSpeed}
              setIsEdited={setIsEdited}
              transactionSpeedContext={transactionSpeedContext}
            />
            <Spacer />
            <GasButton
              selected={transactionSpeed}
              speed={TransactionSpeed.rapid}
              setTransactionSpeed={setTransactionSpeed}
              setIsEdited={setIsEdited}
              transactionSpeedContext={transactionSpeedContext}
            />
          </TransactionSpeedButtonsContainer>
        </Line>
      </Content>
      <Empty />
      <SwapButton
        disabled={!isEdited}
        type="success"
        onClick={() => {
          dispatch(setTransactionSpeedAction(transactionSpeed));
          dispatch(setExchangeSettingsVisible(false));
        }}
        size="l"
      >
        Save
      </SwapButton>
    </Container>
  );
}

const TransactionSpeedButton = styled.div<{ selected: boolean }>`
  border: 1px solid
    ${props =>
      props.selected ? props.theme.common.success : props.theme.gray.gray200};
  font-size: 14px;
  text-align: center;
  margin: 8px 0 0;
  flex-grow: 1;
  width: 90px;
  padding: 8px 0;
  cursor: pointer;
  border-radius: 6px;
`;

const Gwei = styled.div`
  font-size: 12px;
  margin-top: 4px;
  color: ${props => props.theme.text.secondary};
`;

function GasButton({
  selected,
  speed,
  setTransactionSpeed,
  setIsEdited,
  transactionSpeedContext,
}: {
  selected: TransactionSpeed;
  speed: TransactionSpeed;
  setTransactionSpeed(speed: TransactionSpeed): void;
  setIsEdited(isEdited: boolean): void;
  transactionSpeedContext: ReturnType<typeof useTransactionSpeedContext>;
}) {
  return (
    <TransactionSpeedButton
      selected={selected === speed}
      onClick={() => {
        setTransactionSpeed(speed);
        if (selected !== speed) setIsEdited(true);
      }}
    >
      <div>{capitalize(speed)}</div>
      {transactionSpeedContext.current && (
        <Gwei>
          {transactionSpeedContext.current &&
            ` (${transactionSpeedContext.current[speed]} Gwei)`}
        </Gwei>
      )}
    </TransactionSpeedButton>
  );
}
