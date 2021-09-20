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
import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';
import { formatUSDValue } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/common';
import {
  StringAmount,
  wei,
} from '@jarvis-network/core-utils/dist/base/big-number';
import { scaleTokenAmountToWei } from '@jarvis-network/core-utils/dist/eth/contracts/erc20';

import { useDispatch } from 'react-redux';

import TransactionHolder from './TransactionHolder';
import { WithdrawHolder } from './WithdrawHolder';
import { WithPlaceholder } from './holders/WithPlaceholder';

const title = 'Lorem ipsum deposit';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);
interface DepositProps {
  assetKey: SupportedSelfMintingPairExact;
  tabHandler: (input: number) => void;
}
export const Deposit: React.FC<DepositProps> = ({ assetKey, tabHandler }) => {
  const dispatch = useDispatch();
  const [showPreview, setShowPreview] = useState(false);
  const [collateralValue, setCollateralValue] = useState('');
  const [collateralError, setCollateralError] = useState('');
  let assetInValue = '0.00';
  const assetDetails = useReduxSelector(state => state.markets.list[assetKey])!;

  const selectedAsset = selfMintingMarketAssets[assetKey];
  const balance = FPN.fromWei(
    assetDetails!.positionTokens!,
    // '1000000000000000000000'
  );
  const assetInPrice = useReduxSelector(
    state => state.prices[selectedAsset.assetIn.name],
  );
  const onMaxSelect = (input: string) => setCollateralValue(input);

  const insufficientFunds = balance.lt(
    new FPN(collateralValue === '' ? '0' : collateralValue),
  )!;
  if (assetInPrice && collateralValue !== '') {
    assetInValue = formatUSDValue(assetInPrice, collateralValue);
  }

  let max!: FPN;

  if (assetDetails!.positionCollateral!.toString() !== '0') {
    const ucr = FPN.fromWei(assetDetails!.positionCollateral!).div(
      FPN.fromWei(assetDetails!.positionTokens!),
    );
    const capDepositRatio = scaleTokenAmountToWei({
      amount: wei(assetDetails!.capDepositRatio!),
      decimals: 6,
    });
    max = FPN.fromWei(capDepositRatio)
      .sub(ucr)
      .mul(FPN.fromWei(assetDetails!.positionTokens!));
  }

  useEffect(() => {
    if (collateralValue !== '') {
      if (FPN.toWei(collateralValue).gt(max)) {
        setCollateralError(
          `Cannot Repay more than ${max.format(2)} ${
            selectedAsset.assetOut.name
          }`,
        );
      } else {
        setCollateralError('');
      }
    }
  }, [collateralValue]);
  const errorMessage =
    insufficientFunds && balance.lt(max) ? 'Insufficient funds' : null;
  const handleGoBack = () => {
    setShowPreview(false);
  };
  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="deposit">
      {showPreview === true ? (
        <TransactionHolder
          showPreview={showPreview}
          backHandler={handleGoBack}
          params={[
            {
              title: 'Deposit',
              asset: {
                name: selectedAsset.assetIn.name,
                icon: selectedAsset.assetIn.icon!,
              },
              value: FPN.toWei(
                collateralValue !== '' ? collateralValue : '0',
              ).format(2),
            },
            {
              title: 'Fee Percentage',
              asset: {
                name: selectedAsset.assetIn.name,
                icon: selectedAsset.assetIn.icon!,
              },
              value: `${FPN.fromWei(assetDetails!.feePercentage!)
                .mul(new FPN(100))
                .format(4)}%`,
            },
          ]}
          confirmHandler={() => {
            if (collateralValue === '') {
              setCollateralError('Collateral is Required');
              return;
            }

            const depositParams = {
              pair: assetKey,
              collateral: FPN.toWei(collateralValue).toString() as StringAmount,
            };
            console.log({ depositParams });
            dispatch({ type: 'CALL_DEPOSIT', payload: depositParams });
          }}
        />
      ) : (
        <WithdrawHolder tabHandler={tabHandler} assetInfo={assetDetails}>
          <Form>
            <ExchangeBox error>
              <Balance>Balance: {balance.format(4)}</Balance>
              <AssetSelect
                error={insufficientFunds || Boolean(collateralError)}
              >
                <Amount
                  value={collateralValue}
                  inputMode="numeric"
                  onKeyPress={e => handleKeyPress(e, { decimals: 5 })}
                  onChange={e => {
                    setCollateralValue(e.target.value);
                  }}
                  placeholder="0.0"
                  required
                  onFocus={e => {
                    e.target.select();
                  }}
                />
                <Max onClick={() => onMaxSelect(max.format(2))} />
                <Asset
                  flag={selectedAsset.assetIn.icon}
                  name={selectedAsset.assetIn.name}
                />
              </AssetSelect>
              <ErrorMessage>{errorMessage}</ErrorMessage>
              <ErrorMessage>{collateralError}</ErrorMessage>
            </ExchangeBox>
            <Value>Value: ${assetInValue}</Value>
          </Form>
          <SubmitContainer>
            <SubmitButton onClick={() => setShowPreview(true)}>
              Deposit
            </SubmitButton>
          </SubmitContainer>
        </WithdrawHolder>
      )}
    </WithPlaceholder>
  );
};
