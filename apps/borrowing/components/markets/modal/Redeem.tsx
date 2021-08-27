import React, { useEffect, useState } from 'react';
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
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';
import _ from 'lodash';
import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { calculateDaoFee } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/borrow';
import { formatUSDValue } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/common';
import { useDispatch } from 'react-redux';

import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import TransactionHolder from './TransactionHolder';

const title = 'Lorem ipsum redeem';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);
interface RedeemProps {
  assetKey: SupportedSelfMintingPairExact;
}
export const Redeem: React.FC<RedeemProps> = ({ assetKey }) => {
  let assetInValue = '0.00';
  let assetOutValue = '0.00';
  const [showPreview, setShowPreview] = useState(false);
  const dispatch = useDispatch();
  const [collateralValue, setCollateralValue] = useState('0');
  const [collateralError, setCollateralError] = useState('');

  const [syntheticValue, setSyntheticValue] = useState('0');
  const [syntheticError, setSyntheticError] = useState('');
  const tokenBalances = useReduxSelector(state => state.wallet);
  const assetDetails = useReduxSelector(state => state.markets.list[assetKey]);
  const selectedAsset = selfMintingMarketAssets[assetKey];
  const balance = FPN.fromWei(
    tokenBalances[selectedAsset.assetOut.name]!.amount,
    // '1000000000000000000000'
  );

  const assetInPrice = useReduxSelector(
    state => state.prices[selectedAsset.assetIn.name],
  );
  const assetOutPrice = useReduxSelector(
    state => state.prices[selectedAsset.pair],
  );

  const onMaxSelect = () => setSyntheticValue(balance.format(2));
  const insufficientFunds = balance.lt(
    new FPN(syntheticValue === '' ? '0' : syntheticValue),
  )!;
  const errorMessage = insufficientFunds ? 'Insufficient funds' : null;

  if (assetInPrice && collateralValue !== '') {
    assetInValue = formatUSDValue(assetInPrice, collateralValue);
  }

  if (assetOutPrice && syntheticValue !== '') {
    assetOutValue = formatUSDValue(assetOutPrice, syntheticValue);
  }

  useEffect(() => {
    if (syntheticValue !== '') {
      setSyntheticError('');
      if (assetDetails!.positionCollateral!.toString() !== '0') {
        const ucr = FPN.fromWei(assetDetails!.positionCollateral!).div(
          FPN.fromWei(assetDetails!.positionTokens!),
        );
        const fee = calculateDaoFee({
          collateral: FPN.toWei(syntheticValue),
          collateralizationRatio: assetDetails!.collateralizationRatio!,
          feePercentage: assetDetails!.feePercentage!,
        });
        /**
         * `CollateralToReceive = (userInputOfSyntheticTokens * UserGCR) - calculateDaoFee(userInputOfSyntheticTokens)`
         */
        const collateralToReceive = FPN.toWei(syntheticValue).mul(ucr).sub(fee);

        setCollateralValue(collateralToReceive.format(4));
      }
    } else {
      setCollateralValue('0');
    }
  }, [syntheticValue]);
  const handleGoBack = () => {
    setShowPreview(false);
  };
  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="redeem">
      {showPreview === true ? (
        <TransactionHolder
          showPreview={showPreview}
          backHandler={handleGoBack}
          params={[
            {
              title: 'Deposit',
              asset: {
                name: selectedAsset.assetOut.name,
                icon: selectedAsset.assetOut.icon!,
              },
              value: FPN.toWei(
                syntheticValue !== '' ? syntheticValue : '0',
              ).format(2),
            },
            {
              title: 'Redeem',
              asset: {
                name: selectedAsset.assetIn.name,
                icon: selectedAsset.assetIn.icon,
              },
              value: FPN.toWei(
                collateralValue !== '' ? collateralValue : '0',
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
            if (collateralValue === '') {
              setCollateralError('Collateral is Required');
              return;
            }
            if (syntheticValue === '') {
              setSyntheticError('Synthetic is Required');
              return;
            }
            const borrowParams = {
              pair: assetKey,
              collateral: FPN.toWei(collateralValue).toString() as StringAmount,
              numTokens: FPN.toWei(syntheticValue).toString() as StringAmount,
              feePercentage: assetDetails!.feePercentage as StringAmount,
            };
            console.log({ borrowParams });
            dispatch({ type: 'CALL_REDEEM', payload: borrowParams });
          }}
        />
      ) : (
        <div>
          <Form>
            <ExchangeBox error={Boolean(errorMessage)}>
              <Balance>Balance: {balance.format(4)}</Balance>
              <AssetSelect error={Boolean(errorMessage)}>
                <Amount
                  value={syntheticValue}
                  inputMode="numeric"
                  onKeyPress={e => handleKeyPress(e, { decimals: 5 })}
                  onChange={e => {
                    setSyntheticValue(e.target.value);
                  }}
                  onFocus={e => {
                    e.target.select();
                  }}
                />
                <Max onClick={onMaxSelect} />
                {/* TODO: Fix this and pass asset as 1 object */}
                <Asset
                  flag={selectedAsset.assetOut.icon}
                  name={selectedAsset.assetOut.name}
                />
              </AssetSelect>
              <ErrorMessage>{errorMessage}</ErrorMessage>
              <ErrorMessage>{syntheticError}</ErrorMessage>
            </ExchangeBox>
            <Value>Value: ${assetOutValue}</Value>

            <ExchangeBox error={Boolean(errorMessage)}>
              <AssetSelect error={Boolean(errorMessage)}>
                <AmountSmallPlaceholder
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
              Redeem
            </SubmitButton>
          </SubmitContainer>
        </div>
      )}
    </WithPlaceholder>
  );
};
