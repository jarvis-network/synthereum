#!/usr/bin/env bash

set -euo pipefail

YARN_LOCK_SHA256="$(sha256sum yarn.lock | awk '{ print $1; }')"

cat <<EOF
workflow:
  rules:
    - if: \$CI_MERGE_REQUEST_ID

image: '${REGISTRY}/install:${YARN_LOCK_SHA256}'

variables:
  GIT_STRATEGY: none

before_script:
  - cd /src
  - git init
  - git remote add jn $CI_PROJECT_URL
  - git fetch jn $CI_COMMIT_REF_NAME
  - git switch --discard-changes $CI_COMMIT_REF_NAME

🎨 lint:all:
  script:
    - yarn lint:all

🧪 contracts:test:
  script:
    - yarn test contracts

🚀 deploy:
  variables:
    NETLIFY_AUTH_TOKEN: '\$NETLIFY_AUTH_TOKEN'
  parallel:
    matrix:
      - TARGET: frontend
        NETLIFY_SITE_ID: '\$NETLIFY_SITE_ID_FRONTEND'
      - TARGET: borrowing
        NETLIFY_SITE_ID: '\$NETLIFY_SITE_ID_BORROWING'
      - TARGET: claim
        NETLIFY_SITE_ID: '\$NETLIFY_SITE_ID_CLAIM'
  script:
    - yarn build \$TARGET
    - yarn netlify deploy --dir "/src/apps/\$TARGET/out" --site "\$NETLIFY_SITE_ID" --auth "\$NETLIFY_AUTH_TOKEN"
EOF
