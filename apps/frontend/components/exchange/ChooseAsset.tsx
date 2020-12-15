import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { CellInfo } from 'react-table';
import {
  ColumnType,
  DataGrid,
  Flag,
  styled,
  Tabs,
  themeValue,
} from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { StyledCard } from '@/components/exchange/StyledCard';
import { Asset, AssetWithWalletInfo } from '@/data/assets';
import { setPayAsset, setReceiveAsset } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';

import { noColorGrid, styledScrollbars } from '@/utils/styleMixins';

import type { RowInfo } from 'react-table';

import { StyledSearchBar } from './StyledSearchBar';

interface Props {
  onBack: () => void;
}

const tabsList = [
  {
    title: 'All',
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
        return (
          <>
            <div className="value">{o.ownedAmount.format(5)}</div>
            <div className="dollars">$ {o.stableCoinValue.format(2)}</div>
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
    padding-left: 30px;
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

const StyledHeader = styled.b`
  padding-left: 30px;
  margin-top: 30px;
  margin-bottom: 10px;
  display: block;
  font-size: 10px;
`;

const StyledGrid = styled(DataGrid)`
  .text,
  .asset,
  .flag {
    text-align: left;
  }

  .asset,
  .number .value {
    font-size: 12px;
    color: ${props => props.theme.text.primary};
  }

  .number {
    text-align: right;
    padding-right: 30px !important;
  }

  .flag {
    padding-left: 30px !important;
    flex-grow: 0 !important;
    width: auto !important;
    padding-right: 0 !important;
  }

  .asset {
    padding: 0 0 4px 30px !important;
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

const ScrollableCard = styled(StyledCard)`
  .box {
    height: 100%;
  }
`;

const ScrollableSearchBar = styled(StyledSearchBar)`
  display: flex;
  flex-direction: column;
  height: calc(100% - 51px);

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

const ComingSoon = styled.div`
  text-align: center;
  margin-top: 1em;
  font-weight: 500;
`;

const ScrollableContents = styled.div`
  ${props => styledScrollbars(props.theme)}
`;

const ScrollableTabs = styled(StyledTabs)`
  height: auto;
`;

export const ChooseAsset: React.FC<Props> = ({ onBack }) => {
  const dispatch = useDispatch();
  const list = useReduxSelector(state => {
    return state.assets.list.map(
      (asset): AssetWithWalletInfo => {
        const ownedAmount = state.wallet[asset.symbol]?.amount || new FPN('0');

        return {
          ...asset,
          stableCoinValue: ownedAmount.mul(asset.price),
          ownedAmount,
        };
      },
    );
  });
  const asset = useReduxSelector(state => state.exchange.chooseAssetActive);
  const ownedAssets = useReduxSelector(state => {
    return Object.entries(state.wallet)
      .filter(([key, value]) => {
        return value.amount.gt(new FPN('0'));
      })
      .map(([symbol]) => symbol);
  });

  const [selected, setSelected] = useState(0);

  const handleSelected = (symbol: string) => {
    dispatch(asset === 'pay' ? setPayAsset(symbol) : setReceiveAsset(symbol));
    onBack();
  };

  const tabs = {
    tabs: tabsList,
    selected,
    filterProp: 'type',
  };

  const getTrProps = (_: any, rowInfo?: RowInfo) => ({
    onClick: () => handleSelected(rowInfo!.original.symbol),
    style: {
      cursor: 'pointer',
    },
  });

  return (
    <ScrollableCard mode="back" title="Choose an asset" onBack={onBack}>
      <ScrollableSearchBar
        tabs={tabs}
        data={list}
        queryFilterProp="symbol"
        placeholder={'Try "jEUR"'}
        autoFocus
        render={data => {
          const owned = data.filteredData.filter(row =>
            ownedAssets.includes(row.symbol),
          );
          const other = data.filteredData.filter(
            row => !ownedAssets.includes(row.symbol),
          );

          const comingSoon = !owned.length &&
            !other.length &&
            selected === 2 && <ComingSoon>Coming soon!</ComingSoon>;

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
    </ScrollableCard>
  );
};
