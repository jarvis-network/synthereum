import React, { useEffect, useState } from 'react';

import {
  ExchangeBox,
  Balance,
  AssetSelect,
  handleKeyPress,
  Asset,
  ErrorMessage,
  Max,
  Form,
  SubmitContainer,
  SubmitButton,
  Amount,
} from '@/components/markets/modal/common';
import { selfMintingMarketAssets } from '@/data/markets';
import _ from 'lodash';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { useDispatch } from 'react-redux';

import { useTheme } from '@jarvis-network/ui';

import { ContractParams } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/interfaces';

import TransactionHolder from '../transaction/TransactionHolder';
import {
  ActionProps,
  ErrorMessageContainer,
  subtitle,
  title,
} from '../common/shared';
import { WithPlaceholder } from '../holders/WithPlaceholder';
import { WithdrawHolder } from '../withdraw/WithdrawHolder';
import { ModalFooter } from '../ModalFooter';

import { ApprovalTransaction } from '../ApprovalTransaction';

import { LoadingSection } from '../transaction/style';

import { Loader } from '../common/Loader';

import { useCalculateUserCollateralizationRatioLiquiationpriceFee } from './ucr_lp_fee';
import { useBalance } from './useBalance';
import { useMinMax } from './useMinMax';
import { useMintLimit } from './useMintLimit';

export const Borrow: React.FC<ActionProps> = ({ assetKey, tabHandler }) => {
  const dispatch = useDispatch();
  /* -------------------------------------------------------------------------- */
  /*                            Local State Variables                           */
  /* -------------------------------------------------------------------------- */
  const [showPreview, setShowPreview] = useState(false);
  const [collateralValue, setCollateralValue] = useState('');
  const [syntheticValue, setSyntheticValue] = useState('');
  const [collateralError, setCollateralError] = useState('');
  const [syntheticError, setSyntheticError] = useState('');
  const [inputFocus, setInputFocus] = useState('');

  const [collateralRequiredError, setCollateralRequiredError] = useState('');
  const [syntheticRequiredError, setSyntheticRequiredError] = useState('');

  const [borrowError, setBorrowError] = useState('');
  const [inProgress, setInProgress] = useState<boolean>(false);

  /* -------------------------------- Variables ------------------------------- */

  const selectedAsset = selfMintingMarketAssets[assetKey];

  /* -------------------------------------------------------------------------- */
  /*                               Redux Selectors                              */
  /* -------------------------------------------------------------------------- */

  const assetDetails = useReduxSelector(state => state.markets.list[assetKey]);

  const metaMaskError = useReduxSelector(state => state.transaction.error);
  const txValid = useReduxSelector(state => state.transaction.valid);
  /* -------------------------------------------------------------------------- */
  /*                                    HOOKS                                   */
  /* -------------------------------------------------------------------------- */
  const theme = useTheme();
  const { insufficientFunds, balanceErrorMessage, balance } = useBalance(
    collateralValue,
    assetKey,
  );
  const {
    minSynthetic,
    maxSynthetic,
    minCollateral,
    maxCollateral,
    validInput,
    ...minMaxErrors
  } = useMinMax(
    collateralValue,
    syntheticValue,
    assetDetails!,
    inputFocus as any,
  );

  const {
    fee,
    liquidationPrice,
    newRatio,
  } = useCalculateUserCollateralizationRatioLiquiationpriceFee(
    collateralValue,
    syntheticValue,
    assetDetails!,
  );
  const { isMintLimitReached, mintLimitReachMessage } = useMintLimit(
    syntheticValue,
    assetDetails!,
  );

  /* -------------------------------------------------------------------------- */
  /*                                     UI                                     */
  /* -------------------------------------------------------------------------- */

  /* ---------------------------- Component Updates --------------------------- */

  useEffect(() => {
    if (txValid) {
      setShowPreview(true);
      dispatch({
        type: 'transaction/reset',
      });
    }
  }, [txValid]);
  useEffect(() => {
    if (metaMaskError?.message) {
      setInProgress(false);
    }
  }, [metaMaskError]);

  /* ----------------------- Synthetic Error validation ----------------------- */
  useEffect(() => {
    if (isMintLimitReached) {
      setBorrowError(mintLimitReachMessage!);
    }
  }, [isMintLimitReached]);

  /* -------------------------------------------------------------------------- */
  /*                                  Handlers                                  */
  /* -------------------------------------------------------------------------- */
  const onMaxSyntheticSelect = (input: string) => {
    setInputFocus('synthetic');
    setSyntheticValue(input);
  };
  const onMaxCollateralSelect = (input: string) => {
    setInputFocus('collateral');
    setCollateralValue(input);
  };
  const handleGoBack = () => {
    dispatch({
      type: 'transaction/reset',
    });
    setInProgress(false);
    setShowPreview(false);
  };

  useEffect(() => {
    if (validInput) {
      setCollateralError('');
      setSyntheticError('');
    }
    setCollateralError(
      minMaxErrors.collateralError ? minMaxErrors.collateralError : '',
    );
    setSyntheticError(
      minMaxErrors.syntheticError ? minMaxErrors.syntheticError : '',
    );
  }, [minMaxErrors.collateralError, minMaxErrors.syntheticError]);

  useEffect(() => {
    if (syntheticValue !== '') {
      setSyntheticRequiredError('');
    }
    if (collateralValue !== '') {
      setCollateralRequiredError('');
    }
  }, [syntheticValue, collateralValue]);

  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="borrow">
      {showPreview ? (
        <TransactionHolder
          backHandler={handleGoBack}
          showPreview={showPreview}
          params={[
            {
              title: 'Deposit',
              asset: {
                name: selectedAsset.assetIn.name,
              },
              value: FPN.toWei(
                collateralValue !== '' ? collateralValue : '0',
              ).format(assetDetails?.collateralTokenDecimals),
            },
            {
              title: 'Borrow',
              asset: {
                name: selectedAsset.assetOut.name,
              },
              value: FPN.toWei(
                syntheticValue !== '' ? syntheticValue : '0',
              ).format(assetDetails?.syntheticTokenDecimals),
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
            const borrowParams: ContractParams = {
              pair: assetKey,
              collateral: FPN.toWei(collateralValue).toString() as StringAmount,
              numTokens: FPN.toWei(syntheticValue).toString() as StringAmount,
              feePercentage: assetDetails!.feePercentage as StringAmount,
            };

            dispatch({ type: 'CALL_BORROW', payload: borrowParams });
          }}
        />
      ) : (
        assetDetails && (
          <WithdrawHolder tabHandler={tabHandler!} assetInfo={assetDetails!}>
            <Form>
              <ExchangeBox error>
                <Balance>Balance: {balance && balance.format(6)}</Balance>
                <AssetSelect
                  error={
                    insufficientFunds ||
                    Boolean(collateralError) ||
                    Boolean(collateralRequiredError)
                  }
                >
                  <Amount
                    value={collateralValue}
                    inputMode="decimal"
                    maxLength={20}
                    onKeyPress={e => {
                      handleKeyPress(e, {
                        decimals: assetDetails.collateralTokenDecimals!,
                      });
                    }}
                    onChange={e => {
                      setInputFocus('collateral');
                      setCollateralValue(e.target.value);
                    }}
                    placeholder={`${
                      minCollateral.gt(new FPN(0))
                        ? `Min: ${minCollateral.format(
                            assetDetails.collateralTokenDecimals,
                          )}/`
                        : ``
                    }${
                      maxCollateral.gt(new FPN(0))
                        ? `Max: ${maxCollateral.format(
                            assetDetails.collateralTokenDecimals,
                          )}`
                        : `${new FPN(0).format(
                            assetDetails.collateralTokenDecimals,
                          )}`
                    }`}
                    required
                    onFocus={e => {
                      e.target.select();
                    }}
                  />
                  {maxCollateral.gt(new FPN(0)) && (
                    <Max
                      onClick={() =>
                        onMaxCollateralSelect(
                          maxCollateral.format(
                            assetDetails.collateralTokenDecimals,
                          ),
                        )
                      }
                    />
                  )}

                  <Asset name={selectedAsset.assetIn.name} />
                </AssetSelect>
                <ErrorMessage>
                  {balanceErrorMessage}
                  {!insufficientFunds && collateralError}
                  {!insufficientFunds && collateralRequiredError}
                </ErrorMessage>
              </ExchangeBox>

              <ExchangeBox error>
                <AssetSelect
                  error={
                    Boolean(syntheticError) || Boolean(syntheticRequiredError)
                  }
                >
                  <Amount
                    value={syntheticValue}
                    inputMode="numeric"
                    required
                    maxLength={20}
                    onKeyPress={e =>
                      handleKeyPress(e, {
                        decimals: assetDetails.syntheticTokenDecimals!,
                      })
                    }
                    onChange={e => {
                      setInputFocus('synthetic');
                      setSyntheticValue(e.target.value);
                    }}
                    onFocus={e => {
                      e.target.select();
                    }}
                    placeholder={`${
                      minSynthetic.gt(new FPN(0))
                        ? `Min: ${minSynthetic.format(
                            assetDetails.collateralTokenDecimals,
                          )}/`
                        : ``
                    }${
                      maxSynthetic.gt(new FPN(0))
                        ? `Max: ${maxSynthetic.format(
                            assetDetails.collateralTokenDecimals,
                          )}`
                        : `${new FPN(0).format(
                            assetDetails.collateralTokenDecimals,
                          )}`
                    }`}
                  />
                  {maxSynthetic.gt(new FPN(0)) && (
                    <Max
                      onClick={() =>
                        onMaxSyntheticSelect(maxSynthetic.format(6))
                      }
                    />
                  )}
                  <Asset name={selectedAsset.assetOut.name} />
                </AssetSelect>

                <ErrorMessage>
                  {!insufficientFunds && syntheticError}
                  {!insufficientFunds && syntheticRequiredError}
                </ErrorMessage>
              </ExchangeBox>
              <br />
            </Form>

            <div>
              {!insufficientFunds && (metaMaskError?.message || borrowError) && (
                <ErrorMessageContainer>
                  {metaMaskError?.message}
                  {borrowError}
                </ErrorMessageContainer>
              )}
            </div>
            <SubmitContainer>
              {!inProgress ? (
                <SubmitButton
                  key={Date.now()}
                  animate=""
                  style={
                    validInput &&
                    collateralError === '' &&
                    syntheticError === ''
                      ? {
                          background: theme.common.success,
                          text: theme.text.primary,
                        }
                      : {}
                  }
                  onClick={() => {
                    console.log({
                      collateralValue,
                      syntheticValue,
                      validInput,
                      maxCollateral: maxCollateral.format(),
                      minCollateral: minCollateral.format(),
                      maxSynthetic: maxSynthetic.format(),
                      minSynthetic: minSynthetic.format(),
                      minMaxErrors,
                    });
                    if (collateralValue === '') {
                      setCollateralRequiredError('Collateral is Required');
                      return;
                    }
                    if (syntheticValue === '') {
                      setSyntheticRequiredError('Synthetic is Required');
                      return;
                    }
                    if (
                      !validInput ||
                      collateralError !== '' ||
                      syntheticError !== ''
                    )
                      return;

                    dispatch({
                      type: 'transaction/reset',
                    });

                    const borrowParams = {
                      pair: assetKey,
                      collateral: FPN.toWei(
                        collateralValue,
                      ).toString() as StringAmount,
                      numTokens: FPN.toWei(
                        syntheticValue,
                      ).toString() as StringAmount,
                      feePercentage: assetDetails!
                        .feePercentage as StringAmount,
                      validateOnly: true,
                    };
                    setInProgress(true);

                    dispatch({ type: 'CALL_BORROW', payload: borrowParams });
                  }}
                >
                  <ApprovalTransaction
                    currency={selectedAsset.assetIn.name}
                    text="Borrow"
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
