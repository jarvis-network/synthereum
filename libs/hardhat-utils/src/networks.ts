import type { HardhatUserConfig } from 'hardhat/config';

import {
  NetworkId,
  toNetworkName,
} from '@jarvis-network/core-utils/dist/eth/networks';

import { getInfuraEndpoint } from '@jarvis-network/core-utils/dist/apis/infura';

export function addPublicNetwork(
  config: HardhatUserConfig,
  chainId: NetworkId,
): void {
  const networkName = toNetworkName(chainId);
  config.networks ??= {};
  config.networks[networkName] = {
    chainId,
    url: process.env.RPC_URL ?? getInfuraEndpoint(chainId, 'https'),
    accounts: {
      mnemonic:
        process.env.MNEMONIC ??
        // contents are irrelevant, only used for CI builds
        'ripple ship viable club inquiry act trap draft supply type again document',
    },
    timeout: 60e3,
  };

  const port = process.env.CUSTOM_LOCAL_NODE_PORT || '8545';
  const localRpc = process.env.GITLAB_CI
    ? `http://trufflesuite-ganache-cli:${port}`
    : `http://127.0.0.1:${port}`;

  config.networks[`${networkName}_fork`] = {
    chainId,
    url: localRpc,
    timeout: 60e3,
  };
}
