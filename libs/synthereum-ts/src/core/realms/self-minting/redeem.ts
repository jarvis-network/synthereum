import { catchError, filter, map, of, switchMap } from 'rxjs';

import { Epic, ReduxAction, Context } from '../../../epics/types';

import { genericTx } from './common';
import { ContractParams } from './interfaces';

export type OutputAction =
  | ReduxAction<'REDEEM_SUCCESS', ContractParams>
  | ReduxAction<'REDEEM_FAILED', ContractParams>;

export type InputAction =
  | ReduxAction<'CALL_REDEEM', ContractParams>
  | OutputAction;

export const redeemEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  action$.pipe(
    filter(action => action.type === 'CALL_REDEEM'),
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
        genericTx(context, 'redeem', 'syntheticToken', payload),
    ),
    catchError(err => {
      console.log(err);
      return of({
        type: `metaMaskConfirmation`,
      });
    }),
  );
