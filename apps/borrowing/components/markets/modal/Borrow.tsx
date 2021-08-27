import React, { useEffect, useState } from 'react';
import { WithPlaceholder } from '@/components/markets/modal/WithPlaceholder';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';

import {
  ExchangeBox,
  Link,
  Balance,
  AssetSelect,
  Amount,
  AmountSmallPlaceholder,
  handleKeyPress,
  Asset,
  ErrorMessage,
  Max,
  Form,
  SubmitContainer,
  SubmitButton,
  Value,
} from '@/components/markets/modal/common';
import { selfMintingMarketAssets } from '@/data/markets';
import _ from 'lodash';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import {
  StringAmount,
  wei,
} from '@jarvis-network/core-utils/dist/base/big-number';
import { calculateDaoFee } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/borrow';
import { formatUSDValue } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/common';

import { scaleTokenAmountToWei } from '@jarvis-network/core-utils/dist/eth/contracts/erc20';
import { styled } from '@jarvis-network/ui';
import { useDispatch } from 'react-redux';

import TransactionHolder from './TransactionHolder';
import { WithdrawHolder } from './WithdrawHolder';

const SplitRow = styled.div`
  display: inline-block;
  width: 50%;
  &:nth-child(1) {
    text-align: left;
  }
`;
const MarginBottom = styled.div`
  margin-bottom: 5px;
`;

const title = 'Lorem ipsum borrow';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);
interface BorrowProps {
  assetKey: SupportedSelfMintingPairExact;
  tabHandler: (input: number) => void;
}

export const Borrow: React.FC<BorrowProps> = ({ assetKey, tabHandler }) => {
  const dispatch = useDispatch();

  const [showPreview, setShowPreview] = useState(false);
  const [collateralValue, setCollateralValue] = useState('');
  const [syntheticValue, setSyntheticValue] = useState('');
  const [collateralError, setCollateralError] = useState('');
  const [syntheticError, setSyntheticError] = useState('');

  const [minSynthetic, setMinSynthetic] = useState<FPN>(new FPN(0));
  const [maxSynthetic, setMaxSynthetic] = useState<FPN>(new FPN(0));
  let assetInValue = '0.00';
  const [feeValue, setFeeValue] = useState('0');

  const tokenBalances = useReduxSelector(state => state.wallet);
  const assetDetails = useReduxSelector(state => state.markets.list[assetKey]);
  const selectedAsset = selfMintingMarketAssets[assetKey];
  const balance = FPN.fromWei(
    tokenBalances[selectedAsset.assetIn.name]!.amount,
    // '1000000000000000000000'
  );

  const assetInPrice = useReduxSelector(
    state => state.prices[selectedAsset.assetIn.name],
  );

  useEffect(() => {
    if (assetInPrice && collateralValue !== '') {
      setCollateralError('');
      const inputCollateral = FPN.toWei(collateralValue.toString());
      const fee = calculateDaoFee({
        collateral: inputCollateral,
        collateralizationRatio: assetDetails!.collateralizationRatio!,
        feePercentage: assetDetails!.feePercentage!,
      });

      setFeeValue(fee.format(2));

      const gcr = assetDetails?.collateralizationRatio;
      const capDepositRatio = scaleTokenAmountToWei({
        amount: wei(assetDetails!.capDepositRatio!),
        decimals: 6,
      });

      setMinSynthetic(inputCollateral.div(FPN.fromWei(capDepositRatio)));

      setMaxSynthetic(inputCollateral.div(FPN.fromWei(gcr!)));
    }
  }, [collateralValue, assetInPrice, assetInValue]);

  useEffect(() => {
    if (syntheticValue !== '') {
      setSyntheticError('');
      const syntheticInput = FPN.toWei(syntheticValue.toString());

      if (syntheticInput.gt(maxSynthetic) || syntheticInput.lt(minSynthetic)) {
        setSyntheticError(
          `Cannot deposit more than ${maxSynthetic.format(
            2,
          )} and less than ${minSynthetic.format(2)}`,
        );
      }
    }
  }, [syntheticValue]);

  if (assetInPrice && collateralValue !== '') {
    assetInValue = formatUSDValue(assetInPrice, collateralValue);
  }

  const onMaxSelect = (input: string) => setSyntheticValue(input);
  const insufficientFunds = balance.lt(
    new FPN(collateralValue === '' ? '0' : collateralValue),
  )!;
  const errorMessage = insufficientFunds ? 'Insufficient funds' : null;
  const handleGoBack = () => {
    setShowPreview(false);
  };
  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="borrow">
      {showPreview === true ? (
        <TransactionHolder
          backHandler={handleGoBack}
          showPreview={showPreview}
          params={[
            {
              title: 'Deposit',
              asset: {
                name: selectedAsset.assetIn.name,
                icon: selectedAsset.assetIn.icon,
              },
              value: FPN.toWei(
                collateralValue !== '' ? collateralValue : '0',
              ).format(2),
            },
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
                name: selectedAsset.assetIn.name,
                icon: selectedAsset.assetIn.icon,
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

            dispatch({ type: 'CALL_BORROW', payload: borrowParams });
          }}
        />
      ) : (
        <WithdrawHolder tabHandler={tabHandler} assetInfo={assetDetails!}>
          <Form>
            <ExchangeBox error>
              <Balance>Balance: {balance.format()}</Balance>
              <AssetSelect
                error={insufficientFunds || Boolean(collateralError)}
              >
                <Amount
                  value={collateralValue}
                  inputMode="numeric"
                  maxLength={8}
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

            <ExchangeBox error={Boolean(syntheticError)}>
              <AssetSelect error={Boolean(syntheticError)}>
                <AmountSmallPlaceholder
                  value={syntheticValue}
                  inputMode="numeric"
                  required
                  maxLength={10}
                  onKeyPress={e => handleKeyPress(e, { decimals: 5 })}
                  onChange={e => {
                    setSyntheticValue(e.target.value);
                  }}
                  onFocus={e => {
                    e.target.select();
                  }}
                  placeholder={`Min: ${minSynthetic.format(
                    2,
                  )}/Max: ${maxSynthetic.format(2)}`}
                />
                <Max onClick={() => onMaxSelect(maxSynthetic.format(2))} />
                <Asset
                  flag={selectedAsset.assetOut.icon}
                  name={selectedAsset.assetOut.name}
                />
              </AssetSelect>
              <ErrorMessage>{syntheticError}</ErrorMessage>
            </ExchangeBox>
            <br />

            <MarginBottom />
            <Value>
              <SplitRow>
                Min: {minSynthetic.format(2)} {selectedAsset.assetOut.name}{' '}
                <br />
                (Less Risky)
              </SplitRow>
              <SplitRow>
                Max: {maxSynthetic.format(2)} {selectedAsset.assetOut.name}{' '}
                <br />
                (More Risky)
              </SplitRow>
            </Value>
            <MarginBottom />
            <Value>
              Approx Fee: {feeValue} {selectedAsset.assetIn.name}
            </Value>
            {/* {assetOutPrice ? (
          <Value>
            1 {selectedAsset.assetOut.name} = $
            {FPN.fromWei(assetOutPrice!.toString()).format(2)}
          </Value>
        ) : null} */}
          </Form>
          <MarginBottom />
          <MarginBottom />
          <SubmitContainer>
            <SubmitButton
              onClick={() => {
                setShowPreview(true);
              }}
            >
              Borrow
            </SubmitButton>
          </SubmitContainer>
        </WithdrawHolder>
      )}
    </WithPlaceholder>
  );
};
