import { catchError, filter, map, of, switchMap } from 'rxjs';

import { Epic, ReduxAction, Context } from '../../../epics/types';

import { ContractParams } from './interfaces';

import { genericTx } from './common';

export type OutputAction =
  | ReduxAction<'REPAY_SUCCESS', ContractParams>
  | ReduxAction<'REPAY_FAILED', ContractParams>;

export type InputAction =
  | ReduxAction<'CALL_REPAY', ContractParams>
  | OutputAction;

export const repayEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  action$.pipe(
    filter(action => action.type === 'CALL_REPAY'),
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
        genericTx(context, 'repay', 'syntheticToken', payload),
    ),
    catchError(err => {
      console.log(err);
      return of({
        type: `metaMaskConfirmation`,
      });
    }),
  );
