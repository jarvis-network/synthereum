#!/usr/bin/env bash
# Requires ETH_KOVAN_ENDPONT and ETH_WALLET_MNEMONIC env variables
# - Same variables that are required for the Truffle network configuration
GAS_LIMIT=8000000
GAS_PRICE=0x77359400

npx ganache-cli -f $ETH_KOVAN_ENDPOINT -d -m $ETH_WALLET_MNEMONIC -i 42 -b 1 -l $GAS_LIMIT --gasPrice $GAS_PRICE "$@"
