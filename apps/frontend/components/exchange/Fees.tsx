import React from 'react';
import { styled, Tooltip, themeValue } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { useExchangeValues } from '@/utils/useExchangeValues';
import { FEE } from '@/data/fee';
import { PRIMARY_STABLE_COIN } from '@/data/assets';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  margin-top: 5px;
  justify-content: flex-end;
`;

const Line = styled.div`
  background: ${themeValue(
    { dark: '#272727', night: '#29303c' },
    theme => theme.border.secondary,
  )};
  padding: 5px 30px;
  display: flex;
  font-size: 10px;
  justify-content: space-between;
  align-items: center;
  min-height: 24px;
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
  ` provider and the Jarvis DAO`;

export const Fees: React.FC = props => {
  const { paySymbol, fee } = useExchangeValues();

  return (
    <Container>
      <Line>
        <Key>
          Protocol Fee
          <Tooltip tooltip={feeText}>
            <QuestionMark />
          </Tooltip>
        </Key>
        <Value>
          {fee?.format(5)} {PRIMARY_STABLE_COIN.symbol}
        </Value>
      </Line>
    </Container>
  );
};
