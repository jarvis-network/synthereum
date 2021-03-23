import { ThemeNameType } from '@jarvis-network/ui';

import { cache } from '@/utils/cache';

export interface State {
  theme: ThemeNameType;
}

export const initialState: State = {
  theme: cache?.get<ThemeNameType | null>('jarvis/state/theme') || 'light',
};
