import { typeCheck } from '@jarvis-network/web3-utils/base/meta';
import { assertIsAddress as A } from '@jarvis-network/web3-utils/eth/address';
import { ToNetworkName } from '@jarvis-network/web3-utils/eth/networks';
import { ContractDependencies, SupportedNetworkId } from '..';

export const contractDependencies = typeCheck<
  {
    [Net in SupportedNetworkId as `${Net}`]: ContractDependencies<
      ToNetworkName<Net>
    >;
  }
>()({
  '42': {
    identifierWhitelist: A<42>('0xeF9c374b7976941fCAf5e501eaB531E430463fC6'),
    finderAddress: A<42>('0xeD0169a88d267063184b0853BaAAAe66c3c154B2'),
    collateralAddress: A<42>('0xe22da380ee6B445bb8273C81944ADEB6E8450422'),
    poolRegistry: A<42>('0x963C30D1d707d2B0f3F175525Cc4a740ce3ce0C7'),
  },
} as const); // Mark as const so TS can know what networks are actually defined
