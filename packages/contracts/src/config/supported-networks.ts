import { typeCheck } from "@jarvis-network/web3-utils/base/meta";
import { NetworkId, ToNetworkName } from "@jarvis-network/web3-utils/eth/networks";

export const supportedNetworkIds = typeCheck<NetworkId[]>()([42] as const);
export type SupportedNetworkId = typeof supportedNetworkIds[number];
export type SupportedNetworkName = ToNetworkName<SupportedNetworkId>;
