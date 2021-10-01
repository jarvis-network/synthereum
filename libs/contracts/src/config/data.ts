import { toWeiString } from '@jarvis-network/core-utils/dist/base/big-number';
import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { assertIsAddress as A } from '@jarvis-network/core-utils/dist/eth/address';

import {
  FixedPointNumber,
  PriceFeed,
  collateralSymbol,
  SynthereumConfig,
  SyntheticTokens,
  SyntheticTokenConfig,
  SyntheticSymbol,
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
  jPHP: 'PHPUSD',
  jSGD: 'SGDUSD',
} as const);

export const reversedPriceFeedPairs: string[] = [priceFeed.jCHF];

const syntheticTokensKovan = typeCheck<SyntheticTokens>()({
  jEUR: {
    syntheticName: 'Jarvis Synthetic Euro',
    syntheticSymbol: 'jEUR',
    umaPriceFeedIdentifier: 'EUR/USD',
    jarvisPriceFeedIdentifier: 'EURUSD',
    chainlinkPriceFeedIdentifier: 'EURUSD',
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
    chainlinkPriceFeedIdentifier: 'CHFUSD',
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
    chainlinkPriceFeedIdentifier: 'GBPUSD',
    collateralRequirement: '1200000000000000000',
    startingCollateralization: '2061000',
    minSponsorTokens: '18000000000000000000',
    isContractAllowed: false,
  },
} as const);

const syntheticTokensMainnet = typeCheck<SyntheticTokens>()({
  jEUR: {
    syntheticName: 'Jarvis Synthetic Euro',
    syntheticSymbol: 'jEUR',
    umaPriceFeedIdentifier: 'EURUSD',
    jarvisPriceFeedIdentifier: 'EURUSD',
    chainlinkPriceFeedIdentifier: 'EURUSD',
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
    chainlinkPriceFeedIdentifier: 'CHFUSD',
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
    chainlinkPriceFeedIdentifier: 'GBPUSD',
    collateralRequirement: '1100000000000000000',
    startingCollateralization: '2052000',
    minSponsorTokens: '0',
    isContractAllowed: true,
  },
} as const);

const jPHP = typeCheck<SyntheticTokenConfig<SyntheticSymbol>>()({
  syntheticName: 'Jarvis Synthetic Philippine Peso',
  syntheticSymbol: 'jPHP',
  umaPriceFeedIdentifier: 'PHPUSD',
  jarvisPriceFeedIdentifier: 'PHPUSD',
  chainlinkPriceFeedIdentifier: 'PHPUSD',
  collateralRequirement: '1050000000000000000',
  startingCollateralization: '24490',
  minSponsorTokens: '0',
  isContractAllowed: true,
} as const);

const jSGD = typeCheck<SyntheticTokenConfig<SyntheticSymbol>>()({
  syntheticName: 'Jarvis Synthetic Singapore Dollar',
  syntheticSymbol: 'jSGD',
  umaPriceFeedIdentifier: 'SGDUSD',
  jarvisPriceFeedIdentifier: 'SGDUSD',
  chainlinkPriceFeedIdentifier: 'SGDUSD',
  collateralRequirement: '1050000000000000000',
  startingCollateralization: '920375',
  minSponsorTokens: '0',
  isContractAllowed: true,
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
          symbol: collateralSymbol,
        },
        poolRegistry: A<42>('0x6De2dd54A1FBBaCAd9a42eC289c5B371be2C9EF1'),
        selfMintingRegistry: A<42>(
          '0x61fa26046F9D5e47d15495Ef00efD9339E14E568',
        ),
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
          symbol: collateralSymbol,
        },
        poolRegistry: A<1>('0xaB77024DdC68A3Fe942De8dDb0014738ED01A5e5'),
        selfMintingRegistry: A<1>('0x83D7AEee512DF37c694d36C983E0D4BdF12Cb6Bf'),
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
  '137': {
    fees: {
      feePercentage: toWeiString('0.001'),
      feeRecipients: [
        A<137>('0x8eF00583bAa186094D9A34a0A4750C1D1BB86831'),
        A<137>('0xc31249BA48763dF46388BA5C4E7565d62ed4801C'),
      ],
      feeProportions: [50, 50],
    },
    roles: {
      admin: A<137>('0x8a73fdA882601C4B84B0C52D7d85E4BA46357ca1'),
      maintainer: A<137>('0x05Bd62e8Be770A03C0Da0eC3033cB637331F0941'),
      liquidityProvider: A<137>('0xc31249BA48763dF46388BA5C4E7565d62ed4801C'),
      validator: A<137>('0xc31249BA48763dF46388BA5C4E7565d62ed4801C'),
    },
    contractsDependencies: {
      uma: {
        identifierWhitelist: A<137>(
          '0x2271a5E74eA8A29764ab10523575b41AA52455f0',
        ),
        finder: A<137>('0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64'),
      },
      synthereum: {
        primaryCollateralToken: {
          address: A<137>('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'),
          symbol: collateralSymbol,
        },
        poolRegistry: A<137>('0xdCE12741DF9d2CcF2A8bB611684C8151De91a7d2'),
        selfMintingRegistry: A<137>(
          '0x0000000000000000000000000000000000000000',
        ),
      },
    },
    umaDerivativeConfig: {
      disputeBondPct: toFixed('0.05'),
      sponsorDisputeRewardPct: toFixed('0.05'),
      disputerDisputeRewardPct: toFixed('0.2'),
      withdrawalLiveness: 86400,
      liquidationLiveness: 86400,
      excessTokenBeneficiary: A<137>(
        '0x8ef00583baa186094d9a34a0a4750c1d1bb86831',
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
        syntheticTokens: { ...syntheticTokensMainnet, jPHP, jSGD } as const,
      },
    },
  },
  '80001': {
    fees: {
      feePercentage: toWeiString('0.002'),
      feeRecipients: [
        A<80001>('0x61b5A06CE0FcdA6445fb454244Ce84ED64c41aCa'),
        A<80001>('0x0C85fdB62CAC33F2bb7fE0366Ff9CBc65d3cdBDb'),
      ],
      feeProportions: [50, 50],
    },
    roles: {
      admin: A<80001>('0x539E625172026F8d2AC50648a55871FA728618e8'),
      maintainer: A<80001>('0x8Eadb31D981509c1a2e55111C5b9c56788c89486'),
      liquidityProvider: A<80001>('0x22744fcAd77B78595f6Abb003cc5C5FB97e16365'),
      validator: A<80001>('0x22744fcAd77B78595f6Abb003cc5C5FB97e16365'),
    },
    contractsDependencies: {
      uma: {
        identifierWhitelist: A<80001>(
          '0xA011B82880D0235f845c9d1EA5610b965e0CD759',
        ),
        finder: A<80001>('0xb22033fF04AD01fbE8d78ef4622a20626834271B'),
      },
      synthereum: {
        primaryCollateralToken: {
          address: A<80001>('0xdEe897d5E6eaA6365F293c37cB3fA8335B9B8f3F'),
          symbol: collateralSymbol,
        },
        poolRegistry: A<80001>('0xfaa6229B087Da78cAEBb29799D9a8A74Ec1ea237'),
        selfMintingRegistry: A<80001>(
          '0x0000000000000000000000000000000000000000',
        ),
      },
    },
    umaDerivativeConfig: {
      disputeBondPct: toFixed('0.05'),
      sponsorDisputeRewardPct: toFixed('0.05'),
      disputerDisputeRewardPct: toFixed('0.2'),
      withdrawalLiveness: 86400,
      liquidationLiveness: 86400,
      excessTokenBeneficiary: A<80001>(
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
} as const);
