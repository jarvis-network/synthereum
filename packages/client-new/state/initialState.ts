import { ThemeNameType } from '@jarvis-network/ui';
import { UserState } from 'bnc-onboard/dist/src/interfaces';
import assets, { Asset } from '@/data/assets';

type Values = 'pay' | 'receive';

export interface State {
  theme: ThemeNameType;
  auth: Omit<UserState, 'wallet'>;
  assets: {
    list: Asset[];
  };
  exchange: {
    // pay/receive are stored as string to allow incomplete input fills while
    // typing ie. "1." (mind the dot) - forcing a number instantly will cause
    // dot to be removed as typed
    // these values should be casted to number when needed
    pay: string;
    receive: string;
    base: Values;
    payAsset: string;
    receiveAsset: string;
    rate: number; // @TODO remove when blockchain integration is done
    chooseAssetActive: Values;
  };
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
  assets: {
    list: assets,
  },
  exchange: {
    pay: '10',
    receive: '22',
    base: 'pay',
    payAsset: null,
    receiveAsset: null,
    rate: 1.4,
    chooseAssetActive: null,
  },
};

export default initialState;
export type AssetType = Values;
