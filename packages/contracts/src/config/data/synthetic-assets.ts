import { SyntheticTokenConfig } from '../types';

export const syntheticTokens = [
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
  {
    syntheticName: 'Jarvis Synthetic British Pound',
    syntheticSymbol: 'jGBP',
    priceFeedIdentifier: 'GBP/USD',
    collateralRequirement: { rawValue: '1100000000000000000' },
    startingCollateralization: '1676000',
    minSponsorTokens: { rawValue: '1000000000000000000' },
  },
  {
    syntheticName: 'Jarvis Synthetic Gold',
    syntheticSymbol: 'jXAU',
    priceFeedIdentifier: 'XAU/USD',
    collateralRequirement: { rawValue: '1200000000000000000' },
    startingCollateralization: '2866000000',
    minSponsorTokens: { rawValue: '500000000000000' },
  },
  {
    syntheticName: 'Jarvis Synthetic S&P500',
    syntheticSymbol: 'jSPX',
    priceFeedIdentifier: 'SPX/USD',
    collateralRequirement: {
      rawValue: '1200000000000000000',
    },
    startingCollateralization: '5068000000',
    minSponsorTokens: { rawValue: '300000000000000' },
  },
  {
    syntheticName: 'Jarvis Synthetic Crude Oil',
    syntheticSymbol: 'jXTI',
    priceFeedIdentifier: 'XTI/USD',
    collateralRequirement: {
      rawValue: '1200000000000000000',
    },
    startingCollateralization: '58170000',
    minSponsorTokens: { rawValue: '25000000000000000' },
  },
  {
    syntheticName: 'Jarvis Synthetic Silver',
    syntheticSymbol: 'jXAG',
    priceFeedIdentifier: 'XAG/USD',
    collateralRequirement: {
      rawValue: '1200000000000000000',
    },
    startingCollateralization: '36090000',
    minSponsorTokens: { rawValue: '45000000000000000' },
  },
] as const;

export type AllSyntheticTokens = typeof syntheticTokens;

// Ensure that the object literal above has compatible type with what we expect.
// Mark it as export to prevent TS from warning that it is not used:
export const __typeCheck: Readonly<SyntheticTokenConfig[]> = syntheticTokens;
