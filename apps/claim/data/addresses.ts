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
    AerariumMilitare: A('0x090eE8EcBE4Ebe8938Cb5c54c023d69D2DA1cc75'),
    JRT: A('0x8a9c67fee641579deba04928c4bc45f66e26343a'),
  },
  [networkNameToId.kovan]: {
    AerariumMilitare: A('0x811F78b7d6bCF1C0E94493C2eC727B50eE32B974'),
    JRT: A('0xEC8Fe8Aa79dAdcA065496b791AE1c1338DfBBED1'),
  },
} as const;
