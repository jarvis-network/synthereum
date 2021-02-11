#!/usr/bin/env bash
path="./dist/${1:-get-pool-balance}.js"
if [ ! -f "$path" ]; then
    echo "file '$path' doesn't exist - rebuilding"
    yarn build
fi
node --unhandled-rejections=strict "$path"
