import { FlagKeys } from '@jarvis-network/ui';
import {
  PerAsset,
  SyntheticSymbol,
} from '@jarvis-network/synthereum-contracts/dist/src/config';
import { PrimaryStableCoin } from '@jarvis-network/synthereum-contracts/dist/src/config/data/stable-coin';
import { syntheticTokens } from '@jarvis-network/synthereum-contracts/dist/src/config/data/all-synthetic-assets';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { SubscriptionPair } from '@/utils/priceFeed';

export interface Asset {
  name: string;
  symbol: SyntheticSymbol | PrimaryStableCoin;
  pair: SubscriptionPair | null;
  icon: FlagKeys | null;
  price: FPN;
  decimals: number;
  type: 'forex' | 'crypto';
}

export interface AssetPair {
  input: Asset;
  output: Asset;
  name: string; // used for easier filtering
}

export const PRIMARY_STABLE_COIN: Asset = {
  name: 'USDC',
  symbol: 'USDC',
  pair: null,
  icon: 'us',
  price: new FPN(1),
  decimals: 6,
  type: 'forex',
};

export interface AssetWithWalletInfo extends Asset {
  stableCoinValue: FPN;
  ownedAmount: FPN;
}

export const PRICE_DECIMALS = 5;

const assetIconMap: PerAsset<FlagKeys | null> = {
  jEUR: 'eur',
  jGBP: 'gbp',
  jCHF: 'chf',
  jXAU: null,
  jSPX: null,
  jXTI: null,
  jXAG: null,
} as const;

const syntheticAssets: Asset[] = syntheticTokens.map(token => ({
  name: token.syntheticName,
  symbol: token.syntheticSymbol,
  pair: token.priceFeedIdentifier.replace('/', '') as SubscriptionPair,
  icon: assetIconMap[token.syntheticSymbol],
  price: new FPN(1), // @TODO Make initial values nullable
  decimals: 18,
  type: 'forex',
}));

export const assets: Asset[] = [PRIMARY_STABLE_COIN, ...syntheticAssets];
