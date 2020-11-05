import { shallowEqual, useSelector } from 'react-redux';

import { State } from '@/state/initialState';

export const useReduxSelector = <TSelector = unknown>(
  selector: (state: State) => TSelector,
  equalityFn?: (left: TSelector, right: TSelector) => boolean,
): TSelector =>
  useSelector<State, TSelector>(selector, equalityFn || shallowEqual);
