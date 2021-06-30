import { toWeiString } from '@jarvis-network/core-utils/dist/base/big-number';
import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { assertIsAddress as A } from '@jarvis-network/core-utils/dist/eth/address';

import { primaryCollateralSymbol } from './types/price-feed-symbols';
import {
  ChainLinkPriceAggregators,
  FixedPointNumber,
  SynthereumConfig,
  SyntheticTokens,
} from './types/config';

function toFixed(num: string): FixedPointNumber {
  return {
    rawValue: toWeiString(num),
  };
}

// Reference: https://docs.chain.link/docs/ethereum-addresses/
export const chainlinkAggregators = typeCheck<ChainLinkPriceAggregators>()({
  1: {
    EURUSD: A<1>('0xb49f677943BC038e9857d61E7d053CaA2C1734C1'),
    GBPUSD: A<1>('0x5c0Ab2d9b5a7ed9f470386e82BB36A3613cDd4b5'),
    CHFUSD: A<1>('0x449d117117838fFA61263B61dA6301AA2a88B13A'),
    XAUUSD: A<1>('0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6'),
  },
  42: {
    EURUSD: A<42>('0x0c15Ab9A0DB086e062194c273CC79f41597Bbf13'),
    GBPUSD: A<42>('0x28b0061f44E6A9780224AA61BEc8C3Fcb0d37de9'),
    CHFUSD: A<42>('0xed0616BeF04D374969f302a34AE4A63882490A8C'),
    XAUUSD: A<42>('0xc8fb5684f2707C82f28595dEaC017Bfdf44EE9c5'),
  },
  4: {
    EURUSD: A<4>('0x78F9e60608bF48a1155b4B2A5e31F32318a1d85F'),
    GBPUSD: A<4>('0x7B17A813eEC55515Fb8F49F2ef51502bC54DD40F'),
    CHFUSD: A<4>('0x5e601CF5EF284Bcd12decBDa189479413284E1d2'),
    XAUUSD: A<4>('0x81570059A0cb83888f1459Ec66Aad1Ac16730243'),
  },
} as const);

const syntheticTokensKovan = typeCheck<SyntheticTokens>()({
  jEUR: {
    syntheticName: 'Jarvis Synthetic Euro',
    syntheticSymbol: 'jEUR',
    umaPriceFeedIdentifier: 'EURUSD',
    jarvisPriceFeedIdentifier: 'EURUSD',
    collateralRequirement: '1200000000000000000',
    startingCollateralization: '1824000',
    minSponsorTokens: '20000000000000000000',
    isContractAllowed: false,
  },
  jCHF: {
    syntheticName: 'Jarvis Synthetic Swiss Franc',
    syntheticSymbol: 'jCHF',
    umaPriceFeedIdentifier: 'CHFUSD',
    jarvisPriceFeedIdentifier: 'USDCHF',
    collateralRequirement: '1200000000000000000',
    startingCollateralization: '1690000',
    minSponsorTokens: '22000000000000000000',
    isContractAllowed: false,
  },
  jGBP: {
    syntheticName: 'Jarvis Synthetic British Pound',
    syntheticSymbol: 'jGBP',
    umaPriceFeedIdentifier: 'GBPUSD',
    jarvisPriceFeedIdentifier: 'GBPUSD',
    collateralRequirement: '1200000000000000000',
    startingCollateralization: '2061000',
    minSponsorTokens: '18000000000000000000',
    isContractAllowed: false,
  },
  jXAU: {
    syntheticName: 'Jarvis Synthetic Gold',
    syntheticSymbol: 'jXAU',
    umaPriceFeedIdentifier: 'XAUUSD',
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
        poolRegistry: A<42>('0x6De2dd54A1FBBaCAd9a42eC289c5B371be2C9EF1'),
        selfMintingRegistry: A<42>(
          '0x61fa26046F9D5e47d15495Ef00efD9339E14E568',
        ),
      },
      chainlink: chainlinkAggregators[42],
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
        poolRegistry: A<1>('0xaB77024DdC68A3Fe942De8dDb0014738ED01A5e5'),
        selfMintingRegistry: A<1>('0x83D7AEee512DF37c694d36C983E0D4BdF12Cb6Bf'),
      },
      chainlink: chainlinkAggregators[1],
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
