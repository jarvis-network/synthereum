import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { ether, wei } from '@jarvis-network/core-utils/dist/base/big-number';

import { Observable, Observer } from 'rxjs';

import { once } from '@jarvis-network/core-utils/dist/eth/contracts/send-tx';

import { PromiEvent, TransactionReceipt } from 'web3-core';

import { ReduxAction, Context } from '../../../epics/types';

import { ContractParams } from './interfaces';

export const formatUSDValue = (assetOutPrice: string, price: string) =>
  FPN.fromWei(assetOutPrice)
    .mul(FPN.toWei(price))
    .div(FPN.fromWei(ether))
    .format(2);

export const genericTx = (
  context: Context,
  opType:
    | 'borrow'
    | 'repay'
    | 'redeem'
    | 'deposit'
    | 'withdraw'
    | 'withdrawCancel'
    | 'withdrawPass',
  allowanceTokenType: 'collateralToken' | 'syntheticToken',
  payload: ContractParams,
) =>
  new Observable<ReduxAction>(observer => {
    (async () => {
      const isSufficientAllowanceFor = await context.selfMintingRealmAgent!.isSufficientAllowanceFor(
        payload.pair,
        allowanceTokenType,
        wei(payload.collateral),
      );
      let approvalTransaction = isSufficientAllowanceFor;
      if (!isSufficientAllowanceFor) {
        //  transaction
        const {
          promiEvent,
        } = await context.selfMintingRealmAgent!.increaseAllowance(
          payload.pair,
          allowanceTokenType,
        )!;
        approvalTransaction = await transactionEvents(
          promiEvent,
          observer,
          'approveTransaction',
          'approval',
          {},
        );
      }
      if (approvalTransaction) {
        const { promiEvent } = await context.selfMintingRealmAgent![opType](
          payload,
        );
        await transactionEvents(
          promiEvent,
          observer,
          'transaction',
          opType,
          payload,
        );
      }
      observer.complete();
    })();
  });

export async function transactionEvents(
  promiEvent: PromiEvent<TransactionReceipt>,
  observer: Observer<ReduxAction>,
  txType: 'transaction' | 'approveTransaction',
  opType: string,
  payload: any,
) {
  /**
   * TODO: Refactor and handle events like this
   * https://web3js.readthedocs.io/en/v1.4.0/callbacks-promises-events.html?highlight=promievent#callbacks-promises-events
   * return new Observable(observer => {
      const promiEvent = realmAgent[method](params);
      promiEvent
        .once('sending', () => { observer.next(); })
        .once('sent', payload => { observer.next(); })
        .once('transactionHash', hash => { observer.next(); })
        .once('receipt', receipt => { observer.next(); })
        .on('confirmation', (confNumber, receipt, latestBlockHash) => { observer.next(); })
        .on('error', error => { observer.next(); });
    });
   */
  try {
    await once(promiEvent, 'sent');
    observer.next({
      type: `${txType}/metaMaskConfirmation`,
      payload: {
        params: payload,
        opType,
      },
    });

    await once(promiEvent, 'sending');
    const txHash = await once(promiEvent, 'transactionHash');
    observer.next({
      type: `${txType}/send`,
      payload: {
        txHash,
      },
    });
    const [_, receipt] = await once(promiEvent, 'confirmation', 1);
    const { blockHash, transactionHash, status } = receipt;
    observer.next({
      type: `${txType}/confirmed`,
      payload: {
        receipt: {
          blockHash,
          transactionHash,
          status,
        },
      },
    });
    return true;
  } catch (error) {
    observer.next({
      type: `${txType}/cancel`,
      payload: {
        opType: 'cancel',
      },
    });
    return false;
    // TODO: Add proper error handling base on the code
    // https://docs.metamask.io/guide/rpc-api.html#other-rpc-methods
  }
}
