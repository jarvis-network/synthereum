import React, { useEffect } from 'react';
import { soliditySha3, toBN } from 'web3-utils';
import {
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';
import { useERC20Contract } from '@/utils/useERC20Contract';
import { useDebouncedValue } from '@/utils/useDebouncedValue';
import { addresses } from '@/data/addresses';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import { NetworkName } from '@jarvis-network/core-utils/dist/eth/networks';
import { useReduxSelector } from '@/state/useReduxSelector';
import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';
import { useDispatch } from 'react-redux';
import { addHistoryItem } from '@/state/slices/history';
import { State } from '@/state/initialState';
import {
  isSupportedNetwork,
  SupportedNetworkId,
} from '@jarvis-network/synthereum-contracts/dist/config';
import { styled } from '@jarvis-network/ui';

import { HistoryItem } from './HistoryItem';
import { MessageContainer } from './MessageContainer';

const eventTopic = assertNotNull(
  soliditySha3('Transfer(address,address,uint256)'),
);

const convertAddressToUint256 = (address: string) =>
  `0x${toBN(address).toString(16).padStart(64, '0')}`;

const Container = styled.div`
  padding-top: 2px;

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding-top: 14px;
    height: 275px;
    overflow-y: auto;
  }
`;

const DateLabel = styled.div`
  padding: 16px;
  color: ${props => props.theme.text.secondary};

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding: 2px 24px 12px;
  }
`;

const dayInSeconds = 60 * 60 * 24;

const MonthsLabelMap = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function formatDayLabel(timestampInSeconds: number): string {
  const date = new Date(timestampInSeconds * 1000);
  return `${MonthsLabelMap[date.getMonth()]} ${date.getDate()}`;
}

const getFullDaysInTimestamp = (item: State['history'][number]) =>
  Math.floor(item.timestamp / dayInSeconds);

function groupTransactionsByDay(items: State['history'][number][]) {
  type Result = { [key: number]: State['history'][number][] };
  const result = items.reduce<Result>((accumulator, transaction) => {
    const fullDaysInTimestamp = getFullDaysInTimestamp(transaction);

    if (!accumulator[fullDaysInTimestamp]) {
      accumulator[fullDaysInTimestamp] = [];
    }

    accumulator[fullDaysInTimestamp].push(transaction);

    return accumulator;
  }, {});

  return Object.values(result)
    .map(list => list.sort((a, b) => b.timestamp - a.timestamp))
    .sort((a, b) => b[0].timestamp - a[0].timestamp);
}

export function History(): JSX.Element | null {
  const { web3$, networkId$ } = useCoreObservables();
  const web3 = useBehaviorSubject(web3$);
  const networkId = useBehaviorSubject(networkId$);
  const history = useDebouncedValue(useReduxSelector(state => state.history));
  const auth = useReduxSelector(state => state.auth);
  const dispatch = useDispatch();

  const contract = useERC20Contract(
    isSupportedNetwork(networkId)
      ? (addresses[networkId as SupportedNetworkId]
          .JRT as AddressOn<NetworkName>)
      : undefined,
  );

  useEffect(() => {
    if (!contract || !web3 || !auth) return;

    contract.events
      .Transfer({
        fromBlock: 'genesis',
        topics: [
          eventTopic,
          convertAddressToUint256(addresses[42].AerariumMilitare), // TODO: networkId
          convertAddressToUint256(auth.address),
        ],
      })
      .on(
        'data',
        (data: {
          blockNumber: number;
          returnValues: { value: string };
          transactionHash: string;
        }) => {
          web3.eth.getBlock(data.blockNumber).then(block => {
            dispatch(
              addHistoryItem({
                amount: data.returnValues.value,
                timestamp: block.timestamp as number,
                transactionHash: data.transactionHash,
              }),
            );
          });
        },
      )
      // eslint-disable-next-line no-console
      .on('error', (error: Error) => console.error(error));
  }, [contract, dispatch, web3, auth]);

  if (!isSupportedNetwork(networkId))
    return <MessageContainer>Unsupported Network</MessageContainer>;
  if (!contract) return null;

  const results = groupTransactionsByDay(history);

  return (
    <Container>
      {results.map(result => (
        <React.Fragment key={result[0].timestamp}>
          <DateLabel>{formatDayLabel(result[0].timestamp)}</DateLabel>
          {result.map(item => (
            <HistoryItem
              key={item.transactionHash}
              item={item}
              networkId={networkId}
            />
          ))}
        </React.Fragment>
      ))}
    </Container>
  );
}
