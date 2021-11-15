import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';
import React, { useState } from 'react';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { selfMintingMarketAssets } from '@/data/markets';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';

import { DateTime } from 'luxon';
import CountDownTimer from '@/components/countdown/Countdown';
import { useDispatch } from 'react-redux';
import { styled, useTheme } from '@jarvis-network/ui';

import TransactionHolder from '../transaction/TransactionHolder';
import { TransactionParams } from '../transaction/TransactionParams';

import {
  WithdrawContainer,
  InnerContainer,
  Title,
  SubTitle,
  Note,
  GotoWithdrawButton,
} from './style';

export const Container = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  > :nth-child(n + 1) {
    flex: 1 1 auto;
  }
`;
export const GridContainer = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  > :nth-child(n + 1) {
    flex: 1 1 auto;
    display: grid;
  }
`;
export const SubmitContainer = styled.div`
  text-align: center;
  display: flex;
`;
export interface ManageWithdrawProps {
  assetInfo: Market;
}
export const ManageWithdraw: React.FC<ManageWithdrawProps> = ({
  children,
  assetInfo: asset,
}) => {
  const isRequestPending =
    asset!.positionWithdrawalRequestAmount!.toString() !== '0';
  const selectedAsset =
    selfMintingMarketAssets[asset!.pair as SupportedSelfMintingPairExact];
  const withdrawTimeStamp = DateTime.fromSeconds(
    asset!.positionWithdrawalRequestPassTimestamp!,
  );
  const dispatch = useDispatch();
  const [showTimer, setShowTimer] = useState(true);
  const [cancelTx, setCancelTx] = useState(false);
  const theme = useTheme();
  const [approveWithdraw, setApproveWithdraw] = useState(false);
  const handleGoBack = () => {
    setCancelTx(false);
    setApproveWithdraw(false);
  };
  return (
    <Container>
      {!isRequestPending && approveWithdraw === false && cancelTx === false ? (
        children
      ) : cancelTx === true ? (
        <TransactionHolder
          backHandler={handleGoBack}
          showPreview={cancelTx}
          params={[
            {
              title: 'Cancel Withdraw',
              asset: {
                name: selectedAsset.assetIn.name,
              },
              value: FPN.fromWei(
                asset!.positionWithdrawalRequestAmount!,
              ).format(2),
            },
          ]}
          confirmHandler={() => {
            dispatch({
              type: 'CALL_CANCEL_WITHDRAW',
              payload: {
                pair: asset!.pair,
              },
            });
          }}
        />
      ) : approveWithdraw === true ? (
        <TransactionHolder
          backHandler={handleGoBack}
          showPreview={approveWithdraw}
          params={[
            {
              title: 'Approve Withdraw',
              asset: {
                name: selectedAsset.assetIn.name,
              },
              value: FPN.fromWei(
                asset!.positionWithdrawalRequestAmount!,
              ).format(2),
            },
          ]}
          confirmHandler={() => {
            dispatch({
              type: 'CALL_APPROVE_WITHDRAW',
              payload: {
                pair: asset!.pair,
              },
            });
          }}
        />
      ) : (
        <WithdrawContainer>
          <InnerContainer>
            <GridContainer>
              <div>
                <Title>You have Withdrawal Request Pending </Title>
                <SubTitle>
                  It will Processed after:{' '}
                  <span>
                    {withdrawTimeStamp.toLocaleString(DateTime.DATETIME_MED)}
                  </span>
                </SubTitle>
                <Note>
                  You need to can click <span>Withdraw Now</span> to receive
                  funds
                </Note>
                <TransactionParams
                  params={[
                    {
                      title: 'Withdraw',
                      asset: {
                        name: selectedAsset.assetIn.name,
                      },
                      value: FPN.fromWei(
                        asset!.positionWithdrawalRequestAmount!,
                      ).format(2),
                    },
                  ]}
                />
              </div>
              <div>
                {showTimer && (
                  <CountDownTimer
                    endDate={withdrawTimeStamp}
                    completeCB={() => {
                      setShowTimer(false);
                    }}
                  />
                )}
                <SubmitContainer>
                  <GotoWithdrawButton
                    style={{
                      background: theme.common.success,
                      text: theme.text.primary,
                    }}
                    onClick={() => setCancelTx(true)}
                  >
                    Cancel Withdraw
                  </GotoWithdrawButton>

                  {!showTimer && (
                    <GotoWithdrawButton
                      style={{
                        background: theme.common.success,
                        text: theme.text.primary,
                      }}
                      onClick={() => setApproveWithdraw(true)}
                    >
                      Withdraw Now
                    </GotoWithdrawButton>
                  )}
                </SubmitContainer>
              </div>
            </GridContainer>
          </InnerContainer>
        </WithdrawContainer>
      )}
    </Container>
  );
};
