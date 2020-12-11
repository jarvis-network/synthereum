import { SyntheticTokenConfig } from '..';

export const addSyntheticAssets: SyntheticTokenConfig[] = [
  {
    syntheticName: 'Jarvis Synthetic Euro',
    syntheticSymbol: 'jEUR',
    priceFeedIdentifier: 'EUR/USD',
    collateralRequirement: { rawValue: '1100000000000000000' },
    startingCollateralization: '1527000',
    minSponsorTokens: { rawValue: '1000000000000000000' },
  },
  {
    syntheticName: 'Jarvis Synthetic Swiss Franc',
    syntheticSymbol: 'jCHF',
    priceFeedIdentifier: 'CHF/USD',
    collateralRequirement: { rawValue: '1100000000000000000' },
    startingCollateralization: '1415000',
    minSponsorTokens: { rawValue: '1000000000000000000' },
  },
];
