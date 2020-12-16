import React, { FC } from 'react';
import { styled, Flag } from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { Asset, PRIMARY_STABLE_COIN } from '@/data/assets';

export interface AssetRowProps {
  asset: Asset;
  amount: FPN;
  value: FPN | null;
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

export const AssetRow: FC<AssetRowProps> = ({ asset, amount, value }) => {
  const valueElem = value && (
    <Value>
      {value.format(2)} {PRIMARY_STABLE_COIN.symbol}
    </Value>
  );

  return (
    <Container>
      <Information>
        {asset.icon && <Flag flag={asset.icon} />}
        <Title>{asset.symbol}</Title>
      </Information>
      <Details>
        <Amount>{amount.format(2)}</Amount>
        {valueElem}
      </Details>
    </Container>
  );
};
