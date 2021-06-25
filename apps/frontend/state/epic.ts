import { combineEpics } from 'redux-observable';

import {
  priceFeedSubscribeEpic,
  priceFeedUnsubscribeEpic,
} from '@/state/epics/prices';

const epics =
  process.env.NEXT_PUBLIC_POOL_VERSION === 'v1' ||
  process.env.NEXT_PUBLIC_POOL_VERSION === 'v2'
    ? [priceFeedSubscribeEpic, priceFeedUnsubscribeEpic]
    : [];

export const epic = combineEpics(...epics);
