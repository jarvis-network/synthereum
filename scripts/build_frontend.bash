#!/usr/bin/env bash

set -euo pipefail

# Only build the libs if they were changed in the last commit:
if git diff-index --name-only 'HEAD~' | grep -q 'libs/'; then
    echo "libs/ modified in last commit - rebuilding"
    yarn build:contracts
else
    echo "libs/ up to date, skipping building"
fi

pushd apps/frontend
yarn build
popd

