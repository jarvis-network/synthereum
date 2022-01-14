#!/usr/bin/env bash

set -euo pipefail

git init "--initial-branch=$CI_COMMIT_REF_NAME"
git remote add origin "$CI_PROJECT_URL"
git fetch origin $CI_COMMIT_REF_NAME
git reset --hard "origin/$CI_COMMIT_REF_NAME"
