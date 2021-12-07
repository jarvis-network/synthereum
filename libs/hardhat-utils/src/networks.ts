import { URL } from 'url';

import type { HardhatUserConfig } from 'hardhat/config';

import {
  NetworkId,
  toNetworkName,
  isNetworkId,
} from '@jarvis-network/core-utils/dist/eth/networks';

import { throwError } from '@jarvis-network/core-utils/dist/base/asserts';
import {
  getInfuraEndpoint,
  getBSCEndpoint,
  getSokolEndpoint,
} from '@jarvis-network/core-utils/dist/apis/infura';

export function addPublicNetwork(
  config: HardhatUserConfig,
  chainId: NetworkId,
  projectId = '',
): void {
  const networkName = toNetworkName(chainId);
  config.networks ??= {};
  config.networks[networkName] = {
    chainId,
    url:
      process.env.RPC_URL ?? chainId === 77
        ? getSokolEndpoint(chainId, 'https')
        : chainId === 56 || chainId === 97
        ? getBSCEndpoint(chainId, 'https')
        : getInfuraEndpoint(chainId, 'https', projectId),
    accounts: {
      mnemonic:
        process.env.MNEMONIC ??
        // contents are irrelevant, only used for CI builds
        'ripple ship viable club inquiry act trap draft supply type again document',
    },
    timeout: 60e3,
  };

  const port = process.env.CUSTOM_LOCAL_NODE_PORT || '8545';
  const gitlabForkEnvVariable = `ETHEREUM_${networkName.toUpperCase()}_RPC`;
  const gitlabRpcUrl = process.env.GL_RPC_HOSTNAME
    ? // Connect to ganache instance in the same network as the GitLab runner:
      `http://${process.env.GL_RPC_HOSTNAME}:${port}`
    : // Connect to a third-party RPC URL:
      process.env[gitlabForkEnvVariable];

  const localRpc = process.env.GITLAB_CI
    ? gitlabRpcUrl ?? 'https://placeholder:8545'
    : `http://127.0.0.1:${port}`;

  config.networks[`${networkName}_fork`] = {
    chainId,
    url: localRpc,
    timeout: 60e3,
    accounts: {
      mnemonic:
        process.env.MNEMONIC ??
        // contents are irrelevant, only used for CI builds
        'ripple ship viable club inquiry act trap draft supply type again document',
    },
  };
}

function isValidUrl(s: string | undefined): s is string {
  try {
    const _ = new URL(s ?? '');
    return true;
  } catch (err) {
    return false;
  }
}

// set hardhat default network to a forking url if the env is specified
export function setForkingUrl(
  config: HardhatUserConfig,
  chainId: number,
  blockNumber?: number,
): void {
  if (!chainId || !isNetworkId(chainId)) {
    // User didn't specify a (valid) networkId, so
    // we won't specify a forking URL
    return;
  }
  const networkName = toNetworkName(chainId);
  const gitlabForkEnvVariable = `ETHEREUM_${networkName.toUpperCase()}_RPC`;

  const forkEnvVariable = process.env[gitlabForkEnvVariable] ?? undefined;

  if (!isValidUrl(forkEnvVariable)) {
    throwError(`'${gitlabForkEnvVariable}' is not defined, or a valid URL`);
  }

  config.networks ??= {};
  config.networks.hardhat ??= {};
  config.networks.hardhat.forking = {
    url: forkEnvVariable,
    enabled: true,
    blockNumber,
  };
  config.networks.hardhat.chainId = chainId;
  console.log(
    `'${gitlabForkEnvVariable}' env variable is specified -> updating Hardhat Network settings to:`,
    config.networks.hardhat,
  );
}
