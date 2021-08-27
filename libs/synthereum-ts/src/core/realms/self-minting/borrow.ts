import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { catchError, filter, map, of, switchMap } from 'rxjs';

import { Epic, ReduxAction, Context } from '../../../epics/types';

import { ContractParams } from './interfaces';
import { genericTx } from './common';

export type OutputAction =
  | ReduxAction<'BORROW_SUCCESS', ContractParams>
  | ReduxAction<'BORROW_FAILED', ContractParams>;

export type InputAction =
  | ReduxAction<'CALL_BORROW', ContractParams>
  | OutputAction;

export const borrowEpic: Epic<ReduxAction, ReduxAction> = (
  action$,
  _state$,
  { context$ },
) =>
  action$.pipe(
    filter(action => action.type === 'CALL_BORROW'),
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
        // return genericTx(context, 'borrow', 'transaction', payload);
        /* -------------------------------------------------------------------------- */
        /*                             Borrow Transaction                             */
        /* -------------------------------------------------------------------------- */
        genericTx(context, 'borrow', 'collateralToken', payload),
    ),
    catchError(err => {
      console.log(err);
      return of({
        type: `metaMaskConfirmation`,
      });
    }),
  );

export const calculateDaoFee = ({
  collateral,
  collateralizationRatio,
  feePercentage,
}: {
  collateral: FPN;
  collateralizationRatio: StringAmount;
  feePercentage: StringAmount;
}) =>
  collateral
    .mul(FPN.fromWei(collateralizationRatio!))
    .mul(FPN.fromWei(feePercentage!));

export const maxBorrowTokens = ({
  collateral,
  assetOutPrice,
  fee,
}: {
  collateral: FPN;
  fee: FPN;
  assetOutPrice: StringAmount;
}) =>
  collateral.isZero()
    ? FPN.zero
    : collateral.sub(fee).div(FPN.fromWei(assetOutPrice!));
