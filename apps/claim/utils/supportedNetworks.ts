import { throwError } from '@jarvis-network/core-utils/dist/base/asserts';
import {
  PerTupleElement,
  typeCheck,
} from '@jarvis-network/core-utils/dist/base/meta';
import {
  NetworkId,
  ToNetworkName,
  parseNetworkId,
} from '@jarvis-network/core-utils/dist/eth/networks';

export const supportedNetworkIds = typeCheck<NetworkId[]>()([1, 42] as const);
export type SupportedNetworkIds = typeof supportedNetworkIds;
export type SupportedNetworkId = SupportedNetworkIds[number];
export type SupportedNetworkName = ToNetworkName<SupportedNetworkId>;
export type SupportedNetwork =
  | SupportedNetworkName
  | SupportedNetworkId
  | `${SupportedNetworkId}`;

export type PerNetwork<Config> = PerTupleElement<SupportedNetworkIds, Config>;

export function parseSupportedNetworkId(x: unknown): SupportedNetworkId {
  return isSupportedNetwork(x)
    ? (parseNetworkId(x) as SupportedNetworkId)
    : throwError(
        `${x} is not a supported networkId. Supported network ids are: ` +
          `[${supportedNetworkIds}]`,
      );
}

export function isSupportedNetwork(
  network: unknown,
): network is SupportedNetwork {
  try {
    return supportedNetworkIds.includes(
      parseNetworkId(network) as SupportedNetworkId,
    );
  } catch {
    return false;
  }
}
