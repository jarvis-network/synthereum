import React from 'react';
import { styled, Tooltip } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

import { useExchangeValues } from '@/utils/useExchangeValues';
import { FEE } from '@/data/fee';
import { PRIMARY_STABLE_COIN } from '@/data/assets';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  heigth: auto;
  border-radius: ${props => props.theme.borderRadius.m};
  background: ${props => props.theme.background.primary};
  padding: 15px;
`;

const Line = styled.div`
  padding: 7px 0;
  display: flex;
  font-size: ${props => props.theme.font.sizes.s};
  justify-content: space-between;
  align-items: center;

  :first-child {
    padding-top: 0;
  }

  :last-child {
    padding-bottom: 0;
  }
`;
const Key = styled.div``;
const Value = styled.div`
  text-align: right;
`;

const QuestionMark = styled.span`
  display: inline-block;
  width: ${props => props.theme.font.sizes.xxs};
  height: ${props => props.theme.font.sizes.xxs};
  color: #80dfff;
  font-size: ${props => props.theme.font.sizes.xxs};
  border-radius: 200px;
  border: 1px solid #80dfff;
  text-align: center;
  line-height: ${props => props.theme.font.sizes.xxs};
  margin-left: 3px;
  transform: translateY(-2px);

  &::before {
    content: '?';
  }
`;

const liquidityProviderFeeText = `A ${FEE.div(new FPN(2))
  .mul(new FPN(100))
  .format()}% liquidity provider fee is collected and send to the Liquidity Provider`;

const treasuryFeeText = `A ${FEE.div(new FPN(2))
  .mul(new FPN(100))
  .format()}% treasury fee is collected and is sent to the treasury, in the future to the DAO.`;

export const FEES_BLOCK_HEIGHT_PX = 100;

export const Fees: React.FC = () => {
  const { fee } = useExchangeValues();

  const feeItem = fee?.div(new FPN(2)) || null;

  return (
    <Container>
      <Line>
        <Key>
          Liquidity Provider fee
          <Tooltip tooltip={liquidityProviderFeeText} position="top">
            <QuestionMark />
          </Tooltip>
        </Key>
        <Value>
          {feeItem
            ? `${feeItem?.format(5)} ${PRIMARY_STABLE_COIN.symbol}`
            : '---'}
        </Value>
      </Line>
      <Line>
        <Key>
          Treasury Fee
          <Tooltip tooltip={treasuryFeeText} position="top">
            <QuestionMark />
          </Tooltip>
        </Key>
        <Value>
          {feeItem
            ? `${feeItem?.format(5)} ${PRIMARY_STABLE_COIN.symbol}`
            : '---'}
        </Value>
      </Line>
    </Container>
  );
};
