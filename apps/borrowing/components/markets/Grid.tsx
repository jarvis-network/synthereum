import React, { FC } from 'react';
import { styled } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';
import MarketsRow from '@/components/markets/Row';
import { MarketsTitle } from '@/components/markets/Title';
import { MarketsManageModal } from '@/components/markets/ManageModal';
import { Market, SelfMintingMarketAssets } from '@/state/slices/markets';
import _ from 'lodash';
import { selfMintingMarketAssets } from '@/data/markets';

const Container = styled.div`
  width: 920px;
  margin: 0 auto;
`;
interface MarketsGridInnerProps {
  list: Partial<SelfMintingMarketAssets>;
  filterQuery: string | null;
  networkId: number;
}
const MarketsGridInner = React.memo(
  ({ list, filterQuery, networkId }: MarketsGridInnerProps) => {
    const filteredList = filterQuery
      ? Object.values(list).filter(
          i => selfMintingMarketAssets[i.pair].assetIn.name === filterQuery,
        )
      : Object.values(list);

    const openMarkets = filteredList.filter(
      i => i.positionCollateral !== '0',
    ) as Market[];

    const otherMarkets = filteredList.filter(
      i => i.positionCollateral === '0',
    ) as Market[];

    return (
      <Container>
        {networkId ? (
          <div>
            <MarketsRow
              key={`open-${Date.now()}`}
              title={
                <MarketsTitle
                  title="Open positions"
                  showFilters
                  markets={list}
                />
              }
              markets={openMarkets}
            />
            <MarketsManageModal />
          </div>
        ) : null}

        <div>
          <MarketsRow
            key={`all-${Date.now()}`}
            title={
              <MarketsTitle
                title="Other markets"
                showFilters={openMarkets.length === 0}
                markets={list}
              />
            }
            markets={otherMarkets}
          />
        </div>
      </Container>
    );
  },
);

interface MarketGridProps {
  markets: Partial<SelfMintingMarketAssets>;
  networkId: number;
}

export const MarketsGrid: FC<MarketGridProps> = React.memo(
  ({ markets, networkId }) => {
    const { list: loadedMarketList, filterQuery } = useReduxSelector(
      state => state.markets,
    );
    const list = _.isNull(networkId) ? markets : loadedMarketList;
    return (
      <MarketsGridInner
        list={list}
        networkId={networkId}
        filterQuery={filterQuery}
      />
    );
  },
);
