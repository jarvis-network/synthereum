import { FC } from 'react';
import { styled } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';
import { MarketsRow } from '@/components/markets/Row';
import { MarketsTitle } from '@/components/markets/Title';
import { MarketsManageModal } from '@/components/markets/ManageModal';

const Container = styled.div`
  width: 920px;
  margin: 0 auto;
`;

export const MarketsGrid: FC = () => {
  const { list, filterQuery } = useReduxSelector(state => state.markets);

  const filteredList = filterQuery
    ? list.filter(i => i.assetIn.name === filterQuery)
    : list;
  const openMarkets = filteredList.filter(
    i => i.collateral && i.assetOutMinted,
  );
  const openMarketsKeys = openMarkets.map(i => i.key);
  const otherMarkets = filteredList.filter(
    i => !openMarketsKeys.includes(i.key),
  );

  return (
    <Container>
      <MarketsRow
        title={<MarketsTitle title="Open positions" showFilters />}
        markets={openMarkets}
      />
      <MarketsRow
        title={<MarketsTitle title="Other markets" />}
        markets={otherMarkets}
      />
      <MarketsManageModal />
    </Container>
  );
};
