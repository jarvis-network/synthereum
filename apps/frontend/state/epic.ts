import { combineEpics } from 'redux-observable';

import {
  priceFeedSubscribeEpic,
  priceFeedUnsubscribeEpic,
} from '@/state/epics/prices';

export const epic = combineEpics(
  priceFeedSubscribeEpic,
  priceFeedUnsubscribeEpic,
);
