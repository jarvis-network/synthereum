#!/usr/bin/env sh

set -euox pipefail

# First ensure there no modified files after install (such as yarn.lock):
git diff --stat --exit-code HEAD || \
    { echo -e '\n\e[41mERROR Unexpected changes after `yarn install`\e[0m\n'; exit 13; }

# Ensure the target branch exists, so `nx affected` can use it:
REMOTE_NAME=$(git remote show)
git fetch "$REMOTE_NAME" "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
git checkout "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"

# Go back to the MR branch:
git fetch "$REMOTE_NAME" "$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"
git checkout "$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"

TARGET_COMMAND="$1"

yarn nx "affected:${TARGET_COMMAND}" "--base=$CI_MERGE_REQUEST_TARGET_BRANCH_NAME" "--head=$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"
