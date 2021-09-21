import React, { FC, useEffect, useState } from 'react';
import { styled } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';
import MarketsRow from '@/components/markets/Row';
import { MarketsTitle } from '@/components/markets/Title';
import { MarketsManageModal } from '@/components/markets/ManageModal';
import { Market, SelfMintingMarketAssets } from '@/state/slices/markets';
import _ from 'lodash';
import { selfMintingMarketAssets } from '@/data/markets';
import ContentLoader from 'react-content-loader';

const Container = styled.div`
  width: 920px;
  margin: 0 auto;
`;
const CardPlaceHolder = styled(ContentLoader)`
  border: 1px solid #eaeaea;
  background: #efefef;
  border-radius: 20px;
`;
const LoaderGrid = styled.div`
  display: grid;
  grid-template-columns: 280px 280px 280px;
  gap: 40px;
  margin-top: 90px;
`;
interface MarketsGridInnerProps {
  list: Partial<SelfMintingMarketAssets>;
  filterQuery: string | null;
}

const MarketsGridInner = React.memo(
  ({ list, filterQuery }: MarketsGridInnerProps) => {
    const auth = useReduxSelector(state => state.auth);

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
        {auth ? (
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
}

export const MarketsGrid: FC<MarketGridProps> = React.memo(({ markets }) => {
  const { list: loadedMarketList, filterQuery } = useReduxSelector(
    state => state.markets,
  );
  const isWindowLoaded = useReduxSelector(state => state.app.isWindowLoaded);
  const auth = useReduxSelector(state => state.auth?.address);
  const [show, setShow] = useState(false);
  const list = _.isEmpty(loadedMarketList) ? markets : loadedMarketList;

  useEffect(() => {
    if (!_.isEmpty(loadedMarketList)) {
      setShow(true);
    }
    if (_.isEmpty(loadedMarketList) && _.isEmpty(auth) && isWindowLoaded) {
      setShow(true);
    }
    if (_.isEmpty(loadedMarketList) && !_.isEmpty(auth)) {
      setShow(false);
    }
  }, [loadedMarketList, auth, isWindowLoaded]);
  return (
    <div>
      {show ? (
        <MarketsGridInner list={list} filterQuery={filterQuery} />
      ) : (
        <LoaderGrid>
          <CardPlaceHolder
            speed={2}
            width={280}
            height={470}
            viewBox="0 0 280 470"
            backgroundColor="#f3f3f3"
            foregroundColor="#ecebeb"
          >
            <circle cx="90" cy="29" r="11" />
            <circle cx="106" cy="29" r="11" />
            <path d="M 127.42 17.58 h 86.46 v 22.75 h -86.46 z M 209.66 83.84 h 49.89 v 11.2 h -49.89 z M 22.24 83.84 h 161.31 v 11.2 H 22.24 z M 209.66 142.24 h 49.89 v 11.2 h -49.89 z M 22.24 142.24 h 161.31 v 11.2 H 22.24 z M 210.77 200.65 h 49.89 v 11.2 h -49.89 z M 23.35 200.65 h 161.31 v 11.2 H 23.35 z" />
            <path d="M -0.25 59.45 h 280 M 0 118.64 h 280" />
            <path d="M 250.06 448.54 H 31.43 c -5.75 0 -10.41 -4.66 -10.41 -10.41 v -38.41 c 0 -5.75 4.66 -10.41 10.41 -10.41 h 218.62 c 5.75 0 10.41 4.66 10.41 10.41 v 38.41 c 0 5.75 -4.66 10.41 -10.4 10.41 z" />
          </CardPlaceHolder>
          <CardPlaceHolder
            speed={2}
            width={280}
            height={470}
            viewBox="0 0 280 470"
            backgroundColor="#f3f3f3"
            foregroundColor="#ecebeb"
          >
            <circle cx="90" cy="29" r="11" />
            <circle cx="106" cy="29" r="11" />
            <path d="M 127.42 17.58 h 86.46 v 22.75 h -86.46 z M 209.66 83.84 h 49.89 v 11.2 h -49.89 z M 22.24 83.84 h 161.31 v 11.2 H 22.24 z M 209.66 142.24 h 49.89 v 11.2 h -49.89 z M 22.24 142.24 h 161.31 v 11.2 H 22.24 z M 210.77 200.65 h 49.89 v 11.2 h -49.89 z M 23.35 200.65 h 161.31 v 11.2 H 23.35 z" />
            <path d="M -0.25 59.45 h 280 M 0 118.64 h 280" />
            <path d="M 250.06 448.54 H 31.43 c -5.75 0 -10.41 -4.66 -10.41 -10.41 v -38.41 c 0 -5.75 4.66 -10.41 10.41 -10.41 h 218.62 c 5.75 0 10.41 4.66 10.41 10.41 v 38.41 c 0 5.75 -4.66 10.41 -10.4 10.41 z" />
          </CardPlaceHolder>
          <CardPlaceHolder
            speed={2}
            width={280}
            height={470}
            viewBox="0 0 280 470"
            backgroundColor="#f3f3f3"
            foregroundColor="#ecebeb"
          >
            <circle cx="90" cy="29" r="11" />
            <circle cx="106" cy="29" r="11" />
            <path d="M 127.42 17.58 h 86.46 v 22.75 h -86.46 z M 209.66 83.84 h 49.89 v 11.2 h -49.89 z M 22.24 83.84 h 161.31 v 11.2 H 22.24 z M 209.66 142.24 h 49.89 v 11.2 h -49.89 z M 22.24 142.24 h 161.31 v 11.2 H 22.24 z M 210.77 200.65 h 49.89 v 11.2 h -49.89 z M 23.35 200.65 h 161.31 v 11.2 H 23.35 z" />
            <path d="M -0.25 59.45 h 280 M 0 118.64 h 280" />
            <path d="M 250.06 448.54 H 31.43 c -5.75 0 -10.41 -4.66 -10.41 -10.41 v -38.41 c 0 -5.75 4.66 -10.41 10.41 -10.41 h 218.62 c 5.75 0 10.41 4.66 10.41 10.41 v 38.41 c 0 5.75 -4.66 10.41 -10.4 10.41 z" />
          </CardPlaceHolder>
          <CardPlaceHolder
            speed={2}
            width={280}
            height={470}
            viewBox="0 0 280 470"
            backgroundColor="#f3f3f3"
            foregroundColor="#ecebeb"
          >
            <circle cx="90" cy="29" r="11" />
            <circle cx="106" cy="29" r="11" />
            <path d="M 127.42 17.58 h 86.46 v 22.75 h -86.46 z M 209.66 83.84 h 49.89 v 11.2 h -49.89 z M 22.24 83.84 h 161.31 v 11.2 H 22.24 z M 209.66 142.24 h 49.89 v 11.2 h -49.89 z M 22.24 142.24 h 161.31 v 11.2 H 22.24 z M 210.77 200.65 h 49.89 v 11.2 h -49.89 z M 23.35 200.65 h 161.31 v 11.2 H 23.35 z" />
            <path d="M -0.25 59.45 h 280 M 0 118.64 h 280" />
            <path d="M 250.06 448.54 H 31.43 c -5.75 0 -10.41 -4.66 -10.41 -10.41 v -38.41 c 0 -5.75 4.66 -10.41 10.41 -10.41 h 218.62 c 5.75 0 10.41 4.66 10.41 10.41 v 38.41 c 0 5.75 -4.66 10.41 -10.4 10.41 z" />
          </CardPlaceHolder>
          <CardPlaceHolder
            speed={2}
            width={280}
            height={470}
            viewBox="0 0 280 470"
            backgroundColor="#f3f3f3"
            foregroundColor="#ecebeb"
          >
            <circle cx="90" cy="29" r="11" />
            <circle cx="106" cy="29" r="11" />
            <path d="M 127.42 17.58 h 86.46 v 22.75 h -86.46 z M 209.66 83.84 h 49.89 v 11.2 h -49.89 z M 22.24 83.84 h 161.31 v 11.2 H 22.24 z M 209.66 142.24 h 49.89 v 11.2 h -49.89 z M 22.24 142.24 h 161.31 v 11.2 H 22.24 z M 210.77 200.65 h 49.89 v 11.2 h -49.89 z M 23.35 200.65 h 161.31 v 11.2 H 23.35 z" />
            <path d="M -0.25 59.45 h 280 M 0 118.64 h 280" />
            <path d="M 250.06 448.54 H 31.43 c -5.75 0 -10.41 -4.66 -10.41 -10.41 v -38.41 c 0 -5.75 4.66 -10.41 10.41 -10.41 h 218.62 c 5.75 0 10.41 4.66 10.41 10.41 v 38.41 c 0 5.75 -4.66 10.41 -10.4 10.41 z" />
          </CardPlaceHolder>
          <CardPlaceHolder
            speed={2}
            width={280}
            height={470}
            viewBox="0 0 280 470"
            backgroundColor="#f3f3f3"
            foregroundColor="#ecebeb"
          >
            <circle cx="90" cy="29" r="11" />
            <circle cx="106" cy="29" r="11" />
            <path d="M 127.42 17.58 h 86.46 v 22.75 h -86.46 z M 209.66 83.84 h 49.89 v 11.2 h -49.89 z M 22.24 83.84 h 161.31 v 11.2 H 22.24 z M 209.66 142.24 h 49.89 v 11.2 h -49.89 z M 22.24 142.24 h 161.31 v 11.2 H 22.24 z M 210.77 200.65 h 49.89 v 11.2 h -49.89 z M 23.35 200.65 h 161.31 v 11.2 H 23.35 z" />
            <path d="M -0.25 59.45 h 280 M 0 118.64 h 280" />
            <path d="M 250.06 448.54 H 31.43 c -5.75 0 -10.41 -4.66 -10.41 -10.41 v -38.41 c 0 -5.75 4.66 -10.41 10.41 -10.41 h 218.62 c 5.75 0 10.41 4.66 10.41 10.41 v 38.41 c 0 5.75 -4.66 10.41 -10.4 10.41 z" />
          </CardPlaceHolder>
        </LoaderGrid>
      )}
    </div>
  );
});
