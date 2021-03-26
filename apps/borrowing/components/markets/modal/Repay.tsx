import React, { useState } from 'react';
import {
  Amount,
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

const title = 'Lorem ipsum repay';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);

export const Repay: React.FC = () => {
  const [value, setValue] = useState('');
  const errorMessage = '';
  const balance = 10;

  const onMaxSelect = () => setValue(String(balance));

  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="repay">
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
        <Value>Value: 12$</Value>
      </Form>
      <SubmitContainer>
        <SubmitButton>Repay</SubmitButton>
      </SubmitContainer>
    </WithPlaceholder>
  );
};
