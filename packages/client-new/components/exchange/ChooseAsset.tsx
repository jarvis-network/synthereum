import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { CellInfo } from 'react-table';
import { ColumnType, DataGrid, Flag, styled, Tabs } from '@jarvis-network/ui';

import { StyledCard } from '@/components/exchange/StyledCard';
import { Asset, AssetWithWalletInfo } from '@/data/assets';
import { setPayAsset, setReceiveAsset } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';

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
            <div className="value">{o.ownedAmount}</div>
            <div className="dollars">{o.stableCoinValue} $</div>
          </>
        );
      },
    },
  ],
};

const StyledTabs = styled(Tabs)`
  & > *:first-child {
    border-top: 1px solid ${props => props.theme.border.primary};
    border-bottom: 1px solid ${props => props.theme.border.primary};
    padding-left: 30px;
    box-sizing: border-box;
  }
`;

const StyledHeader = styled.b`
  padding-left: 30px;
  margin-top: 50px;
  display: block;
  font-size: 10px;
`;

const StyledGrid = styled(DataGrid)`
  .text,
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
    width: 32px !important;
  }

  .rt-tbody {
    .rt-tr-group:first-child {
      border-top: none !important;
    }
  }
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

const ScrollableContents = styled.div`
  overflow: auto;
`;

const ScrollableTabs = styled(StyledTabs)`
  height: auto;
`;

export const ChooseAsset: React.FC<Props> = ({ onBack }) => {
  const dispatch = useDispatch();
  const list = useReduxSelector(state => {
    return state.assets.list.map(
      (asset): AssetWithWalletInfo => {
        const ownedAmount = state.wallet[asset.symbol]?.amount || 0;

        return {
          ...asset,
          stableCoinValue: ownedAmount * asset.price,
          ownedAmount,
        };
      },
    );
  });
  const asset = useReduxSelector(state => state.exchange.chooseAssetActive);
  const ownedAssets = useReduxSelector(state => {
    return Object.entries(state.wallet)
      .filter(([key, value]) => {
        return value.amount > 0;
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

  const getTrProps = (state, rowInfo) => ({
    onClick: () => handleSelected(rowInfo.original.symbol),
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
        render={data => {
          const owned = data.filteredData.filter(row =>
            ownedAssets.includes(row.symbol),
          );
          const other = data.filteredData.filter(
            row => !ownedAssets.includes(row.symbol),
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
              </ScrollableContents>
            </>
          );
        }}
      />
    </ScrollableCard>
  );
};
