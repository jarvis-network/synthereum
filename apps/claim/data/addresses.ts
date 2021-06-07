import {
  Address,
  assertIsAddress as A,
} from '@jarvis-network/core-utils/dist/eth/address';
import {
  NetworkId,
  networkNameToId,
} from '@jarvis-network/core-utils/dist/eth/networks';

type SupportedNetworks = Extract<NetworkId, 42 | 1>;

export const addresses: {
  [key in SupportedNetworks]: { AerariumMilitare: Address; JRT: Address };
} = {
  [networkNameToId.mainnet]: {
    AerariumMilitare: A(
      '0xe88178d7E2363c32663Abe70e442A0FF2F8B3CCe', // TODO: Fix
    ),
    JRT: A('0x8a9c67fee641579deba04928c4bc45f66e26343a'),
  },
  [networkNameToId.kovan]: {
    AerariumMilitare: A('0x2478E5ed3C328b6c2cf2B89E445b69671a0fFD15'),
    JRT: A('0xEC8Fe8Aa79dAdcA065496b791AE1c1338DfBBED1'),
  },
} as const;
