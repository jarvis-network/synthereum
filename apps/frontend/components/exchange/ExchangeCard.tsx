import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { CellInfo, RowInfo } from 'react-table';
import {
  styled,
  ColumnType,
  DataGrid,
  Icon,
  themeValue,
} from '@jarvis-network/ui';

import { MainForm } from '@/components/exchange/MainForm';

import { setPayAsset, setReceiveAsset } from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { noColorGrid, styledScrollbars } from '@/utils/styleMixins';
import { Asset, AssetPair } from '@/data/assets';

import { StyledSearchBar } from './StyledSearchBar';
import { FlagsPair } from './FlagsPair';
import { useExchangeValues } from '@/utils/useExchangeValues';
import { Fees } from './Fees';
import { StyledCard } from './StyledCard';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
`;

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

        if (o.input.price && o.output.price) {
          return o.input.price.div(o.output.price).format(5);
        }
        return null;
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
  const list = useReduxSelector(state => state.assets.list);

  const pairsList = useMemo(() => createPairs(list), [list]);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    payString,
    receiveString,
  } = useExchangeValues();

  const swapDisabled = !Number(payString) || !Number(receiveString);

  const handleCloseClick = () => {
    setQuery('');
    setSearchOpen(false);
  };

  useEffect(() => {
    const callback = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseClick();
      }
    };
    document.addEventListener('keydown', callback);

    return () => document.removeEventListener('keydown', callback);
  }, []);

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
      const getTrProps = (_: any, rowInfo?: RowInfo) => ({
        onClick: () => handleSelected(rowInfo!.original),
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
    <Container>
      <StyledCard title="Swap">
        <StyledSearchBar {...searchBarProps} suffix={suffix} />
        {!searchOpen && <MainForm />}
      </StyledCard>
      <Fees />
    </Container>
  );
};
