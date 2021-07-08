import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { CellInfo } from 'react-table';
import type { RowInfo } from 'react-table';
import damlev from 'damlev';

import {
  ColumnType,
  DataGrid,
  Flag,
  noColorGrid,
  styled,
  styledScrollbars,
  Tabs,
  themeValue,
} from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { SupportedSynthereumSymbol } from '@jarvis-network/synthereum-ts/dist/config';

import {
  setChooseAsset,
  setPayAsset,
  setReceiveAsset,
} from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { Asset, AssetWithWalletInfo } from '@/data/assets';

import { StyledSearchBar } from './StyledSearchBar';

const tabsList = [
  {
    title: 'ALL',
    filterValue: '',
  },
  {
    title: 'Forex',
    filterValue: 'forex',
  },
  {
    title: 'Crypto',
    filterValue: 'crypto',
  },
  {
    title: 'Commodities',
    filterValue: 'commodities',
  },
];

const grid = {
  columns: [
    {
      key: 'flag',
      type: ColumnType.CustomCell,
      cell: ({ original }: CellInfo) => {
        const o = original as Asset;
        if (!o.icon) {
          return null;
        }
        return <Flag flag={o.icon} />;
      },
      className: 'flag',
    },
    {
      key: 'symbol',
      type: ColumnType.Text,
      className: 'asset',
    },
    {
      key: 'value',
      type: ColumnType.CustomCell,
      className: 'number',
      cell: ({ original }: CellInfo) => {
        const o = original as AssetWithWalletInfo;

        const stableValue = o.stableCoinValue && (
          <div className="dollars">$ {o.stableCoinValue.format(2)}</div>
        );
        return (
          <>
            <div className="value">{o.ownedAmount.format(5)}</div>
            {stableValue}
          </>
        );
      },
    },
  ],
};

const StyledTabs = styled(Tabs)`
  & > *:first-child {
    border-top: none;
    border-bottom: 1px solid ${props => props.theme.border.secondary};
    background: none;
    padding-left: 16px;
    box-sizing: border-box;
  }

  [role='button'] > div:first-child:not(.active) {
    color: ${themeValue(
      {
        light: theme => theme.text.secondary,
      },
      theme => theme.text.medium,
    )};
  }
`;

const StyledHeader = styled.span`
  padding-left: 24px;
  margin-top: 24px;
  margin-bottom: 10px;
  display: block;
  font-size: ${props => props.theme.font.sizes.m};
`;

const StyledGrid = styled(DataGrid)`
  .text,
  .asset,
  .flag {
    text-align: left;
    padding: 8px 16px !important;
  }

  .number {
    text-align: right;
    padding: 8px 16px !important;
  }

  .asset,
  .number .value {
    color: ${props => props.theme.text.primary};
    font-size: ${props => props.theme.font.sizes.m};
  }

  .flag {
    flex-grow: 0 !important;
    width: auto !important;
    padding-right: 0 !important;

    img {
      width: 24px;
      height: 24px;
    }
  }

  .rt-tbody {
    .rt-tr-group:first-child {
      border-top: none !important;
    }

    .rt-tr-group {
      border-color: ${props => props.theme.border.secondary}!important;
    }
  }

  .rt-table {
    overflow: hidden;
    .rt-tr {
      align-items: center;
    }
  }

  .dollars {
    color: ${themeValue(
      {
        light: theme => theme.text.secondary,
      },
      theme => theme.text.medium,
    )};
  }

  ${noColorGrid()}
`;

const ScrollableSearchBar = styled(StyledSearchBar)`
  display: flex;
  flex-direction: column;
  height: 100%;

  > :nth-child(2) > :first-child {
    padding-left: 0;

    [role='button'] {
      div {
        font-weight: 300;
        font-size: 13px;

        :empty {
          display: none;
        }
      }
    }
  }
`;

const ComingSoon = styled.img`
  margin: 2em;
`;

const ScrollableContents = styled.div`
  ${props => styledScrollbars(props.theme)}
  height: calc(100% - 150px);
`;

const ScrollableTabs = styled(StyledTabs)`
  height: auto;
`;

export const ChooseAsset: React.FC = () => {
  const dispatch = useDispatch();
  const list = useReduxSelector(state =>
    state.assets.list.map(
      (asset): AssetWithWalletInfo => {
        const ownedAmount = state.wallet[asset.symbol]?.amount || new FPN('0');

        return {
          ...asset,
          stableCoinValue: asset.price ? ownedAmount.mul(asset.price) : null,
          ownedAmount,
        };
      },
    ),
  );
  const asset = useReduxSelector(state => state.exchange.chooseAssetActive);
  const ownedAssets = useReduxSelector(state =>
    Object.entries(state.wallet)
      .filter(([_, value]) => value && value.amount.gt(new FPN('0')))
      .map(([symbol]) => symbol),
  );

  const [selected, setSelected] = useState(0);

  const onBack = () => dispatch(setChooseAsset(null));

  const handleSelected = (symbol: SupportedSynthereumSymbol) => {
    dispatch(asset === 'pay' ? setPayAsset(symbol) : setReceiveAsset(symbol));
    onBack();
  };

  const tabs = {
    tabs: tabsList,
    selected,
    filterProp: 'type',
  };

  const getTrProps = (_: any, rowInfo?: RowInfo) => ({
    onClick: () =>
      handleSelected(rowInfo!.original.symbol as SupportedSynthereumSymbol),
    style: {
      cursor: 'pointer',
    },
  });

  return (
    <>
      <ScrollableSearchBar
        tabs={tabs}
        data={list}
        queryFilterProp="symbol"
        placeholder={'Try "jEUR"'}
        autoFocus
        filter={(
          data: AssetWithWalletInfo[],
          { query: rawQuery }: { query: string },
        ) => {
          const query = rawQuery.toLowerCase();

          return data.filter(item => {
            const symbol = item.symbol.toLowerCase();

            return symbol.includes(query) || damlev(query, symbol) < 3;
          });
        }}
        render={data => {
          const owned = data.filteredData.filter(row =>
            ownedAssets.includes(row.symbol),
          );
          const other = data.filteredData.filter(
            row => !ownedAssets.includes(row.symbol),
          );

          const comingSoon = !owned.length && !other.length && selected > 1 && (
            <ComingSoon src="/images/coming-soon.svg" />
          );

          const ownedSection = owned.length ? (
            <>
              <StyledHeader>You have</StyledHeader>
              <StyledGrid
                columns={grid.columns}
                data={owned}
                showPagination={false}
                getTrProps={getTrProps}
                pageSize={owned.length}
              />
            </>
          ) : null;

          const otherSection = other.length ? (
            <>
              <StyledHeader>Others</StyledHeader>
              <StyledGrid
                columns={grid.columns}
                data={other}
                showPagination={false}
                getTrProps={getTrProps}
                pageSize={other.length}
              />
            </>
          ) : null;

          return (
            <>
              <ScrollableTabs
                tabs={tabsList}
                selected={selected}
                onChange={setSelected}
              />
              <ScrollableContents>
                {ownedSection}
                {otherSection}
                {comingSoon}
              </ScrollableContents>
            </>
          );
        }}
      />
    </>
  );
};
