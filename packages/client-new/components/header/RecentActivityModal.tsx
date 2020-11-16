import React, { FC, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { ModalContent, Icon, AssetsRow } from '@jarvis-network/ui';

import { setRecentActivityModalVisible } from '@/state/slices/app';
import { useReduxSelector } from '@/state/useReduxSelector';
import { Transaction } from '@/data/transactions';
import { formatDayLabel } from '@/utils/format';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const getTimestamp = (item: Transaction) => item.timestamp; // helper for case if we will change timestamp value type

const getFullDaysInTimestamp = (transaction: Transaction) => Math.floor(getTimestamp(transaction) / DAY_IN_MS);

function groupTransactionsByDay(items: Transaction[]) {
  const result: { [key: number]: Transaction[] } = items.reduce((accumulator, transaction) => {
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

export const RecentActivityModal: FC = () => {
  const dispatch = useDispatch();

  const isVisible = useReduxSelector(
    state => state.app.isRecentActivityModalVisible,
  );

  const rowTransactions = useReduxSelector(
    state => state.transactions.list
  );

  const handleClose = () => {
    dispatch(setRecentActivityModalVisible(false));
  };

  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDay(rowTransactions);
  }, [rowTransactions]);

  return (
    <ModalContent
      isOpened={isVisible}
      onClose={handleClose}
      title="Recent Activity"
    >
      {groupedTransactions.map(transactions => (
        <div key={getFullDaysInTimestamp(transactions[0])}>
          <h5>{formatDayLabel(transactions[0].timestamp)}</h5>
          {transactions.map(transaction => (
            <AssetsRow
              from={{
                image: '', // @todo Allow to pass Flag
                value: -transaction.input.amount,
                name: transaction.input?.asset?.symbol
              }}
              to={{
                image: '',
                // @ts-ignore
                value: transaction.output.amount, // @todo Fix typings
                name: transaction.output?.asset?.symbol
              }}
              descriptions={[
                {
                  label: 'Type',
                  value: transaction.type
                },
                {
                  label: 'Timestamp',
                  value: new Date(transaction.timestamp).toLocaleString() // @todo Format date
                },
                {
                  label: 'See on Etherscan',
                  value: (
                    <a href={""}>
                      <Icon icon="IoMdOpen" style={{ justifyContent: 'flex-start' }} />,
                    </a>
                  ) // @todo Get Etherscan link
                },
                {
                  label: 'Status',
                  value: transaction.status // @todo Format status
                },
              ]}
            />
          ))}
        </div>
      ))}
    </ModalContent>
  );
};
