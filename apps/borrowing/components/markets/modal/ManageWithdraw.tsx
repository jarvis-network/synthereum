import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';
import React, { useState } from 'react';
import { styled } from '@jarvis-network/ui';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { selfMintingMarketAssets } from '@/data/markets';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';

import { DateTime } from 'luxon';
import CountDownTimer from '@/components/countdown/Countdown';
import { useDispatch } from 'react-redux';

import { SubmitContainer, SubmitButton } from './common';
import TransactionHolder from './transaction/TransactionHolder';
import { TransactionParams } from './transaction/TransactionParams';

const WithdrawContainer = styled.div`
  overflow: hidden;
`;

const InnerContainer = styled.div`
  display: flex;
  width: 100%;
  position: relative;
  flex-direction: row;
`;

const Title = styled.div`
  text-align: center;
  font-size: 18px;
  margin: 20px 0px;
`;

const Note = styled.div`
  text-align: center;
  font-size: 12px;
`;

const SubTitle = styled.div`
  text-align: center;
  font-size: 12px;
  margin-bottom: 10px;
  > span {
    font-size: 14px;
    font-weight: bold;
  }
`;

const GotoWithdrawButton = styled(SubmitButton)`
  width: 200px;
  font-size: 16px;
  margin: 20px 10px;
`;
const Container = styled.div`
  width: 520px;
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
  const [approveWithdraw, setApproveWithdraw] = useState(false);
  const handleGoBack = () => {
    setCancelTx(false);
    setApproveWithdraw(false);
  };
  return (
    <div>
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
                icon: selectedAsset.assetIn.icon!,
              },
              value: FPN.fromWei(
                asset!.positionWithdrawalRequestAmount!,
              ).format(2),
            },
          ]}
          confirmHandler={() => {
            dispatch({
              type: 'CANCEL_WITHDRAW',
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
                icon: selectedAsset.assetIn.icon!,
              },
              value: FPN.fromWei(
                asset!.positionWithdrawalRequestAmount!,
              ).format(2),
            },
          ]}
          confirmHandler={() => {
            dispatch({
              type: 'APPROVE_WITHDRAW',
              payload: {
                pair: asset!.pair,
              },
            });
          }}
        />
      ) : (
        <WithdrawContainer>
          <InnerContainer>
            <Container>
              <Title>You have Withdrawal Request Pending </Title>
              <SubTitle>
                It will Processed after:{' '}
                <span>
                  {withdrawTimeStamp.toLocaleString(DateTime.DATETIME_MED)}
                </span>
              </SubTitle>
              <Note>
                You need to can click <span>Withdraw Now</span> to receive funds
              </Note>
              <TransactionParams
                params={[
                  {
                    title: 'Withdraw',
                    asset: {
                      name: selectedAsset.assetIn.name,
                      icon: selectedAsset.assetIn.icon!,
                    },
                    value: FPN.fromWei(
                      asset!.positionWithdrawalRequestAmount!,
                    ).format(2),
                  },
                ]}
              />
              {showTimer && (
                <CountDownTimer
                  endDate={withdrawTimeStamp}
                  completeCB={() => {
                    setShowTimer(false);
                  }}
                />
              )}
              <SubmitContainer>
                <GotoWithdrawButton onClick={() => setCancelTx(true)}>
                  Cancel Withdraw
                </GotoWithdrawButton>

                {!showTimer && (
                  <GotoWithdrawButton onClick={() => setApproveWithdraw(true)}>
                    Withdraw Now
                  </GotoWithdrawButton>
                )}
              </SubmitContainer>
            </Container>
          </InnerContainer>
        </WithdrawContainer>
      )}
    </div>
  );
};
