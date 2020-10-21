import { ThemeNameType } from '@jarvis-network/ui';
import { UserState } from 'bnc-onboard/dist/src/interfaces';

export interface State {
  theme: ThemeNameType;
  auth: Omit<UserState, 'wallet'>;
}

const initialState: State = {
  theme: 'light',
  auth: {
    address: null,
    network: null,
    balance: null,
    mobileDevice: null,
    appNetworkId: null,
  },
};

export default initialState;
