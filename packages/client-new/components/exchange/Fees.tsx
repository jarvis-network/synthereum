import React, { useState } from 'react';
import { styled, Tooltip, Switcher, themeValue } from '@jarvis-network/ui';

const Container = styled.div`
  flex: 1;
  background: ${themeValue(
    { dark: '#272727', night: '#29303c' },
    theme => theme.border.secondary,
  )};
  margin-top: 5px;
  padding: 0 30px;
`;

const Line = styled.div`
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

const speedItems = ['Normal', 'Fast', 'Instant'];

const slippageText = 'lorem ipsum';

export const Fees: React.FC = props => {
  const [selected, setSelected] = useState(0);

  return (
    <Container>
      <Line>
        <Key>
          Slippage
          <Tooltip tooltip={slippageText}>
            <QuestionMark />
          </Tooltip>
        </Key>
        <Value>0%</Value>
      </Line>
      <Line>
        <Key>Fee</Key>
        <Value>0.003 USDC</Value>
      </Line>
      <Line>
        <Key>Network fee</Key>
        <Value>0.03 ETH</Value>
      </Line>
      <Line>
        <Key>Transaction speed</Key>
        <Switcher
          items={speedItems}
          onChange={value => setSelected(speedItems.indexOf(value))}
          selected={selected}
        />
      </Line>
    </Container>
  );
};
