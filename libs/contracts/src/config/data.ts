import { toWeiString } from '@jarvis-network/core-utils/dist/base/big-number';
import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { assertIsAddress as A } from '@jarvis-network/core-utils/dist/eth/address';

import {
  FixedPointNumber,
  PriceFeed,
  primaryCollateralSymbol,
  SynthereumConfig,
  SyntheticTokens,
} from './types';

function toFixed(num: string): FixedPointNumber {
  return {
    rawValue: toWeiString(num),
  };
}

export const priceFeed = typeCheck<PriceFeed>()({
  jEUR: 'EURUSD',
  jGBP: 'GBPUSD',
  jCHF: 'USDCHF',
  jXAU: 'XAUUSD',
  jSPX: 'SPXUSD',
  jXTI: 'XTIUSD',
  jXAG: 'XAGUSD',
} as const);

export const reversedPriceFeedPairs: string[] = [priceFeed.jCHF];

const syntheticTokensKovan = typeCheck<SyntheticTokens>()({
  jEUR: {
    syntheticName: 'Jarvis Synthetic Euro',
    syntheticSymbol: 'jEUR',
    umaPriceFeedIdentifier: 'EUR/USD',
    jarvisPriceFeedIdentifier: 'EURUSD',
    collateralRequirement: '1200000000000000000',
    startingCollateralization: '1824000',
    minSponsorTokens: '20000000000000000000',
    isContractAllowed: false,
  },
  jCHF: {
    syntheticName: 'Jarvis Synthetic Swiss Franc',
    syntheticSymbol: 'jCHF',
    umaPriceFeedIdentifier: 'CHF/USD',
    jarvisPriceFeedIdentifier: 'USDCHF',
    collateralRequirement: '1200000000000000000',
    startingCollateralization: '1690000',
    minSponsorTokens: '22000000000000000000',
    isContractAllowed: false,
  },
  jGBP: {
    syntheticName: 'Jarvis Synthetic British Pound',
    syntheticSymbol: 'jGBP',
    umaPriceFeedIdentifier: 'GBP/USD',
    jarvisPriceFeedIdentifier: 'GBPUSD',
    collateralRequirement: '1200000000000000000',
    startingCollateralization: '2061000',
    minSponsorTokens: '18000000000000000000',
    isContractAllowed: false,
  },
  jXAU: {
    syntheticName: 'Jarvis Synthetic Gold',
    syntheticSymbol: 'jXAU',
    umaPriceFeedIdentifier: 'XAU/USD',
    jarvisPriceFeedIdentifier: 'XAUUSD',
    collateralRequirement: '1200000000000000000',
    startingCollateralization: '2780080000',
    minSponsorTokens: '13000000000000000',
    isContractAllowed: false,
  },
} as const);

const syntheticTokensMainnet = typeCheck<SyntheticTokens>()({
  jEUR: {
    syntheticName: 'Jarvis Synthetic Euro',
    syntheticSymbol: 'jEUR',
    umaPriceFeedIdentifier: 'EURUSD',
    jarvisPriceFeedIdentifier: 'EURUSD',
    collateralRequirement: '1100000000000000000',
    startingCollateralization: '1819350',
    minSponsorTokens: '0',
    isContractAllowed: true,
  },
  jCHF: {
    syntheticName: 'Jarvis Synthetic Swiss Franc',
    syntheticSymbol: 'jCHF',
    umaPriceFeedIdentifier: 'CHFUSD',
    jarvisPriceFeedIdentifier: 'USDCHF',
    collateralRequirement: '1100000000000000000',
    startingCollateralization: '2079000',
    minSponsorTokens: '0',
    isContractAllowed: true,
  },
  jGBP: {
    syntheticName: 'Jarvis Synthetic British Pound',
    syntheticSymbol: 'jGBP',
    umaPriceFeedIdentifier: 'GBPUSD',
    jarvisPriceFeedIdentifier: 'GBPUSD',
    collateralRequirement: '1100000000000000000',
    startingCollateralization: '2052000',
    minSponsorTokens: '0',
    isContractAllowed: true,
  },
  jXAU: {
    syntheticName: 'Jarvis Synthetic Gold',
    syntheticSymbol: 'jXAU',
    umaPriceFeedIdentifier: 'XAUUSD',
    jarvisPriceFeedIdentifier: 'XAUUSD',
    collateralRequirement: '1200000000000000000',
    startingCollateralization: '2696355000',
    minSponsorTokens: '0',
    isContractAllowed: true,
  },
} as const);

export const synthereumConfig = typeCheck<SynthereumConfig>()({
  '42': {
    fees: {
      feePercentage: toWeiString('0.002'),
      feeRecipients: [
        A<42>('0x61b5A06CE0FcdA6445fb454244Ce84ED64c41aCa'),
        A<42>('0x0C85fdB62CAC33F2bb7fE0366Ff9CBc65d3cdBDb'),
      ],
      feeProportions: [50, 50],
    },
    roles: {
      admin: A<42>('0x539E625172026F8d2AC50648a55871FA728618e8'),
      maintainer: A<42>('0x8Eadb31D981509c1a2e55111C5b9c56788c89486'),
      liquidityProvider: A<42>('0x61b5A06CE0FcdA6445fb454244Ce84ED64c41aCa'),
      validator: A<42>('0x61b5A06CE0FcdA6445fb454244Ce84ED64c41aCa'),
    },
    contractsDependencies: {
      uma: {
        identifierWhitelist: A<42>(
          '0xeF9c374b7976941fCAf5e501eaB531E430463fC6',
        ),
        finder: A<42>('0xeD0169a88d267063184b0853BaAAAe66c3c154B2'),
      },
      synthereum: {
        primaryCollateralToken: {
          address: A<42>('0xe22da380ee6B445bb8273C81944ADEB6E8450422'),
          symbol: primaryCollateralSymbol,
        },
        poolRegistry: A<42>('0x963C30D1d707d2B0f3F175525Cc4a740ce3ce0C7'),
      },
    },
    umaDerivativeConfig: {
      disputeBondPct: toFixed('0.1'),
      sponsorDisputeRewardPct: toFixed('0.05'),
      disputerDisputeRewardPct: toFixed('0.2'),
      withdrawalLiveness: 7200,
      liquidationLiveness: 7200,
      excessTokenBeneficiary: A<42>(
        '0x49251bc21C3e3Af201F39AeEbF93474dA6a9A5E7',
      ),
    },
    perVersionConfig: {
      v1: {
        version: 1,
        syntheticTokens: syntheticTokensKovan,
      },
      v2: {
        version: 2,
        syntheticTokens: syntheticTokensKovan,
      },
      v3: {
        version: 3,
        syntheticTokens: syntheticTokensKovan,
      },
      v4: {
        version: 4,
        syntheticTokens: syntheticTokensMainnet,
      },
    },
  },
  '1': {
    fees: {
      feePercentage: toWeiString('0.002'),
      feeRecipients: [
        A<1>('0x8eF00583bAa186094D9A34a0A4750C1D1BB86831'),
        A<1>('0xc31249BA48763dF46388BA5C4E7565d62ed4801C'),
      ],
      feeProportions: [50, 50],
    },
    roles: {
      admin: A<1>('0x128C8E20Dd4F2d8519dD605632660686bA35D212'),
      maintainer: A<1>('0x10D7C10A2F25bA6212968d8918eb687d589C6e0a'),
      liquidityProvider: A<1>('0xc31249BA48763dF46388BA5C4E7565d62ed4801C'),
      validator: A<1>('0x62Ca030EB6B3F9f0a8fd353d95C48a60763AAfF0'),
    },
    contractsDependencies: {
      uma: {
        identifierWhitelist: A<1>('0xcF649d9Da4D1362C4DAEa67573430Bd6f945e570'),
        finder: A<1>('0x40f941E48A552bF496B154Af6bf55725f18D77c3'),
      },
      synthereum: {
        primaryCollateralToken: {
          address: A<1>('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
          symbol: primaryCollateralSymbol,
        },
        poolRegistry: A<1>('0xefb040204CC94e49433FDD472e49D4f3538D5346'),
      },
    },
    umaDerivativeConfig: {
      disputeBondPct: toFixed('0.05'),
      sponsorDisputeRewardPct: toFixed('0.5'),
      disputerDisputeRewardPct: toFixed('0.2'),
      withdrawalLiveness: 7200,
      liquidationLiveness: 7200,
      excessTokenBeneficiary: A<1>(
        '0x535aC9f9b46E515a3af364434061181a504D5bFb',
      ),
    },
    perVersionConfig: {
      v1: {
        version: 1,
        syntheticTokens: syntheticTokensMainnet,
      },
      v2: {
        version: 2,
        syntheticTokens: syntheticTokensMainnet,
      },
      v3: {
        version: 3,
        syntheticTokens: syntheticTokensMainnet,
      },
      v4: {
        version: 4,
        syntheticTokens: syntheticTokensMainnet,
      },
    },
  },
} as const);
