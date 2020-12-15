#!/usr/bin/env bash

# Usage:
#   scripts/move_env_files.bash

set -euo pipefail

if (("${BASH_VERSINFO[0]:-0}" < 4)); then
    # shellcheck disable=SC2145
    # (converting array to string is desired)
    echo "[1/4|!] Unsupported bash version: '${BASH_VERSINFO[@]}'"
    exit 1
else
    # shellcheck disable=SC2145
    echo "[1/4|>] Bash version is supported: '${BASH_VERSINFO[@]}'"
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"

declare -A folder_rename=(
    ['packages/keeper-bot-v2']='apps/validator'
    ['packages/client-new']='apps/frontend'
    ['packages/contracts']='libs/contracts'
)

for i in "${!folder_rename[@]}"
do
    srcFile="$REPO_ROOT/$i/.env"
    dstFile="$REPO_ROOT/${folder_rename[$i]}/.env"
    if [ ! -f "$srcFile" ]; then
        echo "[2/4|-] Source file '$srcFile' not found - skipping"
        continue
    elif [ -f "$dstFile" ]; then
        echo "[2/4|!] Destination file '$dstFile' exists - skipping"
        continue
    fi
    echo "[2/4|>] Moving file '$srcFile' to '$dstFile'"
    mv "$srcFile" "$dstFile"
done

echo "[3/4|>] cleaning up old node_modules and build artifacts"
yarn clean:node_modules

echo "[4/4|>] Re-installing all dependencies"
yarn i
