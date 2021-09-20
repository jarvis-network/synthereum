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
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';

import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { formatUSDValue } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/common';
import { scaleTokenAmountToWei } from '@jarvis-network/core-utils/dist/eth/contracts/erc20';
import {
  StringAmount,
  wei,
} from '@jarvis-network/core-utils/dist/base/big-number';

import { useDispatch } from 'react-redux';

import TransactionHolder from './TransactionHolder';
import { WithdrawHolder } from './WithdrawHolder';
import { WithPlaceholder } from './holders/WithPlaceholder';

const title = 'Lorem ipsum repay';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);
interface RepayProps {
  assetKey: SupportedSelfMintingPairExact;
  tabHandler: (input: number) => void;
}
export const Repay: React.FC<RepayProps> = ({ assetKey, tabHandler }) => {
  const dispatch = useDispatch();

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
  const [showPreview, setShowPreview] = useState(false);

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
  const handleGoBack = () => {
    setShowPreview(false);
  };
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
      {showPreview === true ? (
        <TransactionHolder
          backHandler={handleGoBack}
          showPreview={showPreview}
          params={[
            {
              title: 'Borrow',
              asset: {
                name: selectedAsset.assetOut.name,
                icon: selectedAsset.assetOut.icon!,
              },
              value: FPN.toWei(
                syntheticValue !== '' ? syntheticValue : '0',
              ).format(2),
            },
            {
              title: 'Fee Percentage',
              asset: {
                name: selectedAsset.assetOut.name,
                icon: selectedAsset.assetOut.icon!,
              },
              value: `${FPN.fromWei(assetDetails!.feePercentage!)
                .mul(new FPN(100))
                .format(4)}%`,
            },
          ]}
          confirmHandler={() => {
            if (syntheticValue === '') {
              setSyntheticError('Synthetic is Required');
              return;
            }
            const params = {
              pair: assetKey,
              numTokens: FPN.toWei(syntheticValue).toString() as StringAmount,
              feePercentage: assetDetails!.feePercentage as StringAmount,
            };

            dispatch({ type: 'CALL_REPAY', payload: params });
          }}
        />
      ) : (
        <WithdrawHolder tabHandler={tabHandler} assetInfo={assetDetails!}>
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
            <SubmitButton onClick={() => setShowPreview(true)}>
              Repay
            </SubmitButton>
          </SubmitContainer>
        </WithdrawHolder>
      )}
    </WithPlaceholder>
  );
};
