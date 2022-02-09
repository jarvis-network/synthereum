import { HardhatUserConfig } from 'hardhat/types';

import '@nomiclabs/hardhat-etherscan';

export function addEtherscanApiKeys(config: HardhatUserConfig) {
  config.etherscan = {
    apiKey: {
      mainnet: process.env.ETHERSCAN_ETH_API_KEY,
      kovan: process.env.ETHERSCAN_ETH_API_KEY,
      ropsten: process.env.ETHERSCAN_ETH_API_KEY,
      polygon: process.env.ETHERSCAN_POLYGON_API_KEY,
      polygonMumbai: process.env.ETHERSCAN_POLYGON_API_KEY,
      bsc: process.env.ETHERSCAN_BSC_API_KEY,
      bscTestnet: process.env.ETHERSCAN_BSC_API_KEY,
      opera: process.env.ETHERSCAN_FANTOM_API_KEY,
      ftmTestnet: process.env.ETHERSCAN_FANTOM_API_KEY,
      xdai: process.env.BLOCKSCOUT_XDAI_API_KEY,
      sokol: process.env.BLOCKSCOUT_XDAI_API_KEY,
    },
  };
}
