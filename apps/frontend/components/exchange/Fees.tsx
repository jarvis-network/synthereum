import React from 'react';
import { styled, Tooltip } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { useExchangeValues } from '@/utils/useExchangeValues';
import { FEE } from '@/data/fee';
import { PRIMARY_STABLE_COIN } from '@/data/assets';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  heigth: auto;
  border-radius: ${props => props.theme.borderRadius.m};
  background: ${props => props.theme.background.primary};
  margin-top: 20px;
  padding: 15px;

  @media screen and (max-width: ${props => props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    background: ${props => props.theme.background.secondary};
    margin: 15px;
  }
`;

const Line = styled.div`
  padding: 8px 0;
  display: flex;
  font-size: ${props => props.theme.font.sizes.xxs};
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
  width: 6px;
  height: 6px;
  color: #80dfff;
  font-size: 6px;
  border-radius: 100px;
  border: 1px solid #80dfff;
  text-align: center;
  line-height: 6px;
  margin-left: 3px;

  &::before {
    content: '?';
  }
`;

const feeText =
  `A ${FEE.mul(new FPN(100)).format()}% protocol fee is taken on every` +
  ` transaction. The funds are after that evenly split between the Liquidity` +
  ` provider and the treasury`;

export const Fees: React.FC = () => {
  const { fee } = useExchangeValues();

  return (
    <Container>
      <Line>
        <Key>
          Protocol Fee
          <Tooltip tooltip={feeText} position="top">
            <QuestionMark />
          </Tooltip>
        </Key>
        <Value>
          {fee ? `${fee?.format(5)} ${PRIMARY_STABLE_COIN.symbol}` : '---'}
        </Value>
      </Line>
    </Container>
  );
};
