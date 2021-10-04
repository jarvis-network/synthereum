import React, { ReactNode } from 'react';
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
  themeValue,
} from '@jarvis-network/ui';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { useMemo } from 'use-memo-one';

import {
  setChooseAsset,
  setPayAsset,
  setReceiveAsset,
  setPayAndReceiveAsset,
} from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { Asset, AssetWithWalletInfo } from '@/data/assets';
import { useAssets } from '@/utils/useAssets';

import { DEXValueFromContext } from '../DEXValue';

import { StyledSearchBar } from './StyledSearchBar';

const tabsList = [
  {
    title: 'ALL',
    filterValue: '',
  },
];

const wrapper = (children: ReactNode) =>
  children === '-.--' ? (
    <div className="dollars">Loading…</div>
  ) : (
    <div className="dollars">${children}</div>
  );

const grid = {
  columns: [
    {
      key: 'flag',
      type: ColumnType.CustomCell,
      cell: ({ original }: CellInfo) => (
        <Flag flag={(original as Asset).icon} />
      ),
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

        const stableValue =
          !o.synthetic && !o.collateral ? (
            <DEXValueFromContext
              asset={o}
              amount={o.ownedAmount}
              wrapper={wrapper}
            />
          ) : (
            o.stableCoinValue && (
              <div className="dollars">${o.stableCoinValue.format(2)}</div>
            )
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
`;

const ScrollableContents = styled.div`
  ${props => styledScrollbars(props.theme)}

  > span:first-child {
    margin-top: 8px;
  }
`;

export const ChooseAsset: React.FC = () => {
  const dispatch = useDispatch();
  const assets = useAssets();
  const { wallet, payAsset, receiveAsset, prices } = useReduxSelector(
    state => ({
      wallet: state.wallet,
      payAsset: state.exchange.payAsset,
      receiveAsset: state.exchange.receiveAsset,
      prices: state.prices,
    }),
  );
  const { list, assetPay, assetReceive } = useMemo(
    () => ({
      list: assets
        .filter(asset => !asset.wrappedNative)
        .map(
          (asset): AssetWithWalletInfo => {
            const ownedAmount = wallet[asset.symbol]?.amount || new FPN('0');

            const price = asset.collateral
              ? FPN.ONE
              : prices[asset.pair as string];

            return {
              ...asset,
              price,
              stableCoinValue: price ? ownedAmount.mul(price) : null,
              ownedAmount,
            };
          },
        ),
      assetPay: assets.find(a => a.symbol === payAsset),
      assetReceive: assets.find(a => a.symbol === receiveAsset),
    }),
    [assets, wallet, payAsset, receiveAsset, prices],
  );
  const asset = useReduxSelector(state => state.exchange.chooseAssetActive);
  const ownedAssets = useReduxSelector(state =>
    Object.entries(state.wallet)
      .filter(([_, value]) => value && value.amount.gt(new FPN('0')))
      .map(([symbol]) => symbol),
  );

  const onBack = () => dispatch(setChooseAsset(null));

  const tabs = {
    tabs: tabsList,
    selected: 0,
    filterProp: 'type',
  };

  const getTrProps = (_: any, rowInfo?: RowInfo) => ({
    onClick: () => {
      const selectedAsset = rowInfo!.original as Asset;
      if (
        asset === 'pay' &&
        !assetReceive!.synthetic &&
        !selectedAsset.synthetic
      ) {
        dispatch(
          setPayAndReceiveAsset({
            pay: selectedAsset.symbol,
            receive: assetPay!.symbol,
          }),
        );
      } else if (
        asset === 'receive' &&
        !assetPay!.synthetic &&
        !selectedAsset.synthetic
      ) {
        dispatch(
          setPayAndReceiveAsset({
            pay: assetReceive!.symbol,
            receive: selectedAsset.symbol,
          }),
        );
      } else {
        dispatch(
          asset === 'pay'
            ? setPayAsset(selectedAsset.symbol)
            : setReceiveAsset(selectedAsset.symbol),
        );
      }
      onBack();
    },
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
            <ScrollableContents>
              {ownedSection}
              {otherSection}
            </ScrollableContents>
          );
        }}
      />
    </>
  );
};
