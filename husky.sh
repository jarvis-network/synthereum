#!/bin/sh
REBASING=$(git branch | grep '\* (no branch')

if [ -z "$REBASING" ]
then
  exec < /dev/tty && git cz --hook || true
fi
