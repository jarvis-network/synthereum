#!/usr/bin/env bash

# Ensure we're running inside `apps/cli`:
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

# Extract the script name argument:
while true; do
  case "$1" in
    --scriptName=*) script_name="${1:13}"; shift ;;
    --script-name) script_name="$2"; shift 2 ;;
    --script-name=*) script_name="${1:14}"; shift ;;
    *) break ;;
  esac
done

path="./dist/${script_name:-get-pool-balance}.js"

if [ ! -f "$path" ]; then
    echo "file '$path' doesn't exist - rebuilding"
    yarn build
fi

node --unhandled-rejections=strict "$path" "${@}"
