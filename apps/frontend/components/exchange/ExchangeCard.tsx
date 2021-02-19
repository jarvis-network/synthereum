import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { CellInfo, RowInfo } from 'react-table';
import {
  styled,
  ColumnType,
  DataGrid,
  Icon,
  themeValue,
  Card,
} from '@jarvis-network/ui';

import { MainForm } from '@/components/exchange/MainForm';
import { ChooseAsset } from '@/components/exchange/ChooseAsset';

import {
  setChooseAsset,
  setPayAsset,
  setReceiveAsset,
} from '@/state/slices/exchange';
import { useReduxSelector } from '@/state/useReduxSelector';
import { noColorGrid, styledScrollbars } from '@/utils/styleMixins';
import { Asset, AssetPair } from '@/data/assets';

import { OnDesktop } from '../OnDesktop';

import { OnMobile } from '../OnMobile';

import { StyledSearchBar } from './StyledSearchBar';
import { FlagsPair } from './FlagsPair';
import { Fees, FEES_BLOCK_HEIGHT_PX } from './Fees';

export const FULL_WIDGET_HEIGHT_PX = 595;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: ${FULL_WIDGET_HEIGHT_PX}px;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    height: 100%;
    padding-bottom: 51px;
    justify-content: space-between;
  }
`;

const CardContainer = styled.div`
  height: ${FULL_WIDGET_HEIGHT_PX - FEES_BLOCK_HEIGHT_PX}px;

  @media screen and (max-width: ${props =>
    props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    height: auto;
  }
`;

const FeesContainer = styled.div`
  height: ${FEES_BLOCK_HEIGHT_PX}px;
`;

const ContentContainer = styled.div`
  height: calc(100% - ${props => props.theme.borderRadius.m});
`;

const MobileCardContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
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
    padding-let: 0 !important;
  }
  .flag {
    flex-grow: 0 !important;
    width: auto !important;
    padding: 16px 0 16px 24px !important;
  }
  .text,
  .number {
    color: ${props => props.theme.text.primary};
    font-size: ${props => props.theme.font.sizes.m};
    padding: 16px !important;
  }

  .rt-tbody .rt-tr-group:first-child {
    border-top: none !important;
  }

  .rt-tbody .rt-tr-group {
    border-color: ${props => props.theme.border.secondary} !important;
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

const CustomCard = styled(Card)`
  @media screen and (max-width: ${props =>
    props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    border-radius: 0 !important;

    *:first-child {
      border-radius: 0 !important;
    }

    *:last-child {
      border-radius: 0 !important;
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
  const chooseAsset = useReduxSelector(
    state => state.exchange.chooseAssetActive,
  );

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const pairsList = useMemo(() => createPairs(list), [list]);

  const handleCloseClick = () => {
    setQuery('');
    setSearchOpen(false);
  };

  const handleSelected = (pair: AssetPair) => {
    dispatch(setPayAsset(pair.input.symbol));
    dispatch(setReceiveAsset(pair.output.symbol));
    handleCloseClick();
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

  const getContent = () => {
    if (chooseAsset) {
      return <ChooseAsset />;
    }

    const suffix = searchOpen && (
      <ClearButton onClick={handleCloseClick}>
        <Icon icon="IoMdClose" />
      </ClearButton>
    );

    return (
      <ContentContainer>
        <StyledSearchBar {...searchBarProps} suffix={suffix} />
        {!searchOpen && <MainForm />}
      </ContentContainer>
    );
  };

  const getCardProps = () => {
    if (chooseAsset) {
      return {
        title: 'Choose asset',
        onBack: () => dispatch(setChooseAsset(null)),
      };
    }

    return {
      title: 'Swap',
    };
  };

  const content = getContent();

  const card = (
    <CustomCard {...getCardProps()}>
      {content}
    </CustomCard>
  );

  const mobileContent =
    chooseAsset || searchOpen ? (
      <MobileCardContainer>{card}</MobileCardContainer>
    ) : (
      content
    );

  return (
    <Container>
      <CardContainer>
        <OnDesktop>{card}</OnDesktop>
        <OnMobile>{mobileContent}</OnMobile>
      </CardContainer>
      <FeesContainer>
        <Fees />
      </FeesContainer>
    </Container>
  );
};
