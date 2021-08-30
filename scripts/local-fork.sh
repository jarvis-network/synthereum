#!/usr/bin/env bash

set -euo pipefail

set -a
# shellcheck disable=SC1091
[ -f .env ] && source .env
set +a

network="${1:-}"
if [ -z "${network// }" ]; then
    echo "Error: required network name argument."
    echo "Usage:"
    echo "    ./local-fork.bash NETWORK_NAME"
    exit 1
fi

if [ "$network" = "kovan" ]; then
    networkId=42
    networkName='kovan'
elif [ "$network" = "ropsten" ]; then
    networkId=3
    networkName='ropsten'
elif [ "$network" = "rinkeby" ]; then
    networkId=4
    networkName='rinkeby'
elif [ "$network" = "mainnet" ]; then
    networkId=1
    networkName='mainnet'
elif [ "$network" = "mumbai" ]; then
    networkId=80001
    networkName="polygon-mumbai"
elif [ "$network" = "polygon" ]; then
    networkId=137
    networkName="polygon-mainnet"
else
    echo "Error: unknown network '$network'."
    exit 1
fi

echo "Starting local fork of $network blockchain..."

yarn ganache-cli -a 10 -p 8545 -i $networkId --chainId $networkId \
    -m "$MNEMONIC" \
    -f "https://$networkName.infura.io/v3/$INFURA_PROJECT_ID" \
    --keepAliveTimeout 120000 -l 12000000
