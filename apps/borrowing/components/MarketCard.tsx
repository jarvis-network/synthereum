import React, { FC } from 'react';
import { styled, Button } from '@jarvis-network/ui';

import { FlagsPair } from '@/components/FlagsPair';
import { Market } from '@/state/slices/markets';

const Container = styled.div`
  background: ${props => props.theme.background.primary};
  box-shadow: ${props => props.theme.shadow.base};
  border-radius: 20px;
  width: 280px;
  height: 470px;
  position: relative;
`;

const Header = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${props => props.theme.sizes.row};
  font-size: ${props => props.theme.font.sizes.l};
  font-weight: 500;

  > * {
    margin: 0 10px;
  }
`;

const Footer = styled.div`
  height: ${props => props.theme.sizes.row};
  padding: 0 20px;
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
`;

const DataList = styled.div``;

const DataListItem = styled.div<{ label: string }>`
  border-bottom: 1px solid ${props => props.theme.border.primary};
  height: ${props => props.theme.sizes.row};
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:before {
    content: '${props => props.label}';
    color: ${props => props.theme.text.medium};
  }

  &:first-child {
    border-top: 1px solid ${props => props.theme.border.primary};
  }
`;

const ManageButton = styled(Button)`
  display: block;
  width: 100%;
  height: ${props => props.theme.sizes.row};
  border-radius: ${props => props.theme.borderRadius.s};
  background: ${props => props.theme.background.inverted};
  text-align: center;
  text-transform: uppercase;
  font-size: ${props => props.theme.font.sizes.l};
`;

interface MarketCardProps extends Market {
  onManageClick?: () => void;
}

export const MarketCard: FC<MarketCardProps> = ({
  assetIn,
  assetOut,
  collateralizationRatio,
  liquidationRatio,
  assetOutMinted,
  collateral,
  onManageClick,
}) => (
  <Container>
    <Header>
      <FlagsPair assets={[assetIn.icon, assetOut.icon]} /> {assetIn.name}-
      {assetOut.name}
    </Header>

    <DataList>
      <DataListItem label="Collateralization Ratio">
        {collateralizationRatio * 100}%
      </DataListItem>

      <DataListItem label="Liquidation Ratio">
        {liquidationRatio * 100}%
      </DataListItem>

      {collateral && (
        <DataListItem label="Your Collateral">{collateral * 100}%</DataListItem>
      )}

      {assetOutMinted && (
        <DataListItem label={`${assetOut.name} minted`}>
          {assetOutMinted}
        </DataListItem>
      )}
    </DataList>

    {onManageClick && (
      <Footer>
        <ManageButton onClick={onManageClick} size="l" type="dark">
          Manage
        </ManageButton>
      </Footer>
    )}
  </Container>
);
