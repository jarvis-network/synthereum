import { catchError, filter, map, of, switchMap, takeUntil } from 'rxjs';

import { AppEvents } from '../../../epics/core';

import { Epic, ReduxAction, Context } from '../../../epics/types';

import { ContractParams } from './interfaces';
import { genericTx } from './common';

type CamelCase<
  S extends string
> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
  : Lowercase<S>;

type RealmFunctions =
  | 'REPAY'
  | 'REDEEM'
  | 'DEPOSIT'
  | 'BORROW'
  | 'WITHDRAW'
  | 'CANCEL_WITHDRAW'
  | 'APPROVE_WITHDRAW';

type RealmOp = `CALL_${RealmFunctions}`;
type TxOptions = {
  [Op in RealmOp]: [
    CamelCase<RealmFunctions>,
    'syntheticToken' | 'collateralToken',
  ];
};

const txOptions: TxOptions = {
  CALL_BORROW: ['borrow', 'collateralToken'],
  CALL_DEPOSIT: ['deposit', 'collateralToken'],
  CALL_REPAY: ['repay', 'syntheticToken'],
  CALL_REDEEM: ['redeem', 'syntheticToken'],
  CALL_WITHDRAW: ['withdraw', 'collateralToken'],
  CALL_APPROVE_WITHDRAW: ['approveWithdraw', 'collateralToken'],
  CALL_CANCEL_WITHDRAW: ['cancelWithdraw', 'collateralToken'],
};

export function createRealmAgentEpic(
  actionType: RealmOp,
): Epic<ReduxAction, ReduxAction> {
  return (action$, _state$, { context$ }) =>
    action$.pipe(
      filter(action => action.type === actionType),
      switchMap(action =>
        context$!.pipe(
          map(context => ({
            context,
            payload: action.payload as ContractParams,
          })),
          takeUntil(action$.pipe(filter(a => AppEvents.indexOf(a.type) > -1))),
        ),
      ),
      switchMap(
        ({ payload, context }: { payload: ContractParams; context: Context }) =>
          genericTx(context, ...txOptions[actionType], payload),
      ),
      catchError(err => {
        console.log(err);
        return of({
          type: `metaMaskConfirmation`,
        });
      }),
    );
}
