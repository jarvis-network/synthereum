import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CellInfo } from 'react-table';
import {
  styled,
  ColumnType,
  DataGrid,
  Icon,
  themeValue,
} from '@jarvis-network/ui';

import { ChooseAsset } from '@/components/exchange/ChooseAsset';
import { MainForm } from '@/components/exchange/MainForm';

import {
  setChooseAsset,
  setPayAsset,
  setReceiveAsset,
} from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { formatRate } from '@/utils/format';
import { noColorGrid, styledScrollbars } from '@/utils/styleMixins';
import { Asset, AssetPair } from '@/data/assets';

import { StyledCard } from './StyledCard';
import { StyledSearchBar } from './StyledSearchBar';
import { FlagsPair } from './FlagsPair';

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
      className: 'number',
      cell: ({ original }: CellInfo) => {
        const o = original as AssetPair;
        return formatRate(o.input.price / o.output.price);
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
    padding-right: 23px !important; // 30 - 7 for slim scrollbar
  }
  .flag {
    padding-left: 30px !important;
    padding-right: 7px !important;
    flex-grow: 0 !important;
    width: auto !important;
  }
  .text,
  .number {
    color: ${props => props.theme.text.primary};
  }
  .text {
    font-size: 12px;
    padding-left: 0 !important;
  }

  .rt-tbody .rt-tr-group:first-child {
    border-top: none !important;
  }

  .rt-tbody .rt-tr-group {
    border-color: ${props => props.theme.border.secondary}!important;
  }

  .rt-table {
    overflow: hidden;
    .rt-tr {
      align-items: center;
    }
  }

  ${noColorGrid()}
`;

const GridContainer = styled.div`
  ${props => styledScrollbars(props.theme)}
`;

const ClearButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  outline: none !important;
  cursor: pointer;

  i {
    color: ${themeValue(
      {
        light: theme => theme.text.secondary,
      },
      theme => theme.text.medium,
    )}!important;

    svg {
      width: 15px;
      height: 15px;
    }
  }
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

export const ExchangeCard: React.FC = () => {
  const dispatch = useDispatch();
  const chooseAsset = useReduxSelector(
    state => state.exchange.chooseAssetActive,
  );
  const list = useReduxSelector(state => state.assets.list);

  const pairsList = useMemo(() => createPairs(list), [list]);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const handleCloseClick = () => {
    setQuery('');
    setSearchOpen(false);
  };

  useEffect(() => {
    const callback = event => {
      if (event.key === 'Escape') {
        handleCloseClick();
      }
    };
    document.addEventListener('keydown', callback);

    return () => document.removeEventListener('keydown', callback);
  }, []);

  if (chooseAsset) {
    return <ChooseAsset onBack={() => dispatch(setChooseAsset(null))} />;
  }

  const handleSelected = (pair: AssetPair) => {
    dispatch(setPayAsset(pair.input.symbol));
    dispatch(setReceiveAsset(pair.output.symbol));
    setQuery('');
    setSearchOpen(false);
  };

  const searchBarProps: React.ComponentProps<typeof StyledSearchBar> = {
    placeholder: 'Try "jEUR"',
    data: pairsList,
    filter: (data: AssetPair[], { query: searchQuery }: { query: string }) => {
      const q = searchQuery.toLowerCase().replace(/\//g, '');

      return data.filter(item => {
        return item.name.toLowerCase().replace(/\//g, '').includes(q);
      });
    },
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
      setSearchOpen(true);
    },
    value: query,
    open: searchOpen,
  };

  if (searchOpen) {
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
            pageSize={data.filteredData.length}
          />
        </GridContainer>
      );
    };
  }

  const suffix = searchOpen && (
    <ClearButton onClick={handleCloseClick}>
      <Icon icon="IoMdClose" />
    </ClearButton>
  );

  return (
    <StyledCard title="Exchange">
      <StyledSearchBar {...searchBarProps} suffix={suffix} />
      {!searchOpen && <MainForm />}
    </StyledCard>
  );
};
