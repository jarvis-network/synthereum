const { INFURA_PROJECT_ID, DEV_MNEMONIC, ETHERSCAN_API_KEY } = process.env;

export const env = {
  constants: {
    BATCH_TRANSACTION_COUNT: 225,
  },
  secrets: {
    DEV_MNEMONIC,
  },
  infuraProjectId: INFURA_PROJECT_ID,
  apiKeys: {
    etherscan: ETHERSCAN_API_KEY,
  },
};
