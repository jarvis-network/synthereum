import { ThemeNameType } from '@jarvis-network/ui';

import { cache } from '@jarvis-network/app-toolkit';

export interface State {
  theme: ThemeNameType;
  app: {
    isAuthModalVisible: boolean;
  };
  claim: {
    investorInfo: string; // big number
    endTime: number; // timestamp in seconds
    startTime: number; // timestamp in seconds
    claimableJRT: string; // big number
    claimedAmount: string; // big number
  } | null;
  history: {
    amount: string;
    timestamp: number;
    transactionHash: string;
  }[];
}

export const initialAppState: State = {
  theme: cache.get<ThemeNameType | null>('jarvis/state/theme') || 'light',
  app: {
    isAuthModalVisible: false,
  },
  history: [],
  claim: null,
};
