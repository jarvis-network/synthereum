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
  SubmitButton,
  SubmitContainer,
} from '@/components/markets/modal/common';

import _ from 'lodash';
import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { useTheme } from '@jarvis-network/ui';
import { useDispatch } from 'react-redux';

import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { WithPlaceholder } from '../holders/WithPlaceholder';

import TransactionHolder from '../transaction/TransactionHolder';

import {
  ActionProps,
  ErrorMessageContainer,
  subtitle,
  title,
} from '../common/shared';

import { calculateGlobalCollateralizationRatio } from '../helpers/gcr';

import { ModalFooter } from '../ModalFooter';
import { Loader } from '../common/Loader';
import { LoadingSection } from '../transaction/style';
import { ApprovalTransaction } from '../ApprovalTransaction';

import { ManageWithdraw } from './ManageWithdraw';
import { useCalculateUserCollateralizationRatioLiquiationpriceFee } from './ucr_lp_fee';
import { errors } from './messages';

export const Withdraw: React.FC<ActionProps> = ({ assetKey }) => {
  const dispatch = useDispatch();
  /* -------------------------------------------------------------------------- */
  /*                            Local State Variables                           */
  /* -------------------------------------------------------------------------- */
  const [showPreview, setShowPreview] = useState(false);
  const [collateralError, setCollateralError] = useState('');
  const [collateralValue, setCollateralValue] = useState('');
  const [slow, setSlow] = useState(false);

  const [inProgress, setInProgress] = useState<boolean>(false);

  const theme = useTheme();
  /* -------------------------------- Variables ------------------------------- */

  const selectedAsset = selfMintingMarketAssets[assetKey];

  /* -------------------------------------------------------------------------- */
  /*                               Redux Selectors                              */
  /* -------------------------------------------------------------------------- */
  const assetDetails = useReduxSelector(state => state.markets.list[assetKey]);

  const syntheticPrice = useReduxSelector(
    state => state.prices[selectedAsset.pair],
  );
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
      dispatch({
        type: 'approvalTransaction/reset',
      });
    }
  }, [txValid]);
  /* --------------------------------- Balance -------------------------------- */
  const balance = FPN.fromWei(assetDetails!.positionCollateral!);
  const {
    fee,
    liquidationPrice,
    newRatio,
  } = useCalculateUserCollateralizationRatioLiquiationpriceFee(
    collateralValue,
    assetDetails!,
  );
  /* ------------------------------- Formatting ------------------------------- */

  /* -------------------------------------------------------------------------- */
  /*                                  Handlers                                  */
  /* -------------------------------------------------------------------------- */
  const handleGoBack = () => {
    dispatch({
      type: 'transaction/reset',
    });
    setInProgress(false);
    setShowPreview(false);
  };
  /* -------------------------------------------------------------------------- */
  /*                       Calculate Fast or Slow withdraw                      */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const lr = FPN.fromWei(assetDetails!.liquidationRatio!).mul(
      FPN.toWei('100'),
    );
    if (newRatio.gt(new FPN(0)) && collateralValue !== '') {
      if (newRatio.lte(lr)) {
        setCollateralError(errors.blt);
      } else {
        setCollateralError('');
      }

      setSlow(
        newRatio.lt(
          calculateGlobalCollateralizationRatio(
            assetDetails!.collateralizationRatio!,
            syntheticPrice!,
          ),
        ),
      );
    }
  }, [newRatio]);

  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="withdraw">
      {showPreview === true ? (
        <TransactionHolder
          showPreview={showPreview}
          backHandler={handleGoBack}
          params={[
            {
              title: 'Withdraw',
              asset: {
                name: selectedAsset.assetIn.name,
              },
              value: FPN.toWei(
                collateralValue !== '' ? collateralValue : '0',
              ).format(6),
            },
          ]}
          confirmHandler={() => {
            const params = {
              pair: assetKey,
              slow,
              collateral: FPN.toWei(collateralValue).toString() as StringAmount,
            };

            dispatch({ type: 'CALL_WITHDRAW', payload: params });
          }}
        />
      ) : (
        assetDetails && (
          <ManageWithdraw assetInfo={assetDetails!}>
            <Form>
              <ExchangeBox error>
                <Balance>Balance: {balance.format(6)}</Balance>
                <AssetSelect error={Boolean(collateralError)}>
                  <Amount
                    value={collateralValue}
                    inputMode="numeric"
                    onKeyPress={e => handleKeyPress(e, { decimals: 5 })}
                    required
                    onChange={e => {
                      setCollateralValue(e.target.value);
                    }}
                    placeholder="0.000000"
                    onFocus={e => {
                      e.target.select();
                    }}
                  />
                  <Asset name={selectedAsset.assetIn.name} />
                </AssetSelect>

                <ErrorMessage>{collateralError}</ErrorMessage>
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
                    collateralError === '' &&
                    collateralValue !== '' &&
                    FPN.toWei(collateralValue).gt(new FPN(0))
                      ? {
                          background: theme.common.success,
                          text: theme.text.primary,
                        }
                      : {}
                  }
                  onClick={() => {
                    if (collateralError !== '') return;
                    dispatch({
                      type: 'transaction/reset',
                    });
                    if (collateralValue === '') {
                      setCollateralError('Collateral is Required');
                      return;
                    }
                    const params = {
                      pair: assetKey,
                      slow,
                      collateral: FPN.toWei(
                        collateralValue,
                      ).toString() as StringAmount,
                      validateOnly: true,
                    };
                    setInProgress(true);
                    dispatch({ type: 'CALL_WITHDRAW', payload: params });
                  }}
                >
                  <ApprovalTransaction
                    currency={selectedAsset.assetIn.name}
                    text="Withdraw"
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
          </ManageWithdraw>
        )
      )}
    </WithPlaceholder>
  );
};
