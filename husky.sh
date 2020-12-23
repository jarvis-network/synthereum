#!/bin/sh
exit 0
git --no-pager log -1 --format=oneline

if git branch | grep -q 'no branch' && false; then
  exec < /dev/tty && git cz --hook || true
fi
