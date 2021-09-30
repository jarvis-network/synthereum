import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/config';
import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import { networkNameToId } from '@jarvis-network/core-utils/dist/eth/networks';

export const chainlinkAddresses = Object.freeze({
  mainnet: Object.freeze({
    EURUSD: '0xb49f677943BC038e9857d61E7d053CaA2C1734C1' as AddressOn<'mainnet'>,
    GBPUSD: '0x5c0Ab2d9b5a7ed9f470386e82BB36A3613cDd4b5' as AddressOn<'mainnet'>,
    CHFUSD: '0x449d117117838fFA61263B61dA6301AA2a88B13A' as AddressOn<'mainnet'>,
    XAUUSD: '0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6' as AddressOn<'mainnet'>,
  }),
  kovan: Object.freeze({
    EURUSD: '0x0c15Ab9A0DB086e062194c273CC79f41597Bbf13' as AddressOn<'kovan'>,
    GBPUSD: '0x28b0061f44E6A9780224AA61BEc8C3Fcb0d37de9' as AddressOn<'kovan'>,
    CHFUSD: '0xed0616BeF04D374969f302a34AE4A63882490A8C' as AddressOn<'kovan'>,
    XAUUSD: '0xc8fb5684f2707C82f28595dEaC017Bfdf44EE9c5' as AddressOn<'kovan'>,
  }),
  rinkeby: Object.freeze({
    EURUSD: '0x78F9e60608bF48a1155b4B2A5e31F32318a1d85F' as AddressOn<'rinkeby'>,
    GBPUSD: '0x7B17A813eEC55515Fb8F49F2ef51502bC54DD40F' as AddressOn<'rinkeby'>,
    CHFUSD: '0x5e601CF5EF284Bcd12decBDa189479413284E1d2' as AddressOn<'rinkeby'>,
    XAUUSD: '0x81570059A0cb83888f1459Ec66Aad1Ac16730243' as AddressOn<'rinkeby'>,
  }),
  polygon: Object.freeze({
    EURUSD: '0x73366Fe0AA0Ded304479862808e02506FE556a98' as AddressOn<'polygon'>,
    GBPUSD: '0x099a2540848573e94fb1Ca0Fa420b00acbBc845a' as AddressOn<'polygon'>,
    CHFUSD: '0xc76f762CedF0F78a439727861628E0fdfE1e70c2' as AddressOn<'polygon'>,
    XAUUSD: '0x0C466540B2ee1a31b441671eac0ca886e051E410' as AddressOn<'polygon'>,
    PHPUSD: '0x218231089Bebb2A31970c3b77E96eCfb3BA006D1' as AddressOn<'polygon'>,
  }),
  mumbai: Object.freeze({
    EURUSD: '0x876e7aa32a6f71405bd3ba5151cc6a43d15bffe6' as AddressOn<'mumbai'>,
    GBPUSD: '0x6f94eed129e6e29b19951e5b6f40c025d2348cf2' as AddressOn<'mumbai'>,
    CHFUSD: '0x1d5cbe59b8166d35eaa309045c5dd34b453eb4f3' as AddressOn<'mumbai'>,
    XAUUSD: '0xddb827c1b6b29c02532739a53d226a57381e719c' as AddressOn<'mumbai'>,
  }),
});

if (process.env.NODE_ENV === 'development') {
  type SupportedPriceFeedsArray = ['EURUSD', 'GBPUSD', 'CHFUSD', 'XAUUSD'];
  type SupportedPriceFeedsUnion = SupportedPriceFeedsArray[number];
  const supportedPriceFeeds = '' as SupportedPriceFeedsUnion;
  typeCheck<keyof typeof chainlinkAddresses['kovan']>()(supportedPriceFeeds);
  typeCheck<keyof typeof chainlinkAddresses['mainnet']>()(supportedPriceFeeds);
  typeCheck<keyof typeof chainlinkAddresses['rinkeby']>()(supportedPriceFeeds);

  type ChainlinkSupportedNetworks = keyof typeof chainlinkAddresses;
  type NetworkNameToId = typeof networkNameToId;
  const supportedNetworkId = 1 as NetworkNameToId[SupportedNetworkName];
  typeCheck<NetworkNameToId[ChainlinkSupportedNetworks]>()(supportedNetworkId);
}
