#!/usr/bin/env bash

while true; do
  case "$1" in
    # Nx inserts these for some reason - skip them
    --_=*) shift ;;
    --scriptName=*) shift ;;
    --script-name) script_name="$2"; shift 2 ;;
    --script-name=*) script_name="${1:14}"; shift ;;
    --) shift; break ;;
    *) break ;;
  esac
done

path="./dist/${script_name:-get-pool-balance}.js"

if [ ! -f "$path" ]; then
    echo "file '$path' doesn't exist - rebuilding"
    yarn build
fi

node --unhandled-rejections=strict "$path" "${@}"
