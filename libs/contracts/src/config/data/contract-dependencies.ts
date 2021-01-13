import { ContractDependencies, SupportedNetworkId } from '..';
import { assertIsAddress as A } from '@jarvis-network/web3-utils/eth/address';
import { typeCheck } from '@jarvis-network/web3-utils/base/meta';
import { ToNetworkName } from '@jarvis-network/web3-utils/eth/networks';

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
    poolRegistry: A<42>('0x76412228f8Ca8B5972d3c9ae3e449e3fe471196b'),
  },
} as const); // Mark as const so TS can know what networks are actually defined
