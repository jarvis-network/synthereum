#!/usr/bin/env bash
cd "$(dirname "$0")"
./bin/synfiat-keeper --rpc-host=$RPC_HOST --eth-from=$ETH_FROM --eth-key='key_file=./hush/synfiat.json,pass_file=./hush/synfiat.pass'
