import { State } from '@/state/initialState';

export const isAppReadySelector = ({ app }: State) =>
  app.isExchangeLoaded && app.isWindowLoaded;
