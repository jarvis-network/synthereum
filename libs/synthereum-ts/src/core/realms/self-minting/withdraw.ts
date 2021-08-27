import { catchError, filter, map, of, switchMap } from 'rxjs';

import { Epic, ReduxAction, Context } from '../../../epics/types';

import { genericTx } from './common';
import { ContractParams } from './interfaces';

export type OutputAction =
  | ReduxAction<'WITHDRAW_SUCCESS', ContractParams>
  | ReduxAction<'WITHDRAW_FAILED', ContractParams>;

export type InputAction =
  | ReduxAction<'CALL_WITHDRAW', ContractParams>
  | ReduxAction<'CANCEL_WITHDRAW'>
  | ReduxAction<'APPROVE_WITHDRAW'>
  | OutputAction;

export const withdrawEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  action$.pipe(
    filter(action => action.type === 'CALL_WITHDRAW'),
    switchMap(action =>
      context$!.pipe(
        map(context => ({
          context,
          payload: action.payload as ContractParams,
        })),
      ),
    ),
    switchMap(
      ({ payload, context }: { payload: ContractParams; context: Context }) =>
        genericTx(context, 'withdraw', 'collateralToken', payload),
    ),
    catchError(err => {
      console.log(err);
      return of({
        type: `transaction/cancel`,
      });
    }),
  );

export const withdrawCancelEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  action$.pipe(
    filter(action => action.type === 'CANCEL_WITHDRAW'),
    switchMap(action =>
      context$!.pipe(
        map(context => ({
          context,
          payload: action.payload as ContractParams,
        })),
      ),
    ),
    switchMap(
      ({ payload, context }: { payload: ContractParams; context: Context }) =>
        genericTx(context, 'withdrawCancel', 'collateralToken', payload),
    ),
    catchError(err => {
      console.log(err);
      return of({
        type: `transaction/cancel`,
      });
    }),
  );

export const withdrawApproveEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  action$.pipe(
    filter(action => action.type === 'APPROVE_WITHDRAW'),
    switchMap(action =>
      context$!.pipe(
        map(context => ({
          context,
          payload: action.payload as ContractParams,
        })),
      ),
    ),
    switchMap(
      ({ payload, context }: { payload: ContractParams; context: Context }) =>
        genericTx(context, 'withdrawPass', 'collateralToken', payload),
    ),
    catchError(err => {
      console.log(err);
      return of({
        type: `transaction/cancel`,
      });
    }),
  );
