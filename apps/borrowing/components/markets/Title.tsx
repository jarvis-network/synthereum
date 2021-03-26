import { FC } from 'react';
import { styled } from '@jarvis-network/ui';

import { MarketsFilter } from '@/components/markets/Filters';

const Container = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: ${props => props.theme.sizes.row};
  border-bottom: 1px solid ${props => props.theme.border.primary};
`;

const Title = styled.div`
  font-size: ${props => props.theme.font.sizes.l};
  color: ${props => props.theme.text.primary};
`;

interface MarketsTitleProps {
  title: string;
  showFilters?: boolean;
}

export const MarketsTitle: FC<MarketsTitleProps> = ({ title, showFilters }) => (
  <Container>
    <Title>{title}</Title>

    {showFilters && <MarketsFilter />}
  </Container>
);
