import React, { FC, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  ModalContent,
  Icon,
  AssetsRowExpand,
  AssetProps,
  styled,
} from '@jarvis-network/ui';

import { setRecentActivityModalVisible } from '@/state/slices/app';
import { useReduxSelector } from '@/state/useReduxSelector';
import { Transaction, TransactionIO } from '@/data/transactions';
import {
  formatDayLabel,
  formatTimestamp,
  formatTransactionStatus,
  formatTransactionType,
} from '@/utils/format';
import { getEtherscanTransactionURL } from '@/utils/url';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const getTimestamp = (item: Transaction) => item.timestamp; // helper for case if we will change timestamp value type

const getFullDaysInTimestamp = (transaction: Transaction) =>
  Math.floor(getTimestamp(transaction) / DAY_IN_MS);

const mapTransactionToAssetRow = (
  io: TransactionIO,
  isFrom?: boolean,
): AssetProps => ({
  flag: io.asset?.icon,
  name: io.asset?.symbol || '',
  value: isFrom ? -parseFloat(io.amount) : parseFloat(io.amount),
});

function groupTransactionsByDay(items: Transaction[]) {
  const result: { [key: number]: Transaction[] } = items.reduce(
    (accumulator, transaction) => {
      const fullDaysInTimestamp = getFullDaysInTimestamp(transaction);

      if (!accumulator[fullDaysInTimestamp]) {
        accumulator[fullDaysInTimestamp] = [];
      }

      accumulator[fullDaysInTimestamp].push(transaction);

      return accumulator;
    },
    {},
  );

  return Object.values(result)
    .map(list => list.sort((a, b) => getTimestamp(b) - getTimestamp(a)))
    .sort((a, b) => getTimestamp(b[0]) - getTimestamp(a[0]));
}

const Block = styled.div`
  margin-top: 20px;
`;

const Heading = styled.h4`
  padding: 0;
  margin: 0;
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
  margin-left: -24px;
  margin-right: -24px;
  border-bottom: 1px solid ${props => props.theme.background.medium};
`;

const EtherscanLink: FC<Pick<Transaction, 'txHash'>> = ({ txHash }) => (
  <Link
    href={getEtherscanTransactionURL(txHash)}
    target="_blank"
    rel="noopener noreferrer"
  >
    <Icon icon="IoMdOpen" style={{ justifyContent: 'flex-start' }} />
  </Link>
);

const ActivityRow: FC<Transaction> = ({
  input,
  output,
  type,
  timestamp,
  txHash,
  status,
}) => (
  <Wrapper>
    <AssetsRowExpand
      from={mapTransactionToAssetRow(input, true)}
      to={mapTransactionToAssetRow(output)}
      descriptions={[
        {
          label: 'Type',
          value: formatTransactionType(type),
        },
        {
          label: 'Timestamp',
          value: formatTimestamp(timestamp),
        },
        {
          label: 'See on Etherscan',
          value: <EtherscanLink txHash={txHash} />,
        },
        {
          label: 'Status',
          value: formatTransactionStatus(status),
        },
      ]}
    />
  </Wrapper>
);

export const RecentActivityModal: FC = () => {
  const dispatch = useDispatch();

  const isVisible = useReduxSelector(
    state => state.app.isRecentActivityModalVisible,
  );
  const rowTransactions = useReduxSelector(state => state.transactions.list);

  const handleClose = () => {
    dispatch(setRecentActivityModalVisible(false));
  };

  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDay(rowTransactions);
  }, [rowTransactions]);

  return (
    <ModalContent isOpened={isVisible} onClose={handleClose} title="Activity">
      {groupedTransactions.map(transactions => (
        <Block key={getFullDaysInTimestamp(transactions[0])}>
          <Heading>{formatDayLabel(transactions[0].timestamp)}</Heading>
          {transactions.map(transaction => (
            <ActivityRow key={transaction.txHash} {...transaction} />
          ))}
        </Block>
      ))}
    </ModalContent>
  );
};
