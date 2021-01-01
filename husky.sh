#!/bin/sh

if git branch | grep -q 'no branch'; then
    git --no-pager log -1 --format=oneline
else
    exec </dev/tty && git cz --hook || true
fi
