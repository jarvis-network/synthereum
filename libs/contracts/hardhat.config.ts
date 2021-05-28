import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-truffle5';
import '@nomiclabs/hardhat-web3';
import 'solidity-coverage';

import 'hardhat-gas-reporter';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import type { HardhatUserConfig } from 'hardhat/config';
import { task } from 'hardhat/config';

import { getInfuraEndpoint } from '@jarvis-network/core-utils/dist/apis/infura';
import {
  NetworkId,
  toNetworkName,
} from '@jarvis-network/core-utils/dist/eth/networks';
import {
  Config,
  generateArtifacts,
} from '@jarvis-network/sol2ts-code-gen/dist/src/full-build-pipeline';

task('test')
  .addFlag('debug', 'Compile without optimizer')
  .setAction(async (taskArgs, hre, runSuper) => {
    const { debug } = taskArgs;
    if (debug) {
      console.log(
        'Debug test mode enabled - unlimited block gas limit and contract size',
      );
      hre.config.networks.hardhat.allowUnlimitedContractSize = true;
      hre.config.networks.hardhat.blockGasLimit = 0x1fffffffffffff;
      hre.config.networks.hardhat.gas = 12000000;
    }
    await runSuper(taskArgs);
  });

task('accounts', 'Prints the list of accounts', async (_, hre) => {
  const accounts = await hre.web3.eth.getAccounts();
  console.log(accounts);
});

task(TASK_COMPILE, async (args, hre, runSuper) => {
  await runSuper();

  const distBaseDir = './dist/src/contracts';
  const srcBaseDir = './src/contracts';

  const config: Config = {
    outputPaths: {
      rootDir: hre.config.paths.root,
      abiDir: `${distBaseDir}/abi`,
      abiIndexDir: `${srcBaseDir}/abi`,
      typechainSrcDir: `${srcBaseDir}/typechain`,
      typechainDistDir: `${distBaseDir}/typechain`,
    },
    getAllFullyQualifiedNames: () => hre.artifacts.getAllFullyQualifiedNames(),
    readArtifact: filename => hre.artifacts.readArtifact(filename),
    clear: true,
    flat: true,
  };

  await generateArtifacts(config);
});

function addPublicNetwork(config: HardhatUserConfig, chainId: NetworkId) {
  const networkName = toNetworkName(chainId);
  config.networks ??= {};
  config.networks[networkName] = {
    chainId,
    url: getInfuraEndpoint(chainId, 'https'),
    accounts: {
      mnemonic: process.env.MNEMONIC,
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

export const config = {
  solidity: {
    version: '0.6.12',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    root: '.',
    sources: './contracts',
    artifacts: './artifacts',
    cache: './cache',
    tests: './test',
  },
  networks: {
    hardhat: {
      gas: 11500000,
      blockGasLimit: 11500000,
      allowUnlimitedContractSize: false,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
  mocha: {
    timeout: 1800000,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

addPublicNetwork(config, 1);
addPublicNetwork(config, 42);
addPublicNetwork(config, 4);

export default config;
