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
import _ from 'lodash';
import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { useDispatch } from 'react-redux';

import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { useTheme } from '@jarvis-network/ui';

import TransactionHolder from '../transaction/TransactionHolder';
import {
  ActionProps,
  ErrorMessageContainer,
  subtitle,
  title,
} from '../common/shared';
import { WithPlaceholder } from '../holders/WithPlaceholder';
import { WithdrawHolder } from '../WithdrawHolder';
import { ModalFooter } from '../ModalFooter';
import { ApprovalTransaction } from '../ApprovalTransaction';

import { Loader } from '../common/Loader';

import { LoadingSection } from '../transaction/style';

import { useBalance } from './useBalance';
import { useCalculateUserCollateralizationRatioLiquiationpriceFee } from './ucr_lp_fee';
import { useMinMax } from './useMinMax';

export const Redeem: React.FC<ActionProps> = ({ assetKey, tabHandler }) => {
  const dispatch = useDispatch();
  /* -------------------------------------------------------------------------- */
  /*                            Local State Variables                           */
  /* -------------------------------------------------------------------------- */
  const [showPreview, setShowPreview] = useState(false);
  const [collateralValue, setCollateralValue] = useState('');
  const [collateralError, setCollateralError] = useState('');
  const [syntheticValue, setSyntheticValue] = useState('');
  const [syntheticError, setSyntheticError] = useState('');
  const [inputFocus, setInputFocus] = useState('');
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [maxRedeem, setMaxRedeem] = useState(false);

  /* -------------------------------- Variables ------------------------------- */

  const selectedAsset = selfMintingMarketAssets[assetKey];

  let errorMessage!: string | null;

  /* -------------------------------------------------------------------------- */
  /*                               Redux Selectors                              */
  /* -------------------------------------------------------------------------- */
  const metaMaskError = useReduxSelector(state => state.transaction.error);
  const txValid = useReduxSelector(state => state.transaction.valid);
  const assetDetails = useReduxSelector(state => state.markets.list[assetKey]);

  /* -------------------------------------------------------------------------- */
  /*                                     UI                                     */
  /* -------------------------------------------------------------------------- */
  const { insufficientFunds, balanceErrorMessage } = useBalance(
    syntheticValue,
    assetKey,
  );
  const minMax = useMinMax(collateralValue, syntheticValue, assetDetails!);
  const {
    fee,
    liquidationPrice,
    newRatio,
  } = useCalculateUserCollateralizationRatioLiquiationpriceFee(
    collateralValue,
    syntheticValue,
    assetDetails!,
    maxRedeem,
  );

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
  const theme = useTheme();
  /* --------------------------------- Balance -------------------------------- */

  /* -------------------------------------------------------------------------- */
  /*            Calculate Max Synth redeem from Collateral input            */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (minMax.maxSynthetic && inputFocus === 'collateral') {
      setSyntheticValue(
        minMax.maxSynthetic.format(assetDetails!.syntheticTokenDecimals),
      );
    }
  }, [minMax.maxSynthetic]);
  /* -------------------------------------------------------------------------- */
  /*            Calculate Max Collateral redeem from Synthetic input            */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (minMax.maxCollateral && inputFocus === 'synthetic') {
      setCollateralValue(
        minMax.maxCollateral.format(assetDetails!.collateralTokenDecimals),
      );
    }
  }, [minMax.maxCollateral]);

  useEffect(() => {
    if (syntheticValue !== '') {
      setSyntheticError('');
    }
    if (collateralValue !== '') {
      setCollateralError('');
    }

    if (collateralValue === '' && inputFocus === 'collateral') {
      setSyntheticValue('');
    }
    if (syntheticValue === '' && inputFocus === 'synthetic') {
      setCollateralValue('');
    }
  }, [syntheticValue, collateralValue]);
  /* -------------------------------------------------------------------------- */
  /*                                  Handlers                                  */
  /* -------------------------------------------------------------------------- */

  const handleGoBack = () => {
    dispatch({
      type: 'transaction/reset',
    });
    setShowPreview(false);
    setInProgress(false);
  };
  const onMaxSyntheticSelect = () => {
    setSyntheticValue(
      FPN.fromWei(assetDetails!.positionTokens!).format(
        assetDetails!.syntheticTokenDecimals,
      ),
    );
    setCollateralValue(
      FPN.fromWei(assetDetails!.positionCollateral!).format(
        assetDetails!.collateralTokenDecimals,
      ),
    );
    setMaxRedeem(true);
  };
  const onMaxCollateralSelect = () => {
    setCollateralValue(
      FPN.fromWei(assetDetails!.positionCollateral!).format(
        assetDetails!.collateralTokenDecimals,
      ),
    );
    setSyntheticValue(
      FPN.fromWei(assetDetails!.positionTokens!).format(
        assetDetails!.syntheticTokenDecimals,
      ),
    );
    setMaxRedeem(true);
  };

  useEffect(() => {
    if (syntheticValue !== '') {
      const inputSynthetic = FPN.toWei(syntheticValue.toString());
      if (inputSynthetic.lt(minMax.maxSyntheticAllowed)) {
        setMaxRedeem(false);
      }

      if (
        inputSynthetic.gt(minMax.maxSyntheticAllowed) &&
        maxRedeem === false &&
        minMax.maxSyntheticAllowed.gt(new FPN(0))
      ) {
        onMaxSyntheticSelect();
      }
    }
  }, [syntheticValue]);
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
              ).format(assetDetails!.syntheticTokenDecimals),
            },
            {
              title: 'Redeem',
              asset: {
                name: selectedAsset.assetIn.name,
                icon: selectedAsset.assetIn.icon,
              },
              value: FPN.toWei(
                collateralValue !== '' ? collateralValue : '0',
              ).format(assetDetails!.collateralTokenDecimals),
            },
            {
              title: 'Fee',
              asset: {
                name: selectedAsset.assetIn.name,
                icon: selectedAsset.assetIn.icon!,
              },
              value: `${fee.format(6)}`,
            },
          ]}
          confirmHandler={() => {
            const redeemParams = {
              pair: assetKey,
              collateral: FPN.toWei(collateralValue).toString() as StringAmount,
              numTokens: FPN.toWei(syntheticValue).toString() as StringAmount,
              feePercentage: assetDetails!.feePercentage as StringAmount,
            };

            dispatch({ type: 'CALL_REDEEM', payload: redeemParams });
          }}
        />
      ) : (
        assetDetails && (
          <WithdrawHolder tabHandler={tabHandler!} assetInfo={assetDetails!}>
            <Form>
              <ExchangeBox error>
                <Balance>
                  Minted:{' '}
                  {assetDetails &&
                    FPN.fromWei(assetDetails!.positionTokens!).format(6)}
                </Balance>
                <AssetSelect
                  error={insufficientFunds || Boolean(syntheticError)}
                >
                  <Amount
                    value={syntheticValue}
                    maxLength={50}
                    inputMode="numeric"
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
                    placeholder={`Max: ${FPN.fromWei(
                      assetDetails!.positionTokens!,
                    ).format(assetDetails!.syntheticTokenDecimals)}`}
                    required
                    onFocus={e => {
                      setInputFocus('synthetic');
                      e.target.select();
                    }}
                  />
                  <Max onClick={onMaxSyntheticSelect} />
                  {/* TODO: Fix this and pass asset as 1 object */}

                  <Asset
                    flag={selectedAsset.assetOut.icon}
                    name={selectedAsset.assetOut.name}
                  />
                </AssetSelect>
                <ErrorMessage>{errorMessage}</ErrorMessage>
                <ErrorMessage>
                  {balanceErrorMessage}
                  {!insufficientFunds && syntheticError}
                </ErrorMessage>
              </ExchangeBox>

              <ExchangeBox error>
                <Balance>
                  Collateral:{' '}
                  {assetDetails &&
                    FPN.fromWei(assetDetails!.positionCollateral!).format(6)}
                </Balance>
                <AssetSelect error={Boolean(collateralError)}>
                  <Amount
                    value={collateralValue}
                    inputMode="numeric"
                    maxLength={50}
                    onKeyPress={e =>
                      handleKeyPress(e, {
                        decimals: assetDetails!.collateralTokenDecimals!,
                      })
                    }
                    onChange={e => {
                      const parts = e.target.value.split('.');
                      const decimals = parts[1] || '';

                      if (
                        decimals.length > assetDetails.collateralTokenDecimals!
                      ) {
                        setCollateralError(
                          `Max ${assetDetails.collateralTokenDecimals} decimal palaces allowed`,
                        );
                      } else {
                        setCollateralValue(e.target.value);
                      }
                    }}
                    placeholder={`Max: ${FPN.fromWei(
                      assetDetails!.positionCollateral!,
                    ).format(assetDetails!.collateralTokenDecimals)}`}
                    required
                    onFocus={e => {
                      setInputFocus('collateral');
                      e.target.select();
                    }}
                  />
                  <Max onClick={onMaxCollateralSelect} />
                  <Asset
                    flag={selectedAsset.assetIn.icon}
                    name={selectedAsset.assetIn.name}
                  />
                </AssetSelect>

                <ErrorMessage>{collateralError}</ErrorMessage>
              </ExchangeBox>
            </Form>
            <div>
              {!insufficientFunds && metaMaskError?.message && (
                <ErrorMessageContainer>
                  {metaMaskError?.message}
                </ErrorMessageContainer>
              )}
            </div>
            <SubmitContainer>
              {!inProgress ? (
                <SubmitButton
                  style={
                    FPN.toWei(syntheticValue === '' ? '0' : syntheticValue).gt(
                      new FPN(0),
                    )
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
                    if (syntheticValue === '') {
                      setSyntheticError('Synthetic is Required');
                      return;
                    }
                    if (collateralValue === '') {
                      setCollateralError('Collateral is Required');
                      return;
                    }
                    if (
                      FPN.toWei(
                        syntheticValue === '' ? '0' : syntheticValue,
                      ).lte(new FPN(0))
                    )
                      return;

                    const redeemParams = {
                      pair: assetKey,

                      numTokens: FPN.toWei(
                        syntheticValue,
                      ).toString() as StringAmount,
                      feePercentage: assetDetails!
                        .feePercentage as StringAmount,
                      validateOnly: true,
                    };

                    setInProgress(true);

                    dispatch({ type: 'CALL_REDEEM', payload: redeemParams });
                  }}
                >
                  <ApprovalTransaction
                    currency={selectedAsset.assetIn.name}
                    text="Redeem"
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
