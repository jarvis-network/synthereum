#!/usr/bin/env bash

# Usage:
#   ./check_commit_range.bash <BASE_COMMIT>..<LAST_COMMIT> './scripts/build_frontend.bash'
#
# Example 1 - verify all commits on the current branch, since the `dev` branch:
#   ./check_commit_range.bash dev..HEAD 'yarn build:contracts'
#
# Example 2 - verify all new (including amended) commits that happened since
# last push to the upstream tracking branch:
#   ./check_commit_range.bash "$(git merge-base HEAD '@{u}')..HEAD" 'yarn build:contracts'

if [ "$#" -ne 2 ]; then
  echo "Expected 2 arguments, but got: $#"
  echo "Usage: ./check_commit_range.bash <BASE_COMMIT>..<LAST_COMMIT> '<COMMAND>'"
  exit 1
fi

revision_range="$1"
command_to_run="$2"

shopt -s extglob
if [ -z "${revision_range}" ] || [ -n "${revision_range##+([!.])\.\.+([!.])}" ]; then
  echo "revision range (== '${revision_range}') was not in the expected format"
  echo "Usage: ./check_commit_range.bash <BASE_COMMIT>..<LAST_COMMIT> '<COMMAND>'"
  exit 1
fi

if [ -z "${command_to_run}" ]; then
  echo "Command to run was not not specified (empty)"
  echo "Usage: ./check_commit_range.bash <BASE_COMMIT>..<LAST_COMMIT> '<COMMAND>'"
  exit 1
fi

current_branch=$(git rev-parse --abbrev-ref HEAD)
commits_to_check=$(git rev-list --reverse "$revision_range")
commit_count="$(echo "$commits_to_check" | wc -l)"

i=1
while read -r rev; do
    progress="[${i}/${commit_count}]"
    echo "$progress Checking commit '$rev'... "
    git checkout "$rev" > /dev/null 2>&1
    if ! eval $2; then
        >&2 echo "$progress [FAIL] on commit $rev"
        git checkout "$current_branch"
        exit 1
    fi
    echo "$progress [OK] on commit $rev"
    i=$((i+1))
done < <(echo "$commits_to_check")

git checkout "$current_branch"
