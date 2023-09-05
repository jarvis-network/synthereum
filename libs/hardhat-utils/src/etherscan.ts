/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { HardhatUserConfig } from 'hardhat/types';

import '@nomiclabs/hardhat-etherscan';

export function addEtherscanApiKeys(config: HardhatUserConfig) {
  config.etherscan = {
    apiKey: {
      mainnet: process.env.ETHERSCAN_ETH_API_KEY!,
      kovan: process.env.ETHERSCAN_ETH_API_KEY!,
      ropsten: process.env.ETHERSCAN_ETH_API_KEY!,
      goerli: process.env.ETHERSCAN_ETH_API_KEY!,
      polygon: process.env.ETHERSCAN_POLYGON_API_KEY!,
      polygonMumbai: process.env.ETHERSCAN_POLYGON_API_KEY!,
      bsc: process.env.ETHERSCAN_BSC_API_KEY!,
      bscTestnet: process.env.ETHERSCAN_BSC_API_KEY!,
      opera: process.env.ETHERSCAN_FANTOM_API_KEY!,
      ftmTestnet: process.env.ETHERSCAN_FANTOM_API_KEY!,
      gnosis: process.env.BLOCKSCOUT_GNOSIS_API_KEY!,
      sokol: process.env.BLOCKSCOUT_GNOSIS_API_KEY!,
      avalancheFujiTestnet: process.env.ETHERSCAN_AVALANCHE_API_KEY!,
      avalanche: process.env.ETHERSCAN_AVALANCHE_API_KEY!,
      optimisticEthereum: process.env.OPTIMISM_API_KEY!,
      optimisticGoerli: process.env.OPTIMISM_API_KEY!,
      arbitrumGoerli: process.env.ARBITRUM_API_KEY!,
      arbitrumOne: process.env.ARBITRUM_API_KEY!,
    },
  };
}
