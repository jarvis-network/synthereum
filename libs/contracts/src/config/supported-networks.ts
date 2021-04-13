import {
  assertIncludes,
  parseInteger,
} from '@jarvis-network/core-utils/dist/base/asserts';
import { typeCheck } from '@jarvis-network/core-utils/dist/base/meta';
import {
  NetworkId,
  ToNetworkName,
} from '@jarvis-network/core-utils/dist/eth/networks';

export const supportedNetworkIds = typeCheck<NetworkId[]>()([1, 42] as const);
export type SupportedNetworkIds = typeof supportedNetworkIds;
export type SupportedNetworkId = SupportedNetworkIds[number];
export type SupportedNetworkName = ToNetworkName<SupportedNetworkId>;

export function parseSupportedNetworkId(x: unknown): SupportedNetworkId {
  return assertIncludes(
    supportedNetworkIds,
    parseInteger(x),
    `${x} is not a supported networkId. Supported network ids are: ` +
      `[${supportedNetworkIds}]`,
  );
}
