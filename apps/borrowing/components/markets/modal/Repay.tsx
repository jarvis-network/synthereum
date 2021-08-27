import React, { useEffect, useState } from 'react';
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
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';

import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { formatUSDValue } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/common';
import { scaleTokenAmountToWei } from '@jarvis-network/core-utils/dist/eth/contracts/erc20';
import { wei } from '@jarvis-network/core-utils/dist/base/big-number';

const title = 'Lorem ipsum repay';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);
interface RepayProps {
  assetKey: SupportedSelfMintingPairExact;
}
export const Repay: React.FC<RepayProps> = ({ assetKey }) => {
  const [syntheticValue, setSyntheticValue] = useState('');
  const tokenBalances = useReduxSelector(state => state.wallet);
  const [syntheticError, setSyntheticError] = useState('');
  let assetOutValue = '0.00';

  const selectedAsset = selfMintingMarketAssets[assetKey];
  const balance = FPN.fromWei(
    tokenBalances[selectedAsset.assetOut.name]!.amount,
    // '1000000000000000000000'
  );
  const assetOutPrice = useReduxSelector(
    state => state.prices[selectedAsset.pair],
  );

  const onMaxSelect = (input: string) => setSyntheticValue(input);

  const insufficientFunds = balance.lt(
    new FPN(syntheticValue === '' ? '0' : syntheticValue),
  )!;

  const errorMessage = insufficientFunds ? 'Insufficient funds' : null;
  const assetDetails = useReduxSelector(state => state.markets.list[assetKey]);
  const capDepositRatio = scaleTokenAmountToWei({
    amount: wei(assetDetails!.capDepositRatio!),
    decimals: 6,
  });

  const minRemainingTokens = FPN.fromWei(assetDetails!.positionCollateral!).div(
    FPN.fromWei(capDepositRatio),
  );

  const maxBurn = FPN.fromWei(assetDetails!.positionTokens!).sub(
    minRemainingTokens,
  );

  useEffect(() => {
    if (syntheticValue !== '') {
      if (FPN.toWei(syntheticValue).gt(maxBurn)) {
        setSyntheticError(
          `Cannot Repay more than ${maxBurn.format(2)} ${
            selectedAsset.assetOut.name
          }`,
        );
      } else {
        setSyntheticError('');
      }
    }
  }, [syntheticValue]);

  if (assetOutPrice && syntheticValue !== '') {
    assetOutValue = formatUSDValue(assetOutPrice, syntheticValue);
  }
  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="repay">
      <Form>
        <Balance>
          Minted: {FPN.fromWei(assetDetails!.positionTokens!).format(4)}
        </Balance>
        <ExchangeBox error={Boolean(errorMessage)}>
          <Balance>Balance: {balance.format(4)}</Balance>

          <AssetSelect error={insufficientFunds || Boolean(syntheticError)}>
            <Amount
              value={syntheticValue}
              inputMode="numeric"
              onKeyPress={e => handleKeyPress(e, { decimals: 5 })}
              onChange={e => {
                setSyntheticValue(e.target.value);
              }}
              placeholder="0.0"
              required
              onFocus={e => {
                e.target.select();
              }}
            />
            <Max
              onClick={() => {
                onMaxSelect(maxBurn.format(4));
              }}
            />
            <Asset
              flag={selectedAsset.assetOut.icon}
              name={selectedAsset.assetOut.name}
            />
          </AssetSelect>
          <ErrorMessage>{syntheticError}</ErrorMessage>

          <ErrorMessage>{errorMessage}</ErrorMessage>
        </ExchangeBox>

        <Value>Value: ${assetOutValue}</Value>
      </Form>
      <SubmitContainer>
        <SubmitButton>Repay</SubmitButton>
      </SubmitContainer>
    </WithPlaceholder>
  );
};
