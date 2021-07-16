#!/usr/bin/env bash
dotenv () {
  set -a
  [ -f .env ] && source .env
  set +a
}
dotenv
network=$1
echo "Starting local fork of $network blockchain..."
if [ "$network" = "mumbai" ]; then
  networkId=80001
  networkName="polygon-mumbai"
elif [ "$network" = "polygon" ]; then
  networkId=137
  networkName="polygon-mainnet"
else
  echo "Error: Network does not exist"
  exit 1
fi
echo "Network id: $networkId"
echo "Network $networkName"

yarn ganache-cli -a 10 -p 8545 -i $networkId --chainId $networkId \
    -m "$MNEMONIC" \
    -f "https://$networkName.infura.io/v3/$INFURA_PROJECT_ID" \
    --keepAliveTimeout 120000 -l 12000000
