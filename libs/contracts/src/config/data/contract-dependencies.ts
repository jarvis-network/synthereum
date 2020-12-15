import { ContractDependencies, PerNetwork } from '..';
import { assertIsAddress as A } from '@jarvis-network/web3-utils/eth/address';
import { typeCheck } from '@jarvis-network/web3-utils/base/meta';

export const contractDependencies = typeCheck<PerNetwork<ContractDependencies>>()({
  '42': {
    expiringMultiPartyCreator: A('0xF763D367E1302A16716b6c40783A17c1aC754F2E'),
    tokenFactoryAddress: A('0xe7e87f89e3D15617261Fd52188Ca64803165f8Af'),
    identifierWhitelist: A('0xeF9c374b7976941fCAf5e501eaB531E430463fC6'),
    finderAddress: A('0xeD0169a88d267063184b0853BaAAAe66c3c154B2'),
    storeAddress: A('0x41AF40Eb92Bec4dD8DA77103597838b3dBBD3B6f'),
    collateralAddress: A('0xe22da380ee6B445bb8273C81944ADEB6E8450422'),
    ticFactory: A('0x176cEC0432834BaD10118902FcbfbfCe21E6b44F'),
  },
} as const); // Mark as const so TS can know what networks are actually defined
