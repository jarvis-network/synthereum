import React from 'react';
import { styled } from '@jarvis-network/ui';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { selfMintingMarketAssets } from '@/data/markets';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-contracts/dist/config';

import { DateTime } from 'luxon';
import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';

import { SubmitContainer, SubmitButton } from './common';
import { TransactionParams } from './TransactionHolder';

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
  width: 300px;
  margin: 20px 0px;
`;
const Container = styled.div`
  width: 520px;
`;
export interface WithdrawHolderProps {
  assetInfo: Market;
  tabHandler: (input: number) => void;
}
export const WithdrawHolder: React.FC<WithdrawHolderProps> = ({
  children,
  assetInfo: asset,
  tabHandler,
}) => {
  const isRequestPending =
    asset!.positionWithdrawalRequestAmount!.toString() !== '0';
  const selectedAsset =
    selfMintingMarketAssets[asset!.pair as SupportedSelfMintingPairExact];
  const withdrawTimeStamp = DateTime.fromSeconds(
    asset!.positionWithdrawalRequestPassTimestamp!,
  ).toLocaleString(DateTime.DATETIME_MED);
  return (
    <div>
      {!isRequestPending ? (
        children
      ) : (
        <WithdrawContainer>
          <InnerContainer>
            <Container>
              <Title>You have Withdrawal Request Pending </Title>
              <SubTitle>
                It will Processed after: <span>{withdrawTimeStamp}</span>
              </SubTitle>
              <Note>
                You can cancel your withdrawal. Click Manage Withdrawals
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
              <SubmitContainer>
                <GotoWithdrawButton onClick={() => tabHandler(4)}>
                  Manage Withdrawals
                </GotoWithdrawButton>
              </SubmitContainer>
            </Container>
          </InnerContainer>
        </WithdrawContainer>
      )}
    </div>
  );
};
