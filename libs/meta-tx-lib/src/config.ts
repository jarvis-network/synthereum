import {
  parseSupportedNetworkId,
  SupportedNetworkId,
} from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';

const { NETWORK_ID } = process.env;

export interface ENV {
  NETWORK_ID: SupportedNetworkId;
}

export const env: ENV = {
  NETWORK_ID: parseSupportedNetworkId(NETWORK_ID),
};
