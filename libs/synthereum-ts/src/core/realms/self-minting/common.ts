import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { ether, wei } from '@jarvis-network/core-utils/dist/base/big-number';

import { Observable, Observer } from 'rxjs';

import { once } from '@jarvis-network/core-utils/dist/eth/contracts/send-tx';

import { PromiEvent, TransactionReceipt } from 'web3-core';

import {
  NonPayableTransactionObject,
  NonPayableTx,
} from 'libs/contracts/dist/contracts/typechain';

import { toAscii } from 'web3-utils';

import { ReduxAction, Context } from '../../../epics/types';

import { ContractParams } from './interfaces';

export const formatUSDValue = (assetOutPrice: string, price: string) =>
  FPN.fromWei(assetOutPrice)
    .mul(FPN.toWei(price))
    .div(FPN.fromWei(ether))
    .format(2);

const decodeErrorMessage = (msg: string): string => {
  const errorMessageData = msg.match(/0x[0-9a-fA-F]{136,}/)![0];
  const msgLength = parseInt(errorMessageData.substr(2 + 8 + 64, 64), 16);
  const msgHex = errorMessageData.substr(2 + 8 + 64 + 64, msgLength * 2);
  return toAscii(`0x${msgHex}`);
};

export const genericTx = (
  context: Context,
  opType:
    | 'borrow'
    | 'repay'
    | 'redeem'
    | 'deposit'
    | 'withdraw'
    | 'approveWithdraw'
    | 'cancelWithdraw',
  allowanceTokenType: 'collateralToken' | 'syntheticToken',
  { validateOnly = false, ...payload }: ContractParams,
) =>
  new Observable<ReduxAction>(observer => {
    (async () => {
      try {
        const isSufficientAllowanceFor = await context.selfMintingRealmAgent!.isSufficientAllowanceFor(
          payload.pair,
          allowanceTokenType,
          allowanceTokenType === 'collateralToken'
            ? wei(payload.collateral)
            : wei(payload.numTokens),
        );

        let approvalTransaction = isSufficientAllowanceFor;
        if (!isSufficientAllowanceFor) {
          //  transaction
          try {
            const tx = await context.selfMintingRealmAgent!.increaseAllowance(
              payload.pair,
              allowanceTokenType,
            )!;

            const from = context.selfMintingRealmAgent!.agentAddress;
            console.log('Getting tx nonce');
            const newNonce = await context.web3!.eth.getTransactionCount(from);
            const nonce = newNonce + 1;
            console.log('Using nonce:', nonce, { nextNonces: nonce });
            const txParams: NonPayableTx = {
              from,
              nonce,
            };
            console.log(`Gas estimation for tx:`, tx.arguments, txParams);

            let estimatedGas;
            try {
              await tx.call(txParams);
              estimatedGas = await tx.estimateGas(txParams);
            } catch (err: any) {
              const msg = err.message;
              const reason = decodeErrorMessage(msg);
              observer.next({
                type: `transaction/metaMaskError`,
                payload: {
                  message: reason,
                },
              });
              return;
            }

            txParams.gas = estimatedGas;
            console.log('Setting gasLimit: ', txParams.gas);

            const promiEvent = tx.send(txParams);

            approvalTransaction = await transactionEvents(
              promiEvent,
              observer,
              'approveTransaction',
              'approval',
              {},
            );
          } catch (error) {
            console.log(error);
          }
        }
        if (approvalTransaction) {
          const tx: NonPayableTransactionObject<any> | null = context.selfMintingRealmAgent![
            opType
          ](payload);
          const from = context.selfMintingRealmAgent!.agentAddress;
          console.log('Getting tx nonce');
          const newNonce = await context.web3!.eth.getTransactionCount(from);
          const nonce = newNonce + 1;
          console.log('Using nonce:', nonce, { nextNonces: nonce });
          const txParams: NonPayableTx = {
            from,
            nonce,
          };
          console.log(`Gas estimation for tx:`, tx.arguments, txParams);

          let estimatedGas;
          try {
            await tx.call(txParams);
            estimatedGas = await tx.estimateGas(txParams);
            observer.next({
              type: `transaction/validate`,
            });
          } catch (err: any) {
            const msg = err.message;
            const reason = decodeErrorMessage(msg);
            observer.next({
              type: `transaction/metaMaskError`,
              payload: {
                message: reason,
              },
            });
            observer.complete();
            return;
          }
          if (validateOnly) {
            observer.next({
              type: `transaction/cancel`,
            });
            observer.complete();
            return;
          }
          txParams.gas = estimatedGas;
          console.log('Setting gasLimit: ', txParams.gas);

          const promiEvent = tx.send(txParams);

          await transactionEvents(
            promiEvent,
            observer,
            'transaction',
            opType,
            payload,
          );
        }
      } catch (error: any) {
        console.log(error);
        observer.next({
          type: `transaction/metaMaskError`,
          payload: {
            code: error.code,
            message: error.message,
            data: error.data,
          },
        });
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
