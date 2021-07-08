import React, { FC, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import InfiniteScroll from 'react-infinite-scroll-component';
import {
  ModalContent,
  Icon,
  AssetsRowExpand,
  AssetsRowSkeleton,
  Skeleton,
  AssetProps,
  styled,
} from '@jarvis-network/ui';

import { setRecentActivityModalVisible } from '@/state/slices/app';
import { useReduxSelector } from '@/state/useReduxSelector';
import { SynthereumTransaction, TransactionIO } from '@/data/transactions';
import { formatTransactionStatus, formatTransactionType } from '@/utils/format';
import { getEtherscanTransactionURL } from '@/utils/url';
import { formatDayLabel, formatTimestamp } from '@jarvis-network/app-toolkit';
import { useTransactionsSubgraph } from '@/utils/useTransactionsSubgraph';
import { assetsObject } from '@/data/assets';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const getTimestamp = ({ timestamp }: SynthereumTransaction) =>
  timestamp || Date.now();

const getFullDaysInTimestamp = (transaction: SynthereumTransaction) =>
  Math.floor(getTimestamp(transaction) / DAY_IN_MS);

const mapTransactionToAssetRow = (
  io: TransactionIO,
  isFrom?: boolean,
): AssetProps => {
  const asset = assetsObject[io.asset];
  const amount = FPN.fromWei(io.amount);
  return {
    flag: asset.icon ?? undefined,
    name: asset.symbol,
    value: isFrom ? amount.mul(new FPN('-1')).format(5) : amount.format(5),
  };
};

function groupTransactionsByDay(items: SynthereumTransaction[]) {
  type Result = { [key: number]: SynthereumTransaction[] };
  const result = items.reduce<Result>((accumulator, transaction) => {
    const fullDaysInTimestamp = getFullDaysInTimestamp(transaction);

    if (!accumulator[fullDaysInTimestamp]) {
      accumulator[fullDaysInTimestamp] = [];
    }

    accumulator[fullDaysInTimestamp].push(transaction);

    return accumulator;
  }, {});

  return Object.values(result)
    .map(list => list.sort((a, b) => getTimestamp(b) - getTimestamp(a)))
    .sort((a, b) => getTimestamp(b[0]) - getTimestamp(a[0]));
}

const CustomInfiniteScroll = styled(InfiniteScroll)`
  margin-left: -24px;
  margin-right: -24px;
`;

const Block = styled.div`
  margin-top: 20px;
`;

const Heading = styled.h4`
  padding: 0;
  margin: 0 24px;
  font-size: ${props => props.theme.font.sizes.l};
  margin-bottom: 10px;
`;

const Link = styled.a`
  color: ${props => props.theme.text.secondary};
  font-size: ${props => props.theme.font.sizes.xl};

  :hover {
    color: ${props => props.theme.text.primary};
  }
`;

const Wrapper = styled.div`
  border-bottom: 1px solid ${props => props.theme.background.medium};
`;

const EtherscanLink: FC<Pick<SynthereumTransaction, 'hash' | 'networkId'>> = ({
  hash,
  networkId,
}) => (
  <Link
    href={getEtherscanTransactionURL(hash, networkId)}
    target="_blank"
    rel="noopener noreferrer"
  >
    <Icon icon="IoMdOpen" style={{ justifyContent: 'flex-start' }} />
  </Link>
);

const ActivityRow: FC<SynthereumTransaction> = tx => {
  const txTimestamp = tx.timestamp;
  const [renderTimestamp, setRenderTimestamp] = useState(getTimestamp(tx));
  useEffect(() => {
    if (txTimestamp) return;

    const now = new Date();
    const seconds = now.getSeconds();
    const secondsUntilMinutePasses = 60 - seconds;

    const timeoutId = setTimeout(() => {
      setRenderTimestamp(Date.now());
    }, secondsUntilMinutePasses * 1000);

    return () => clearTimeout(timeoutId);
  }, [txTimestamp, setRenderTimestamp]);

  const row = (
    <AssetsRowExpand
      from={mapTransactionToAssetRow(tx.input, true)}
      to={mapTransactionToAssetRow(tx.output)}
      descriptions={[
        {
          label: 'Type',
          value: formatTransactionType(tx.type),
        },
        {
          label: 'Timestamp',
          value: formatTimestamp(renderTimestamp),
        },
        {
          label: 'See on Etherscan',
          value: <EtherscanLink hash={tx.hash} networkId={tx.networkId} />,
        },
        {
          label: 'Status',
          value: formatTransactionStatus(tx.status),
        },
      ]}
    />
  );

  return <Wrapper>{row}</Wrapper>;
};

export const RecentActivityModal: FC = () => {
  const dispatch = useDispatch();

  const isVisible = useReduxSelector(
    state => state.app.isRecentActivityModalVisible,
  );
  const state = useReduxSelector(({ transactions }) => transactions);
  const transactions = useMemo(
    () => Object.values(state.hashMap) as SynthereumTransaction[],
    [state],
  );

  const handleClose = () => {
    dispatch(setRecentActivityModalVisible(false));
  };

  const groupedTransactions = useMemo(
    () => groupTransactionsByDay(transactions),
    [transactions],
  );

  const { fetchMoreTransactions } = useTransactionsSubgraph();

  const id = 'recent-activity-modal-content';
  return (
    <ModalContent
      isOpened={isVisible}
      onClose={handleClose}
      title="Activity"
      id={id}
    >
      <CustomInfiniteScroll
        dataLength={transactions.length}
        next={fetchMoreTransactions}
        hasMore={state.hasOlderTransactions}
        loader={
          <Block>
            <Heading>
              <Skeleton variant="text" width={44} />
            </Heading>
            <AssetsRowSkeleton />
          </Block>
        }
        scrollableTarget={id}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-shadow */}
        {groupedTransactions.map(transactions => (
          <Block key={getFullDaysInTimestamp(transactions[0])}>
            <Heading>{formatDayLabel(getTimestamp(transactions[0]))}</Heading>
            {transactions.map(transaction => (
              <ActivityRow key={transaction.hash} {...transaction} />
            ))}
          </Block>
        ))}
      </CustomInfiniteScroll>
    </ModalContent>
  );
};
