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
  Max,
  SubmitButton,
  SubmitContainer,
} from '@/components/markets/modal/common';
import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { useDispatch } from 'react-redux';
import { useTheme } from '@jarvis-network/ui';

import TransactionHolder from '../transaction/TransactionHolder';
import {
  ActionProps,
  ErrorMessageContainer,
  subtitle,
  title,
} from '../common/shared';
import { WithPlaceholder } from '../holders/WithPlaceholder';

import { ModalFooter } from '../ModalFooter';
import { LoadingSection } from '../transaction/style';
import { Loader } from '../common/Loader';
import { ApprovalTransaction } from '../ApprovalTransaction';

import { WithdrawHolder } from '../withdraw/WithdrawHolder';

import { useBalance } from './useBalance';
import { useMinMax } from './useMinMax';
import { useCalculateUserCollateralizationRatioLiquiationpriceFee } from './ucr_lp_fee';

export const Deposit: React.FC<ActionProps> = ({ assetKey, tabHandler }) => {
  const dispatch = useDispatch();
  /* -------------------------------------------------------------------------- */
  /*                            Local State Variables                           */
  /* -------------------------------------------------------------------------- */
  const [showPreview, setShowPreview] = useState(false);
  const [collateralValue, setCollateralValue] = useState('');
  const [collateralError, setCollateralError] = useState('');
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [collateralRequiredError, setCollateralRequiredError] = useState('');
  const [maxDeposit, setMaxDeposit] = useState(false);

  const theme = useTheme();
  /* -------------------------------- Variables ------------------------------- */

  const selectedAsset = selfMintingMarketAssets[assetKey];

  /* -------------------------------------------------------------------------- */
  /*                               Redux Selectors                              */
  /* -------------------------------------------------------------------------- */
  const metaMaskError = useReduxSelector(state => state.transaction.error);
  const txValid = useReduxSelector(state => state.transaction.valid);
  const assetDetails = useReduxSelector(state => state.markets.list[assetKey])!;

  /* -------------------------------------------------------------------------- */
  /*                                     UI                                     */
  /* -------------------------------------------------------------------------- */

  /* ---------------------------- Component Updates --------------------------- */

  useEffect(() => {
    if (metaMaskError?.message) {
      setInProgress(false);
    }
  }, [metaMaskError]);

  useEffect(() => {
    if (txValid) {
      setShowPreview(true);
      dispatch({
        type: 'approvalTransaction/reset',
      });
      dispatch({
        type: 'transaction/reset',
      });
    }
  }, [txValid]);
  /* --------------------------------- Balance -------------------------------- */
  const { balance } = useBalance(collateralValue, assetKey);
  const {
    fee,
    liquidationPrice,
    newRatio,
  } = useCalculateUserCollateralizationRatioLiquiationpriceFee(
    collateralValue,
    assetDetails!,
  );

  const { maxCollateral, validInput, ...minMaxErrors } = useMinMax(
    collateralValue,
    assetDetails!,
  );
  /* -------------------------------------------------------------------------- */
  /*                                  Handlers                                  */
  /* -------------------------------------------------------------------------- */
  const onMaxSelect = (input: string) => {
    setCollateralValue(input);
    setMaxDeposit(true);
  };
  const handleGoBack = () => {
    dispatch({
      type: 'transaction/reset',
    });
    setShowPreview(false);
    setInProgress(false);
  };

  useEffect(() => {
    if (validInput && maxCollateral.gt(new FPN(0))) {
      setCollateralError('');
    }
    if (minMaxErrors.collateralError) {
      setCollateralError(minMaxErrors.collateralError);
    }
  }, [minMaxErrors]);

  useEffect(() => {
    if (collateralValue === '') {
      setCollateralError('');
    }
    if (collateralValue !== '') {
      const collateralInput = FPN.toWei(collateralValue);

      if (collateralInput.lt(maxCollateral)) {
        setMaxDeposit(false);
      }
      setCollateralRequiredError('');

      const parts = collateralValue.split('.');
      const decimals = parts[1] || '';

      if (decimals.length > assetDetails.collateralTokenDecimals!) {
        setCollateralRequiredError(
          `Max ${assetDetails.collateralTokenDecimals} decimal palaces allowed`,
        );
      }
      if (maxCollateral.eq(new FPN(0)) && collateralInput.gt(new FPN(0))) {
        setCollateralError('Invalid amount');
      }
    }
  }, [collateralValue]);
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
              },
              value: FPN.toWei(
                collateralValue !== '' ? collateralValue : '0',
              ).format(2),
            },
          ]}
          confirmHandler={() => {
            const depositParams = {
              pair: assetKey,
              collateral: FPN.toWei(collateralValue).toString() as StringAmount,
            };

            dispatch({ type: 'CALL_DEPOSIT', payload: depositParams });
          }}
        />
      ) : (
        assetDetails && (
          <WithdrawHolder tabHandler={tabHandler!} assetInfo={assetDetails}>
            <Form>
              <ExchangeBox error>
                <Balance>Balance: {balance && balance.format(6)}</Balance>
                <AssetSelect
                  error={
                    Boolean(collateralError) || Boolean(collateralRequiredError)
                  }
                >
                  <Amount
                    value={collateralValue}
                    inputMode="numeric"
                    maxLength={50}
                    onKeyPress={e => {
                      handleKeyPress(e, {
                        decimals: assetDetails.collateralTokenDecimals!,
                      });
                    }}
                    onChange={e => {
                      setCollateralValue(e.target.value);
                    }}
                    placeholder={`Max: ${maxCollateral.format(6)}`}
                    required
                    onFocus={e => {
                      e.target.select();
                    }}
                  />
                  {maxCollateral && (
                    <Max onClick={() => onMaxSelect(maxCollateral.format(6))} />
                  )}
                  <Asset name={selectedAsset.assetIn.name} />
                </AssetSelect>
                <ErrorMessage>{collateralError}</ErrorMessage>
                <ErrorMessage>{collateralRequiredError}</ErrorMessage>
              </ExchangeBox>
            </Form>
            <div>
              {metaMaskError?.message && (
                <ErrorMessageContainer>
                  {metaMaskError?.message}
                </ErrorMessageContainer>
              )}
            </div>
            <SubmitContainer>
              {!inProgress ? (
                <SubmitButton
                  style={
                    validInput
                      ? {
                          background: theme.common.success,
                          text: theme.text.primary,
                        }
                      : {}
                  }
                  onClick={() => {
                    dispatch({
                      type: 'transaction/reset',
                    });
                    if (collateralValue === '') {
                      setCollateralRequiredError('Collateral is Required');
                      return;
                    }
                    if (!validInput) return;
                    const depositParams = {
                      pair: assetKey,
                      collateral: FPN.toWei(
                        collateralValue,
                      ).toString() as StringAmount,
                      validateOnly: true,
                    };
                    setInProgress(true);
                    if (maxDeposit) {
                      depositParams.collateral = FPN.fromWei(
                        assetDetails!.positionTokens!,
                      ).toString() as StringAmount;
                    }
                    dispatch({ type: 'CALL_DEPOSIT', payload: depositParams });
                  }}
                >
                  <ApprovalTransaction
                    currency={selectedAsset.assetIn.name}
                    text="Deposit"
                  />
                </SubmitButton>
              ) : (
                <LoadingSection>
                  <Loader />
                </LoadingSection>
              )}
            </SubmitContainer>
            {newRatio.gt(new FPN(0)) && (
              <ModalFooter
                newRatio={newRatio}
                liquidationPrice={liquidationPrice}
                fee={fee}
                currency={selectedAsset.assetIn.name}
              />
            )}
          </WithdrawHolder>
        )
      )}
    </WithPlaceholder>
  );
};
