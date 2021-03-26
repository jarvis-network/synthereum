import { FC, ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { styled } from '@jarvis-network/ui';

import { Market, setMarketsManageKey } from '@/state/slices/markets';
import { MarketCard } from '@/components/MarketCard';

const Container = styled.div`
  width: 100%;
  margin-bottom: 60px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Title = styled.div`
  margin-bottom: 30px;
`;

const Items = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: 280px 280px 280px;
  column-gap: 40px;
  row-gap: 40px;
`;

interface MarketsRowProps {
  title: ReactNode;
  markets: Market[];
}

export const MarketsRow: FC<MarketsRowProps> = ({ title, markets }) => {
  const dispatch = useDispatch();

  if (!markets.length) {
    return null;
  }

  const handleManageClick = (key: string) => dispatch(setMarketsManageKey(key));

  return (
    <Container>
      <Title>{title}</Title>
      <Items>
        {markets.map(i => (
          <MarketCard {...i} onManageClick={() => handleManageClick(i.key)} />
        ))}
      </Items>
    </Container>
  );
};
