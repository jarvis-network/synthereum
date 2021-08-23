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
  networkName='kovan'
  projectId=$ETHEREUM_PROJECT_ID
elif [ "$network" = "ropsten" ]; then
  networkId=3
  networkName='ropsten'
 projectId=$ETHEREUM_PROJECT_ID
elif [ "$network" = "rinkeby" ]; then
  networkId=4
  networkName='rinkeby'
  projectId=$ETHEREUM_PROJECT_ID
elif [ "$network" = "mainnet" ]; then
  networkId=1
  networkName='mainnet'
  projectId=$ETHEREUM_PROJECT_ID
elif [ "$network" = "mumbai" ]; then
  networkId=80001
  networkName="polygon-mumbai"
  projectId=$POLYGON_PROJECT_ID
elif [ "$network" = "polygon" ]; then
  networkId=137
  networkName="polygon-mainnet"
  projectId=$POLYGON_PROJECT_ID
else
  echo "Error: Network does not exist"
  exit 1
fi
echo "Network id: $networkId"
echo "Network $networkName"

yarn ganache-cli -a 10 -p 8545 -i $networkId --chainId $networkId \
    -m "$MNEMONIC" \
    -f "https://$networkName.infura.io/v3/$projectId" \
    --keepAliveTimeout 120000 -l 12000000
