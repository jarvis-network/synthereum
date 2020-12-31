import { FlagKeys } from '@jarvis-network/ui';
import {
  PerAsset,
  SyntheticSymbol,
} from '@jarvis-network/synthereum-contracts/dist/src/config';
import {
  PrimaryStableCoin,
  PRIMARY_STABLE_COIN as PRIMARY_STABLE_COIN_SYMBOL,
} from '@jarvis-network/synthereum-contracts/dist/src/config/data/stable-coin';
import { allSyntheticTokensMap } from '@jarvis-network/synthereum-contracts/dist/src/config/data/all-synthetic-assets';
import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';

import { SubscriptionPair } from '@/utils/priceFeed';
import { allSupportedSymbols } from '@jarvis-network/synthereum-contracts/dist/src/config/data/all-synthetic-asset-symbols';

export interface Asset {
  name: string;
  symbol: SyntheticSymbol | PrimaryStableCoin;
  pair: SubscriptionPair | null;
  icon: FlagKeys | null;
  price: FPN | null;
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
  symbol: PRIMARY_STABLE_COIN_SYMBOL,
  pair: null,
  icon: 'us',
  price: new FPN(1),
  decimals: 6,
  type: 'forex',
};

export interface AssetWithWalletInfo extends Asset {
  stableCoinValue: FPN | null;
  ownedAmount: FPN;
}

const assetIconMap: PerAsset<FlagKeys | null> = {
  jEUR: 'eur',
  jGBP: 'gbp',
  jCHF: 'chf',
  jXAU: 'xau',
} as const;

const syntheticAssets: Asset[] = allSupportedSymbols.map(asset => {
  const token = allSyntheticTokensMap[asset];
  return {
    name: token.syntheticName,
    symbol: token.syntheticSymbol,
    pair: token.priceFeedIdentifier.replace('/', '') as SubscriptionPair,
    icon: assetIconMap[token.syntheticSymbol],
    price: null,
    decimals: 18,
    type: 'forex',
  };
});

export const assets: Asset[] = [PRIMARY_STABLE_COIN, ...syntheticAssets];
