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
  useTheme,
} from '@jarvis-network/ui';
import { ExchangeToken } from '@jarvis-network/synthereum-contracts/dist/src/config';

import { MainForm } from '@/components/exchange/MainForm';
import { ChooseAsset } from '@/components/exchange/ChooseAsset';

import {
  setChooseAsset,
  setPayAsset,
  setReceiveAsset,
} from '@/state/slices/exchange';
import {
  setSwapLoaderVisible,
  setExchangeConfirmationVisible,
} from '@/state/slices/app';
import { useReduxSelector } from '@/state/useReduxSelector';
import { noColorGrid, styledScrollbars } from '@/utils/styleMixins';
import { Asset, AssetPair } from '@/data/assets';

import { useExchangeValues } from '@/utils/useExchangeValues';

import { useSwap } from '@/components/exchange/useSwap';

import { resetSwapAction } from '@/state/actions';

import { OnDesktop } from '@/components/OnDesktop';
import { OnMobile } from '@/components/OnMobile';
import { Skeleton } from '@/components/Skeleton';

import { StyledSearchBar } from './StyledSearchBar';
import { FlagsPair } from './FlagsPair';
import { Fees, FEES_BLOCK_HEIGHT_PX } from './Fees';
import { SwapConfirm } from './SwapConfirm';

export const FULL_WIDGET_HEIGHT_PX = 595;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
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
    height: 100%;
  }
`;

const FeesContainer = styled.div`
  height: ${FEES_BLOCK_HEIGHT_PX - 20}px;
  margin-top: 20px;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    border-top: 1px solid ${props => props.theme.border.primary};
  }
`;

const ContentContainer = styled.div`
  height: 100%;
  border-radius: 0 0 ${props => props.theme.borderRadius.m}
    ${props => props.theme.borderRadius.m};
`;

const SkeletonContainer = styled(ContentContainer)``;

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

    > *:first-child {
      border-radius: 0 !important;
    }

    > *:last-child {
      border-radius: 0 !important;
    }
  }
`;

const CUSTOM_SEARCH_BAR_CLASS = 'custom-search-bar';

const getRealSymbol = (symbol: ExchangeToken): string => {
  if (symbol === 'USDC') {
    return 'usd';
  }

  return symbol.substring(1);
};

const createPairs = (list: Asset[]): AssetPair[] => {
  return list.reduce<AssetPair[]>((result, input) => {
    result.push(
      ...list.reduce<AssetPair[]>((innerResult, output) => {
        if (output === input) {
          return innerResult;
        }
        const name = `${input.symbol}/${output.symbol}`;
        const nameWithoutSlash = name.replace(/\//g, '');
        const realCurrenciesPair = `${getRealSymbol(
          input.symbol,
        )}${getRealSymbol(output.symbol)}`;
        const index = `${nameWithoutSlash}/${realCurrenciesPair}`;
        innerResult.push({ input, output, name, index });
        return innerResult;
      }, []),
    );
    return result;
  }, []);
};

export const ExchangeCard: React.FC = () => {
  const dispatch = useDispatch();
  const list = useReduxSelector(state => state.assets.list);
  const wallet = useReduxSelector(state => state.wallet);
  const auth = useReduxSelector(state => state.auth);
  const isExchangeConfirmationVisible = useReduxSelector(
    state => state.app.isExchangeConfirmationVisible,
  );
  const chooseAsset = useReduxSelector(
    state => state.exchange.chooseAssetActive,
  );

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const pairsList = useMemo(() => createPairs(list), [list]);

  const { fee, paySymbol, assetPay, assetReceive } = useExchangeValues();

  const swap = useSwap();
  const theme = useTheme();

  const handleCloseClick = () => {
    setQuery('');
    setSearchOpen(false);
  };

  const handleSelected = (pair: AssetPair) => {
    dispatch(setPayAsset(pair.input.symbol));
    dispatch(setReceiveAsset(pair.output.symbol));
    handleCloseClick();
  };

  const reset = () => dispatch(resetSwapAction());

  const doSwap = async () => {
    try {
      await swap?.();
      setTimeout(reset, 1000);
    } catch (e) {
      console.error(e); // @TODO needs proper error handler
    }
  };

  const handleConfirmButtonClick = () => {
    dispatch(setSwapLoaderVisible(true));
    doSwap();
  };

  useEffect(() => {
    const callback = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseClick();

        // blur input
        (document.activeElement as HTMLInputElement | null)?.blur();
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

      return data.filter(item => item.index.toLowerCase().includes(q));
    },
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
      setSearchOpen(true);
    },
    className: CUSTOM_SEARCH_BAR_CLASS,
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

  const isExchangeVisible = () => {
    const isAssetPriceLoaded = assetPay?.price && assetReceive?.price;

    if (!auth) {
      return isAssetPriceLoaded;
    }

    return isAssetPriceLoaded && paySymbol && wallet[paySymbol];
  };

  const getContent = () => {
    if (chooseAsset) {
      return <ChooseAsset />;
    }

    if (isExchangeConfirmationVisible) {
      return <SwapConfirm onConfim={handleConfirmButtonClick} />;
    }

    const suffix = searchOpen && (
      <ClearButton onClick={handleCloseClick}>
        <Icon icon="IoMdClose" />
      </ClearButton>
    );

    const content = isExchangeVisible() ? (
      <>
        <StyledSearchBar {...searchBarProps} suffix={suffix} />
        {!searchOpen && <MainForm />}
      </>
    ) : null;

    return (
      <ContentContainer>
        <SkeletonContainer>
          <Skeleton style={{ borderRadius: theme.borderRadius.m }}>
            {content}
          </Skeleton>
        </SkeletonContainer>
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

    if (isExchangeConfirmationVisible) {
      return {
        title: 'Confirmation',
        onBack: () => dispatch(setExchangeConfirmationVisible(false)),
      };
    }

    return {
      title: 'Swap',
    };
  };

  const content = getContent();

  const card = <CustomCard {...getCardProps()}>{content}</CustomCard>;

  const isMobileCardVisible =
    chooseAsset || searchOpen || isExchangeConfirmationVisible;

  const mobileContent = isMobileCardVisible ? (
    <MobileCardContainer>{card}</MobileCardContainer>
  ) : (
    content
  );

  const hasFee = !!fee?.toNumber();

  return (
    <Container>
      <CardContainer>
        <OnDesktop>{card}</OnDesktop>
        <OnMobile>{mobileContent}</OnMobile>
      </CardContainer>
      {hasFee && (
        <FeesContainer>
          <Fees />
        </FeesContainer>
      )}
    </Container>
  );
};
