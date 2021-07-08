import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { CellInfo, RowInfo } from 'react-table';
import {
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';
import {
  styled,
  ColumnType,
  DataGrid,
  Icon,
  themeValue,
  Card,
  NotificationType,
  NotificationsPlacement,
  noColorGrid,
  styledScrollbars,
  OnDesktop,
  OnMobile,
  Skeleton,
} from '@jarvis-network/ui';
import {
  TransactionHash,
  TransactionStatus,
} from '@jarvis-network/core-utils/dist/eth/transaction';
import Fuse from 'fuse.js';

import { MainForm, SkeletonMainForm } from '@/components/exchange/MainForm';
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
import {
  addTransaction,
  updateTranasactionStatus,
} from '@/state/slices/transactions';
import { useReduxSelector } from '@/state/useReduxSelector';
import { AssetPair } from '@/data/assets';
import { SynthereumTransaction } from '@/data/transactions';

import { createPairs } from '@/utils/createPairs';
import { useExchangeNotifications } from '@/utils/useExchangeNotifications';
import { useExchangeValues } from '@/utils/useExchangeValues';
import { dbPromise } from '@/utils/db';

import { useSwap } from '@/components/exchange/useSwap';

import { resetSwapAction } from '@/state/actions';
import { isAppReadySelector } from '@/state/selectors';

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
  background: ${props => props.theme.background.primary};
  height: 100%;
  border-radius: 0 0 ${props => props.theme.borderRadius.m}
    ${props => props.theme.borderRadius.m};
`;

const SkeletonContainer = styled(ContentContainer)`
  border-radius: ${props => props.theme.borderRadius.m};
  overflow: hidden;
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

    > *:first-child {
      border-radius: 0 !important;
    }

    > *:last-child {
      border-radius: 0 !important;
    }
  }
`;

const NotificationsContainer = styled.div`
  position: relative;

  .notification {
    width: 100%;
    top: -133px;
  }
`;

const CUSTOM_SEARCH_BAR_CLASS = 'custom-search-bar';

export const ExchangeCard: React.FC = () => {
  const notify = useExchangeNotifications();
  const web3 = useBehaviorSubject(useCoreObservables().web3$);
  const dispatch = useDispatch();
  const list = useReduxSelector(state => state.assets.list);
  const wallet = useReduxSelector(state => state.wallet);
  const auth = useReduxSelector(state => state.auth);
  const isApplicationReady = useReduxSelector(isAppReadySelector);
  const isExchangeConfirmationVisible = useReduxSelector(
    state => state.app.isExchangeConfirmationVisible,
  );
  const chooseAsset = useReduxSelector(
    state => state.exchange.chooseAssetActive,
  );

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const pairsList = useMemo(() => createPairs(list), [list]);
  const searcher = useMemo(
    () =>
      new Fuse(pairsList, {
        keys: ['name'],
      }),
    [pairsList],
  );

  const { fee, paySymbol, assetPay, assetReceive } = useExchangeValues();

  const swap = useSwap();

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
    if (!swap) {
      return;
    }

    dispatch(setSwapLoaderVisible(true));
    const time = 8000;

    try {
      const {
        allowancePromise,
        txPromise,
        sendTx,
        payValue,
        // eslint-disable-next-line @typescript-eslint/no-shadow
        paySymbol,
        receiveValue,
        receiveSymbol,
        type,
        networkId,
      } = swap();

      const result = await allowancePromise;
      if (!result) {
        throw new Error('Allowance = false');
      }

      const { promiEvent } = await sendTx;

      promiEvent.once('transactionHash', (hash: TransactionHash) => {
        const tx: SynthereumTransaction = {
          block: 0,
          from: auth!.address,
          hash,
          input: {
            amount: payValue,
            asset: paySymbol,
          },
          output: {
            amount: receiveValue,
            asset: receiveSymbol,
          },
          type,
          networkId,
          timestamp: 0,
          status: 'pending' as TransactionStatus,
        };
        dispatch(addTransaction(tx));
        dbPromise.then(db => db.put('transactions', tx));
        // transaction confirmed in the wallet app
        reset();
        notify('Your transaction has started', NotificationType.pending, time);

        txPromise.catch((data: { blockNumber: number }) => {
          const failedTx = {
            ...tx,
            status: 'failure' as TransactionStatus,
            block: data.blockNumber,
          };
          dispatch(updateTranasactionStatus(failedTx));

          Promise.all([web3!.eth.getBlock(data.blockNumber), dbPromise]).then(
            ([block, db]) => {
              failedTx.timestamp = (block.timestamp as number) * 1000;
              dispatch(updateTranasactionStatus(failedTx));
              return db.put('transactions', failedTx);
            },
          );
        });
      });

      const data = await txPromise;
      notify('Your transaction is complete', NotificationType.success, time);

      dispatch(
        updateTranasactionStatus({
          hash: data.transactionHash as TransactionHash,
          block: data.blockNumber,
          status: 'success',
        }),
      ); // Timestamp and cache will be updated from The Graph subscription
    } catch (e) {
      if (
        e?.message ===
        'MetaMask Tx Signature: User denied transaction signature.'
      ) {
        return;
      }
      console.error('Transaction error', e);
      notify('Your transaction has failed', NotificationType.error, time);
    } finally {
      dispatch(setSwapLoaderVisible(false));
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

  const searchBarProps: React.ComponentProps<typeof StyledSearchBar> = useMemo(
    () => ({
      placeholder: 'Try "jEUR"',
      data: pairsList,
      filter: (data: AssetPair[], { query: searchQuery }: { query: string }) =>
        searcher.search(searchQuery).map(result => result.item),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value);

        if (!searchOpen) {
          setSearchOpen(true);
        }
      },
      className: CUSTOM_SEARCH_BAR_CLASS,
      value: query,
      open: searchOpen,
    }),
    [searchOpen, query, searcher],
  );

  if (searchOpen) {
    searchBarProps.render = ({ filteredData }) => {
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
            data={filteredData}
            showPagination={false}
            getTrProps={getTrProps}
            pageSize={filteredData.length}
          />
        </GridContainer>
      );
    };
  }

  const isExchangeVisible = () => {
    if (!isApplicationReady) {
      return false;
    }

    if (!web3) return true;

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

    return <ContentContainer>{content}</ContentContainer>;
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

  const card = () => (
    <SkeletonContainer>
      {isExchangeVisible() ? (
        <CustomCard {...getCardProps()}>{content}</CustomCard>
      ) : (
        <SkeletonExchangeCardContents card />
      )}
    </SkeletonContainer>
  );

  const hasFee = !!fee?.toNumber();

  return (
    <Container>
      <NotificationsContainer>
        <NotificationsPlacement name="exchange" className="notification" />
      </NotificationsContainer>
      <CardContainer>
        <OnDesktop>{card()}</OnDesktop>
        <OnMobile>
          {chooseAsset || searchOpen || isExchangeConfirmationVisible ? (
            <MobileCardContainer>{card()}</MobileCardContainer>
          ) : isExchangeVisible() ? (
            content
          ) : (
            <SkeletonExchangeCardContents />
          )}
        </OnMobile>
      </CardContainer>
      {hasFee && (
        <FeesContainer>
          <Fees />
        </FeesContainer>
      )}
    </Container>
  );
};

const SkeletonSearchBarContainer = styled.div`
  height: 60px;
  display: flex;
  align-items: center;
  padding-left: 24px;
  border-bottom: 1px solid transparent;
`;

// eslint-disable-next-line react/require-default-props
function SkeletonExchangeCardContents({ card }: { card?: boolean }) {
  return (
    <>
      {card && (
        <Skeleton
          variant="rectangular"
          height={60}
          sx={{ borderRadius: '0' }}
        />
      )}

      <SkeletonSearchBarContainer>
        <Skeleton variant="rectangular" width={16} height={16} />
        <Skeleton
          variant="rectangular"
          width={74}
          height={16}
          sx={{ marginLeft: '10px' }}
        />
      </SkeletonSearchBarContainer>

      <SkeletonMainForm />
    </>
  );
}
