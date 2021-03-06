#!/usr/bin/env bash
dotenv () {
  set -a
  [ -f .env ] && source .env
  set +a
}
dotenv
network=$1
echo "Starting local fork of $network blockchain..."
if [ "$network" = "kovan" ]; then
  networkId=42
elif [ "$network" = "ropsten" ]; then
  networkId=3
elif [ "$network" = "rinkeby" ]; then
  networkId=4
elif [ "$network" = "mainnet" ]; then
  networkId=1
else
  echo "Error: Network does not exist"
  exit 1
fi
echo "Network id: $networkId"

yarn ganache-cli -a 10 -p 8545 -i $networkId --chainId $networkId \
    -m "$MNEMONIC" \
    -f "https://$network.infura.io/v3/$INFURA_PROJECT_ID" \
    --keepAliveTimeout 120000 -l 12000000
