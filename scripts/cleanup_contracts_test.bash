#!/usr/bin/env bash

set -euo pipefail

git checkout HEAD -- networks
GANACHE_PGID=$(ps -eo pgid,args | grep ganache | head -1 | awk '{ print $1 }')
kill -9 -- "-${GANACHE_PGID}"
