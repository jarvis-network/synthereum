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
import { useTheme } from '@jarvis-network/ui';

import { useDispatch } from 'react-redux';

import TransactionHolder from '../transaction/TransactionHolder';
import {
  ActionProps,
  ErrorMessageContainer,
  subtitle,
  title,
} from '../common/shared';
import { WithPlaceholder } from '../holders/WithPlaceholder';
import { ModalFooter } from '../ModalFooter';
import { ApprovalTransaction } from '../ApprovalTransaction';

import { Loader } from '../common/Loader';

import { LoadingSection } from '../transaction/style';

import { WithdrawHolder } from '../withdraw/WithdrawHolder';

import { useCalculateUserCollateralizationRatioLiquiationpriceFee } from './ucr_lp_fee';
import { useMinMax } from './useMinMax';

export const Repay: React.FC<ActionProps> = ({ assetKey, tabHandler }) => {
  const dispatch = useDispatch();

  /* -------------------------------------------------------------------------- */
  /*                            Local State Variables                           */
  /* -------------------------------------------------------------------------- */
  const [showPreview, setShowPreview] = useState(false);
  const [syntheticValue, setSyntheticValue] = useState('');
  const [syntheticError, setSyntheticError] = useState('');
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [syntheticRequiredError, setSyntheticRequiredError] = useState('');

  /* -------------------------------- Variables ------------------------------- */
  const selectedAsset = selfMintingMarketAssets[assetKey];
  /* -------------------------------------------------------------------------- */
  /*                               Redux Selectors                              */
  /* -------------------------------------------------------------------------- */

  const assetDetails = useReduxSelector(state => state.markets.list[assetKey]);
  const metaMaskError = useReduxSelector(state => state.transaction.error);
  const txValid = useReduxSelector(state => state.transaction.valid);
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
        type: 'transaction/reset',
      });
    }
  }, [txValid]);
  // /* --------------------------------- Balance -------------------------------- */
  // const { balance, insufficientFunds } = useBalance(syntheticValue, assetKey);
  const theme = useTheme();
  const { maxSynthetic, validInput, ...minMaxErrors } = useMinMax(
    syntheticValue,
    assetDetails!,
  );
  const {
    fee,
    liquidationPrice,
    newRatio,
  } = useCalculateUserCollateralizationRatioLiquiationpriceFee(
    syntheticValue,
    assetDetails!,
  );

  /* -------------------------------------------------------------------------- */
  /*                                  Handlers                                  */
  /* -------------------------------------------------------------------------- */
  const onMaxSelect = () => {
    setSyntheticValue(
      maxSynthetic.format(assetDetails!.syntheticTokenDecimals!).toString(),
    );
  };

  const handleGoBack = () => {
    dispatch({
      type: 'transaction/reset',
    });
    setShowPreview(false);
    setInProgress(false);
  };

  /* ----------------------- Synthetic Error Validation ----------------------- */
  useEffect(() => {
    setSyntheticError(
      minMaxErrors.syntheticError ? minMaxErrors.syntheticError : '',
    );
  }, [minMaxErrors]);

  useEffect(() => {
    if (syntheticValue === '' || validInput) {
      setSyntheticError('');
    }
    if (syntheticValue !== '') {
      setSyntheticRequiredError('');
    }
  }, [syntheticValue]);

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
              },
              value: FPN.toWei(
                syntheticValue !== '' ? syntheticValue : '0',
              ).format(assetDetails!.syntheticTokenDecimals),
            },
            {
              title: 'Fee',
              asset: {
                name: selectedAsset.assetIn.name,
              },
              value: `${fee.format(6)}`,
            },
          ]}
          confirmHandler={() => {
            const params = {
              pair: assetKey,
              numTokens: FPN.toWei(syntheticValue).toString() as StringAmount,
              feePercentage: assetDetails!.feePercentage as StringAmount,
            };

            dispatch({ type: 'CALL_REPAY', payload: params });
          }}
        />
      ) : (
        assetDetails && (
          <WithdrawHolder tabHandler={tabHandler!} assetInfo={assetDetails!}>
            <Form>
              <ExchangeBox error>
                <Balance>
                  Balance:{' '}
                  {assetDetails &&
                    FPN.fromWei(assetDetails!.positionTokens!).format(6)}
                </Balance>

                <AssetSelect
                  error={
                    Boolean(syntheticError) || Boolean(syntheticRequiredError)
                  }
                >
                  <Amount
                    value={syntheticValue}
                    inputMode="numeric"
                    maxLength={50}
                    onKeyPress={e =>
                      handleKeyPress(e, {
                        decimals: assetDetails!.syntheticTokenDecimals!,
                      })
                    }
                    onChange={e => {
                      const parts = e.target.value.split('.');
                      const decimals = parts[1] || '';

                      if (
                        decimals.length > assetDetails.syntheticTokenDecimals!
                      ) {
                        setSyntheticError(
                          `Max ${assetDetails.syntheticTokenDecimals} decimal palaces allowed`,
                        );
                      } else {
                        setSyntheticValue(e.target.value);
                      }
                    }}
                    placeholder={`Max: ${maxSynthetic.format(
                      assetDetails!.syntheticTokenDecimals,
                    )}`}
                    required
                    onFocus={e => {
                      e.target.select();
                    }}
                  />
                  <Max onClick={() => onMaxSelect()} />
                  <Asset name={selectedAsset.assetOut.name} />
                </AssetSelect>
                <ErrorMessage>
                  {syntheticError}
                  {syntheticRequiredError}
                </ErrorMessage>
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
                    if (syntheticValue === '') {
                      setSyntheticRequiredError('Synthetic is Required');
                      return;
                    }
                    if (!validInput) return;
                    dispatch({
                      type: 'transaction/reset',
                    });

                    const params = {
                      pair: assetKey,
                      numTokens: FPN.toWei(
                        syntheticValue,
                      ).toString() as StringAmount,
                      feePercentage: assetDetails!
                        .feePercentage as StringAmount,
                      validateOnly: true,
                    };

                    setInProgress(true);

                    dispatch({ type: 'CALL_REPAY', payload: params });
                  }}
                >
                  <ApprovalTransaction
                    currency={selectedAsset.assetIn.name}
                    text="Repay"
                  />
                </SubmitButton>
              ) : (
                <LoadingSection>
                  <Loader />
                </LoadingSection>
              )}
            </SubmitContainer>
            {fee.gt(new FPN(0)) && (
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
