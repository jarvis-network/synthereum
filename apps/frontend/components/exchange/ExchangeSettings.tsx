import React, { useState } from 'react';
import { Button, Checkbox, styled } from '@jarvis-network/ui';
import { useDispatch } from 'react-redux';
import { useTransactionSpeed } from '@jarvis-network/app-toolkit';
import { capitalize } from 'lodash';

import {
  setSlippage as setSlippageAction,
  setDisableMultihops as setDisableMultihopsAction,
  setDeadline as setDeadlineAction,
  setTransactionSpeed as setTransactionSpeedAction,
} from '@/state/slices/exchange';
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

const Value = styled(Key)`
  text-align: right;

  img {
    width: 22px;
    height: 22px;
    margin: 0 5px;
  }
`;

const InputContainer = styled.div<{ invalid?: boolean }>`
  border: 1px solid
    ${props =>
      props.invalid ? props.theme.border.invalid : props.theme.gray.gray200};
  border-radius: 6px;
  padding: 2px 6px;
  user-select: none;

  :focus-within {
    border-color: ${props =>
      props.invalid ? props.theme.border.invalid : props.theme.gray.gray400};
  }
`;

const Input = styled.input`
  width: 40px;
  border: 0 none;
  text-align: right;
  font-size: inherit;
  font-family: inherit;
  outline: none;
  background-color: transparent;
  color: inherit;
`;

const SlippageInput = styled(Input)`
  width: 80px;
  margin-right: 4px;
`;

const TransactionSpeedButtonsContainer = styled.div`
  flex-basis: 100%;
  display: flex;
  justify-content: center;
`;

const Spacer = styled.div`
  width: 8px;
`;

const ErrorMessage = styled.div`
  position: absolute;
  color: ${props => props.theme.text.invalid};
  bottom: 98px;
  width: calc(100% - 30px);
  text-align: center;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    bottom: 144px;
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
    background: ${props => props.theme.background.secondary};
  }
`;

const numberPattern = '^(0*[1-9]\\d*|\\d+\\.\\d{1,2})$';
const numberRegExp = new RegExp(numberPattern);
export function ExchangeSettings(): JSX.Element {
  const state = useReduxSelector(s => s.exchange);
  const defaultSlippage = state.slippage.toString();
  const [slippage, setSlippage] = useState(defaultSlippage);
  const defaultDeadline = state.deadline.toString();
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [disableMultihops, setDisableMultihops] = useState(
    state.disableMultihops,
  );
  const [transactionSpeed, setTransactionSpeed] = useState(
    state.transactionSpeed,
  );
  const [isEdited, setIsEdited] = useState(false);
  const dispatch = useDispatch();
  const transactionSpeedContext = useTransactionSpeed();

  const isSlippageValid = numberRegExp.test(slippage);
  const isDeadlineValidNumber = numberRegExp.test(deadline);
  const isDeadlineAtLeastFiveMinutes = Number(deadline) >= 5;
  const isDeadlineValid = isDeadlineValidNumber && isDeadlineAtLeastFiveMinutes;

  return (
    <Container>
      <Empty />
      <Content>
        <Line>
          <Key>Slippage:</Key>
          <Value>
            <InputContainer
              onClick={selectChildInput}
              invalid={!isSlippageValid}
            >
              <SlippageInput
                type="text"
                name="slippage"
                value={slippage}
                onChange={event => {
                  setSlippage(event.target.value);
                  setIsEdited(true);
                }}
                pattern={numberPattern}
                onClick={selectOnClick}
              />
              %
            </InputContainer>
          </Value>
        </Line>
        <Line>
          <Key>Transaction deadline:</Key>
          <Value>
            <InputContainer
              onClick={selectChildInput}
              invalid={!isDeadlineValid}
            >
              <Input
                type="text"
                name="deadline"
                value={deadline}
                onChange={event => {
                  setDeadline(event.target.value);
                  setIsEdited(true);
                }}
                pattern={numberPattern}
                onClick={selectOnClick}
              />
            </InputContainer>
            &nbsp;minutes
          </Value>
        </Line>
        <Line>
          <Key>
            <Checkbox
              name="disableMultihops"
              checked={disableMultihops}
              onChange={event => {
                setDisableMultihops(event.target.checked);
                setIsEdited(true);
              }}
            />
            Disable multihops
          </Key>
        </Line>
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
      <ErrorMessage>
        {!isSlippageValid
          ? Number(slippage) === 0
            ? 'Slippage must be larger than 0'
            : 'Slippage must be a valid number'
          : !isDeadlineValidNumber
          ? 'Deadline must be a valid number'
          : !isDeadlineAtLeastFiveMinutes
          ? 'Deadline must be at least 5 minutes'
          : ''}
      </ErrorMessage>
      <SwapButton
        disabled={!(isEdited && isSlippageValid && isDeadlineValid)}
        type="success"
        onClick={() => {
          dispatch(setSlippageAction(Number(slippage)));
          dispatch(setDisableMultihopsAction(disableMultihops));
          dispatch(setDeadlineAction(Number(deadline)));
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

function selectChildInput(event: React.MouseEvent<HTMLElement>) {
  (event.target as HTMLElement).querySelector('input')?.select();
}

function selectOnClick(event: React.MouseEvent<HTMLInputElement>) {
  (event.target as HTMLInputElement).select();
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
  transactionSpeedContext: ReturnType<typeof useTransactionSpeed>;
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
      {transactionSpeedContext && (
        <Gwei>
          {transactionSpeedContext &&
            ` (${transactionSpeedContext[speed]} Gwei)`}
        </Gwei>
      )}
    </TransactionSpeedButton>
  );
}
