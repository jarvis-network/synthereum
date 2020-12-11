import {
  parseInteger,
  throwError,
} from '@jarvis-network/web3-utils/base/asserts';
import { typeCheck } from '@jarvis-network/web3-utils/base/meta';
import {
  NetworkId,
  ToNetworkName,
} from '@jarvis-network/web3-utils/eth/networks';

export const supportedNetworkIds = typeCheck<NetworkId[]>()([42] as const);
export type SupportedNetworkId = typeof supportedNetworkIds[number];
export type SupportedNetworkName = ToNetworkName<SupportedNetworkId>;

export function parseSupportedNetworkId(x: unknown): SupportedNetworkId {
  const id = parseInteger(x);
  const supported = supportedNetworkIds as readonly number[];
  return supported.findIndex(s => id === s) !== -1
    ? id as SupportedNetworkId
    : throwError(
        `${x} is not a supported networkId. Supported network ids are: ` +
          `[${supportedNetworkIds}]`,
      );
}
