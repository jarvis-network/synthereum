import { toWeiString } from '@jarvis-network/core-utils/dist/base/big-number';
import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { assertIsAddress as A } from '@jarvis-network/core-utils/dist/eth/address';

import { primaryCollateralSymbol } from './types/price-feed-symbols';
import {
  ChainLinkPriceAggregators,
  FixedPointNumber,
  SynthereumConfig,
  SyntheticTokenConfig,
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

    UMAETH: A<1>('0xf817B69EA583CAFF291E287CaE00Ea329d22765C'),
    ETHUSD: A<1>('0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'),

    CADUSD: A<1>('0xa34317DB73e77d453b1B8d04550c44D10e981C8e'),
    JPYUSD: A<1>('0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3'),
    KRWUSD: A<1>('0x01435677FB11763550905594A16B645847C1d0F3'),
    NGNUSD: A<1>('0x3e59bc23ea3f39e69b5e662B6fC5e7e6D22B6914'),
    PHPUSD: A<1>('0x9481e7ad8BE6BbB22A8B9F7B9fB7588d1df65DF6'),
    ZARUSD: A<1>('0x438F81D95761d7036cd2617295827D9d01Cf593f'),
  },
  42: {
    EURUSD: A<42>('0x0c15Ab9A0DB086e062194c273CC79f41597Bbf13'),
    GBPUSD: A<42>('0x28b0061f44E6A9780224AA61BEc8C3Fcb0d37de9'),
    CHFUSD: A<42>('0xed0616BeF04D374969f302a34AE4A63882490A8C'),
    XAUUSD: A<42>('0xc8fb5684f2707C82f28595dEaC017Bfdf44EE9c5'),
    ETHUSD: A<42>('0x9326BFA02ADD2366b30bacB125260Af641031331'),
    JPYUSD: A<42>('0xD627B1eF3AC23F1d3e576FA6206126F3c1Bd0942'),
    KRWUSD: A<42>('0x9e465c5499023675051517E9Ee5f4C334D91e369'),

    // FAKE Address
    UMAETH: A<42>('0x0000000000000000000000000000000000000000'),
    CADUSD: A<42>('0x0000000000000000000000000000000000000000'),
    NGNUSD: A<42>('0x0000000000000000000000000000000000000000'),
    PHPUSD: A<42>('0x0000000000000000000000000000000000000000'),
    ZARUSD: A<42>('0x0000000000000000000000000000000000000000'),
  },
  137: {
    EURUSD: A<137>('0x73366Fe0AA0Ded304479862808e02506FE556a98'),
    GBPUSD: A<137>('0x099a2540848573e94fb1Ca0Fa420b00acbBc845a'),
    CHFUSD: A<137>('0xc76f762CedF0F78a439727861628E0fdfE1e70c2'),
    XAUUSD: A<137>('0x0C466540B2ee1a31b441671eac0ca886e051E410'),
    PHPUSD: A<137>('0x218231089Bebb2A31970c3b77E96eCfb3BA006D1'),
    SGDUSD: A<137>('0x8CE3cAc0E6635ce04783709ca3CC4F5fc5304299'),
    CADUSD: A<137>('0xACA44ABb8B04D07D883202F99FA5E3c53ed57Fb5'),
    JPYUSD: A<137>('0xD647a6fC9BC6402301583C91decC5989d8Bc382D'),
    ETHUSD: A<137>('0xF9680D99D6C9589e2a93a78A04A279e509205945'),

    UMAETH: A<137>('0x0000000000000000000000000000000000000000'),
    KRWUSD: A<137>('0x0000000000000000000000000000000000000000'),
    NGNUSD: A<137>('0x0000000000000000000000000000000000000000'),
    ZARUSD: A<137>('0x0000000000000000000000000000000000000000'),
  },
  80001: {
    EURUSD: A<80001>('0x876e7aa32a6f71405bd3ba5151cc6a43d15bffe6'),
    GBPUSD: A<80001>('0x6f94eed129e6e29b19951e5b6f40c025d2348cf2'),
    CHFUSD: A<80001>('0x1d5cbe59b8166d35eaa309045c5dd34b453eb4f3'),
    XAUUSD: A<80001>('0xddb827c1b6b29c02532739a53d226a57381e719c'),
    ETHUSD: A<80001>('0x0715A7794a1dc8e42615F059dD6e406A6594651A'),

    UMAETH: A<80001>('0x0000000000000000000000000000000000000000'),
    CADUSD: A<80001>('0x0000000000000000000000000000000000000000'),
    NGNUSD: A<80001>('0x0000000000000000000000000000000000000000'),
    PHPUSD: A<80001>('0x0000000000000000000000000000000000000000'),
    ZARUSD: A<80001>('0x0000000000000000000000000000000000000000'),
  },
} as const);

const syntheticTokens = typeCheck<SyntheticTokens<'mainnet'>>()({
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
      v4: {
        version: 4,
        syntheticTokens,
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
      v4: {
        version: 4,
        syntheticTokens,
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
          symbol: primaryCollateralSymbol,
        },
        poolRegistry: A<137>('0xdCE12741DF9d2CcF2A8bB611684C8151De91a7d2'),
        selfMintingRegistry: A<137>(
          '0x0000000000000000000000000000000000000000',
        ),
      },
      chainlink: chainlinkAggregators[137],
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
      v4: {
        version: 4,
        syntheticTokens: {
          ...syntheticTokens,
          jPHP: typeCheck<SyntheticTokenConfig>()({
            syntheticName: 'Jarvis Synthetic Philippine Peso',
            syntheticSymbol: 'jPHP',
            umaPriceFeedIdentifier: 'PHPUSD',
            jarvisPriceFeedIdentifier: 'PHPUSD',
            chainlinkPriceFeedIdentifier: 'PHPUSD',
            collateralRequirement: '1050000000000000000',
            startingCollateralization: '24490',
            minSponsorTokens: '0',
            isContractAllowed: true,
          } as const),
          jSGD: typeCheck<SyntheticTokenConfig>()({
            syntheticName: 'Jarvis Synthetic Singapore Dollar',
            syntheticSymbol: 'jSGD',
            umaPriceFeedIdentifier: 'SGDUSD',
            jarvisPriceFeedIdentifier: 'SGDUSD',
            chainlinkPriceFeedIdentifier: 'SGDUSD',
            collateralRequirement: '1050000000000000000',
            startingCollateralization: '920375',
            minSponsorTokens: '0',
            isContractAllowed: true,
          } as const),
          jCAD: typeCheck<SyntheticTokenConfig>()({
            syntheticName: 'Jarvis Synthetic Canadian Dollar',
            syntheticSymbol: 'jCAD',
            umaPriceFeedIdentifier: 'CADUSD',
            jarvisPriceFeedIdentifier: 'CADUSD',
            collateralRequirement: '1025000000000000000',
            startingCollateralization: '889900',
            minSponsorTokens: '0',
            isContractAllowed: true,
          } as const),
        },
      },
    },
  },
} as const);
