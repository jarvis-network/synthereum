import { FlagKeys } from '@jarvis-network/ui';
import {
  primaryCollateralSymbol,
  ExchangeSynthereumToken,
  synthereumConfig,
} from '@jarvis-network/synthereum-ts/dist/config';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

import { SubscriptionPair } from '@/utils/priceFeed';
import { PerSynthereumPair } from '@jarvis-network/synthereum-contracts/dist/config';

export interface Asset {
  name: string;
  symbol: ExchangeSynthereumToken;
  pair: SubscriptionPair | null;
  icon: FlagKeys | null;
  price: FPN | null;
  decimals: number;
  type: 'forex' | 'crypto';
}

export interface AssetPair {
  input: Asset;
  output: Asset;
  name: string;
}

export const PRIMARY_STABLE_COIN_TEXT_SYMBOL = '$';

export const PRIMARY_STABLE_COIN: Asset = {
  name: 'USDC',
  symbol: primaryCollateralSymbol,
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

const assetIconMap: PerSynthereumPair<FlagKeys | null> = {
  jEUR: 'eur',
  jGBP: 'gbp',
  jCHF: 'chf',
  jXAU: 'xau',
} as const;

// FIXME: Instead of hardcoding the networkId and pool version make them dynamic
const syntheticAssets: Asset[] = Object.values(
  synthereumConfig[1].perVersionConfig.v4.syntheticTokens,
).map(info => ({
  name: info.syntheticName,
  symbol: info.syntheticSymbol,
  pair: info.umaPriceFeedIdentifier,
  icon: assetIconMap[info.syntheticSymbol],
  price: null,
  decimals: 18,
  type: 'forex',
}));

export const assets: Asset[] = [PRIMARY_STABLE_COIN, ...syntheticAssets];
