import React, { FC } from 'react';
import { styled, Flag } from '@jarvis-network/ui';
import { FlagKeys } from '@jarvis-network/ui/dist/Flag/files';

import { formatTokenPrice } from '@/utils/format';

export interface AssetRowProps {
  flag: FlagKeys | null;
  title: string;
  amount: number;
  value: number;
}

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  margin: 0 -24px;

  :not(:last-child) {
    border-bottom: 1px solid ${props => props.theme.border.primary};
  }
`;

const Information = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;

const Title = styled.div`
  color: ${props => props.theme.text.primary};
  margin-left: 24px;
`;

const Details = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
`;

const Amount = styled.div`
  color: ${props => props.theme.text.primary};
  padding: 3px 0;
`;

const Value = styled(Amount)`
  color: ${props => props.theme.text.secondary};
`;

export const AssetRow: FC<AssetRowProps> = ({ flag, title, amount, value }) => (
  <Container>
    <Information>
      {flag && <Flag flag={flag} />}
      <Title>{title}</Title>
    </Information>
    <Details>
      <Amount>{amount}</Amount>
      <Value>{formatTokenPrice(value)}</Value>
    </Details>
  </Container>
);
