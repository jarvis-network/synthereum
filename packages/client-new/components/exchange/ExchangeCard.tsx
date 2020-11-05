import React, { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CellInfo } from 'react-table';

import { styled, ColumnType, DataGrid } from '@jarvis-network/ui';
import ChooseAsset from '@/components/exchange/ChooseAsset';
import MainForm from '@/components/exchange/MainForm';
import {
  setChooseAsset,
  setPayAsset,
  setReceiveAsset,
} from '@/state/slices/exchange';
import { Asset, AssetPair } from '@/data/assets';

import { useReduxSelector } from '@/state/useReduxSelector';

import StyledCard from './StyledCard';
import StyledSearchBar from './StyledSearchBar';
import FlagsPair from './FlagsPair';

const grid = {
  columns: [
    {
      key: 'flag',
      type: ColumnType.CustomCell,
      cell: ({ original }: CellInfo) => {
        const o = original as AssetPair;
        return <FlagsPair assetPair={o} />;
      },
      className: 'flag',
    },
    {
      key: 'name',
      type: ColumnType.Text,
      className: 'text',
    },
    {
      key: 'value',
      type: ColumnType.CustomCell,
      cell: ({ original }: CellInfo) => {
        return '1.23456';
      },
    },
  ],
};

const StyledGrid = styled(DataGrid)`
  .text,
  .flag {
    text-align: left;
  }
  .number {
    text-align: right;
    padding-right: 30px !important;
  }
  .flag {
    padding-left: 30px !important;
  }
`;

const GridContainer = styled.div`
  overflow: auto;
`;

const createPairs = (list: Asset[]): AssetPair[] => {
  return list.reduce<AssetPair[]>((result, input) => {
    result.push(
      ...list.reduce<AssetPair[]>((innerResult, output) => {
        if (output === input) {
          return innerResult;
        }
        const name = `${input.symbol}/${output.symbol}`;
        innerResult.push({ input, output, name });
        return innerResult;
      }, []),
    );
    return result;
  }, []);
};

const ExchangeCard: React.FC = () => {
  const dispatch = useDispatch();
  const chooseAsset = useReduxSelector(
    state => state.exchange.chooseAssetActive,
  );
  const list = useReduxSelector(state => state.assets.list);

  const pairsList = useMemo(() => createPairs(list), [list]);

  const [query, setQuery] = useState('');

  if (chooseAsset) {
    return <ChooseAsset onBack={() => dispatch(setChooseAsset(null))} />;
  }

  const handleSelected = (pair: AssetPair) => {
    dispatch(setPayAsset(pair.input.symbol));
    dispatch(setReceiveAsset(pair.output.symbol));
    setQuery('');
  };

  const searchBarProps: React.ComponentProps<typeof StyledSearchBar> = {
    placeholder: 'Try "jEUR"',
    data: pairsList,
    queryFilterProp: 'name',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    value: query,
    open: Boolean(query),
  };

  if (query) {
    searchBarProps.render = data => {
      const getTrProps = (state, rowInfo) => ({
        onClick: () => handleSelected(rowInfo.original),
        style: {
          cursor: 'pointer',
        },
      });

      return (
        <GridContainer>
          <StyledGrid
            columns={grid.columns}
            data={data.filteredData}
            showPagination={false}
            getTrProps={getTrProps}
          />
        </GridContainer>
      );
    };
  }

  return (
    <StyledCard title="Exchange">
      <StyledSearchBar {...searchBarProps} />
      {!query && <MainForm />}
    </StyledCard>
  );
};

export default ExchangeCard;
