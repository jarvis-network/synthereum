import { assertIncludes } from '@jarvis-network/core-utils/dist/base/asserts';
import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import {
  NetworkId,
  ToNetworkName,
  parseNetworkId,
} from '@jarvis-network/core-utils/dist/eth/networks';

export const supportedNetworkIds = typeCheck<NetworkId[]>()([1, 42] as const);
export type SupportedNetworkIds = typeof supportedNetworkIds;
export type SupportedNetworkId = SupportedNetworkIds[number];
export type SupportedNetworkName = ToNetworkName<SupportedNetworkId>;

export function parseSupportedNetworkId(x: unknown): SupportedNetworkId {
  return assertIncludes(
    supportedNetworkIds,
    parseNetworkId(x),
    `${x} is not a supported networkId. Supported network ids are: ` +
      `[${supportedNetworkIds}]`,
  );
}

export function isSupportedNetwork(
  networkId: unknown,
): networkId is SupportedNetworkId {
  return supportedNetworkIds.includes(networkId as SupportedNetworkId);
}
