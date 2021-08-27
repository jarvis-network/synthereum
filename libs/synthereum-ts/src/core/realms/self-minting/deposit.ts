import { catchError, filter, map, of, switchMap } from 'rxjs';

import { Epic, ReduxAction, Context } from '../../../epics/types';

import { genericTx } from './common';
import { ContractParams } from './interfaces';

export type OutputAction =
  | ReduxAction<'DEPOSIT_SUCCESS', ContractParams>
  | ReduxAction<'DEPOSIT_FAILED', ContractParams>;

export type InputAction =
  | ReduxAction<'CALL_DEPOSIT', ContractParams>
  | OutputAction;

export const depositEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  action$.pipe(
    filter(action => action.type === 'CALL_DEPOSIT'),
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
        genericTx(context, 'deposit', 'collateralToken', payload),
    ),
    catchError(err => {
      console.log(err);
      return of({
        type: `metaMaskConfirmation`,
      });
    }),
  );

// export const realmEpic: Epic<ReduxAction, ReduxAction> = (
//   action$,
//   _state$,
//   { context$ },
// ) =>
//   action$!.pipe(
//     switchMapTo(context$!.pipe(map(context => context.networkId))),
//     distinctUntilChanged(),
//     map(networkId => {
//       console.log(networkId)
//       return { type: 'app/contextUpdate', payload: networkId }
//     }),
//     catchError(err => {
//       throw 'error in source. Details: ' + err;
//     }),
//   );
