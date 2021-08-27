import { Observable } from 'rxjs';

export type ReduxAction<Type extends string = string, Payload = any> = {
  type: Type;
  payload?: Payload;
};

export interface StateObservable<S> extends Observable<S> {
  value: S;
}

export declare interface Epic<
  Input extends ReduxAction,
  Output extends ReduxAction,
  State = unknown
> {
  (
    action$: Observable<Input>,
    state$: StateObservable<State>,
    dependencies: Dependencies,
  ): Observable<Output>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Dependencies {}
