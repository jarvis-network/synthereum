#!/usr/bin/env bash

# This script is run manually by a developer from the repo root folder in order
# to perform the following steps:
# 1. Increment the major, minor, or patch version
# 2. Commit this change on the dev branch and tag it with `dev/vX.X.X`
# 3. Checkout a merge-dev/vX.X.X branch based on production
# 4. Merge (without fast-forward) dev into production and autofill the merge
#    commit message with data from git log
#
# Workflow:
#   ./scripts/prepare-release.bash <major|minor|patch>
#   # Now the script will either automatically open a link in your browser or
#   # will display that link, so you can manually open it, in order to create a
#   # merge request.

set -euo pipefail

NEW_VERSION_TYPE="${NEW_VERSION_TYPE:-${1:-patch}}"

if [ "${NEW_VERSION_TYPE:-}" != 'major' ] &&
   [ "${NEW_VERSION_TYPE:-}" != 'minor' ] &&
   [ "${NEW_VERSION_TYPE:-}" != 'patch' ];
then
    echo "Expected 'NEW_VERSION_TYPE' variable to be set to either" \
         "major, minor, or patch, not '$NEW_VERSION_TYPE'" >&2
    exit 1
fi

url_encode() {
    # jq should be technically sufficient, but if the title contains ()' it may
    # not be clickable in the terminal, so handle those characters specifically.
    jq -sRr @uri | sed "s/(/%28/g; s/)/%29/g; s/'/%27/g"
}

open_url() {
    URL=$1
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$URL"
    elif command -v open >/dev/null 2>&1; then
        open "$URL"
    else
        echo -e "Please open this URL to create a merge request:\n    $URL"
    fi
}

REPO_PATH='https://gitlab.com/jarvis-network/core/market/ui'
DEV_BRANCH='dev'
MASTER_BRANCH='master'

if [[ "$(git rev-parse --abbrev-ref HEAD)" != "$DEV_BRANCH" ]]; then
    git checkout "$DEV_BRANCH"
fi

OLD_VERSION=$(jq -r '.version' package.json)
OLD_VERSION_TAG="${DEV_BRANCH}/v$OLD_VERSION"

if ! git rev-parse "refs/tags/$OLD_VERSION_TAG" >/dev/null 2>&1; then
    echo "Tag '$OLD_VERSION_TAG' not found. Make sure it exists before running this script."
    exit 1
fi

yarn version "--$NEW_VERSION_TYPE"
NEW_VERSION=$(jq -r '.version' package.json)
NEW_VERSION_TAG="${DEV_BRANCH}/v$NEW_VERSION"
DEV_HEAD_COMMIT=$(git rev-parse HEAD)
REMOTE_NAME=$(git rev-parse --abbrev-ref --symbolic-full-name ${DEV_BRANCH}@{u} | grep -oP '.*(?=/)')
COMMIT_TITLE="[release]: Merge branch '${DEV_BRANCH}' @ ${DEV_HEAD_COMMIT:0:11} (${NEW_VERSION_TAG}) into $MASTER_BRANCH"
COMMIT_DESCRIPTION=$(cat << END
This includes the following commits:

$(TZ=UTC git log --reverse \
    --pretty=format:'* %h (%cd) - %s' \
    --date=format-local:'%Y-%m-%d %H:%M UTC' \
    ${OLD_VERSION_TAG}..${NEW_VERSION_TAG})
END
)
COMMIT_MESSAGE=$(echo -e "$COMMIT_TITLE\n\n$COMMIT_DESCRIPTION")

set -x
# Checkout the master branch:
if ! git rev-parse "refs/heads/$MASTER_BRANCH" >/dev/null 2>&1; then
    # Create it, if it doesn't exist, as pointing to the first commit of the
    # dev branch:
    git checkout -b "$MASTER_BRANCH" $(git log --reverse --format="%H" | head -n1)
    git push --set-upstream "$REMOTE_NAME" "$MASTER_BRANCH"
else
    git checkout "$MASTER_BRANCH"
    if ! git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
        # Set the upstream branch, if it wasn't set so far:
        git branch "--set-upstream-to=$REMOTE_NAME/$MASTER_BRANCH" "$MASTER_BRANCH"
    fi
    git pull --ff-only
fi
git checkout -b "merge-dev/v$NEW_VERSION" "$MASTER_BRANCH"
git merge --no-ff "$DEV_BRANCH" -m "$COMMIT_MESSAGE"
git tag "v$NEW_VERSION"
git push --set-upstream "$REMOTE_NAME" "merge-dev/v$NEW_VERSION"
set +x

if [ "$(echo "$COMMIT_DESCRIPTION" | url_encode | wc -c)" -gt 2000 ]; then
    COMMIT_DESCRIPTION="**Please copy & paste the description from the last commit message**"
fi

URL="$REPO_PATH/-/merge_requests"
URL+="/new?merge_request%5Bsource_branch%5D=merge-dev%2Fv$NEW_VERSION"
URL+="&merge_request%5Btarget_branch%5D=$MASTER_BRANCH"
URL+="&merge_request%5Btitle%5D=$(echo "$COMMIT_TITLE" | url_encode)"
URL+="&merge_request%5Bdescription%5D=$(echo "$COMMIT_DESCRIPTION" | url_encode)"

open_url "$URL" || echo "Please open '$URL' to create a merge request"

