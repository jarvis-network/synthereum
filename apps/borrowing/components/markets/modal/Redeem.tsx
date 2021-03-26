import React, { useState } from 'react';
import {
  Amount,
  AmountSmallPlaceholder,
  Asset,
  AssetSelect,
  Balance,
  ErrorMessage,
  ExchangeBox,
  Form,
  handleKeyPress,
  Link,
  Max,
  SubmitButton,
  SubmitContainer,
  Value,
} from '@/components/markets/modal/common';
import { WithPlaceholder } from '@/components/markets/modal/WithPlaceholder';

const title = 'Lorem ipsum redeem';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);

export const Redeem: React.FC = () => {
  const [value, setValue] = useState('');
  const [outputValue, setOutputValue] = useState('');
  const errorMessage = 'Errors';
  const balance = 123.23567;

  const onMaxSelect = () => setValue(String(balance));

  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="redeem">
      <Form>
        <ExchangeBox error={Boolean(errorMessage)}>
          <Balance>Balance: {balance}</Balance>
          <AssetSelect error={Boolean(errorMessage)}>
            <Amount
              value={value}
              inputMode="numeric"
              onKeyPress={e => handleKeyPress(e, { decimals: 5 })}
              onChange={e => {
                setValue(e.target.value);
              }}
              placeholder="0.0"
            />
            <Max onClick={onMaxSelect} />
            <Asset />
          </AssetSelect>
          <ErrorMessage>{errorMessage}</ErrorMessage>
        </ExchangeBox>
        <Value>Value: 0$</Value>

        <ExchangeBox error={Boolean(errorMessage)}>
          <AssetSelect error={Boolean(errorMessage)}>
            <AmountSmallPlaceholder
              value={outputValue}
              inputMode="numeric"
              onKeyPress={e => handleKeyPress(e, { decimals: 5 })}
              onChange={e => {
                setOutputValue(e.target.value);
              }}
              placeholder="Min: 200/Max: 600"
            />
            <Max onClick={onMaxSelect} />
            <Asset />
          </AssetSelect>
          <ErrorMessage>{errorMessage}</ErrorMessage>
        </ExchangeBox>
        <Value>Value: 0$</Value>
      </Form>
      <SubmitContainer>
        <SubmitButton>Redeem</SubmitButton>
      </SubmitContainer>
    </WithPlaceholder>
  );
};
