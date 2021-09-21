import React from 'react';
import { styled, useTheme } from '@jarvis-network/ui';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { selfMintingMarketAssets } from '@/data/markets';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';

import { DateTime } from 'luxon';
import { Market } from '@jarvis-network/synthereum-ts/dist/epics/markets';

import { SubmitContainer, SubmitButton } from '../common';
import { TransactionParams } from '../transaction/TransactionParams';

import {
  InnerContainer,
  Note,
  SubTitle,
  Title,
  WithdrawContainer,
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

export interface WithdrawHolderProps {
  assetInfo: Market;
  tabHandler: (input: number) => void;
}
export const WithdrawHolder: React.FC<WithdrawHolderProps> = ({
  children,
  assetInfo: asset,
  tabHandler,
}) => {
  const theme = useTheme();

  const isRequestPending =
    asset!.positionWithdrawalRequestAmount!.toString() !== '0';
  const selectedAsset =
    selfMintingMarketAssets[asset!.pair as SupportedSelfMintingPairExact];
  const withdrawTimeStamp = DateTime.fromSeconds(
    asset!.positionWithdrawalRequestPassTimestamp!,
  ).toLocaleString(DateTime.DATETIME_MED);
  return (
    <Container>
      {!isRequestPending ? (
        children
      ) : (
        <WithdrawContainer>
          <InnerContainer>
            <GridContainer>
              <div>
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
              </div>

              <SubmitContainer>
                <SubmitButton
                  style={{
                    background: theme.common.success,
                    text: theme.text.primary,
                  }}
                  onClick={() => tabHandler(4)}
                >
                  Manage Withdrawals
                </SubmitButton>
              </SubmitContainer>
            </GridContainer>
          </InnerContainer>
        </WithdrawContainer>
      )}
    </Container>
  );
};
