#!/usr/bin/env sh

set -eu

YARN_LOCK_SHA256="${YARN_LOCK_SHA256:=$(sha256sum yarn.lock | cut -f1 -d' ')}"

cat <<EOF
workflow:
  rules:
    - if: \$CI_MERGE_REQUEST_ID

image: '\${REGISTRY}/install:${YARN_LOCK_SHA256}'

variables:
  GIT_STRATEGY: none

before_script:
  - cd /src
  - git init
  - git remote add jn \$CI_PROJECT_URL
  - git fetch jn \$CI_COMMIT_REF_NAME
  - git switch --discard-changes \$CI_COMMIT_REF_NAME

🎨 lint:all:
  script:
    - yarn lint:all

🧪:
  parallel:
    matrix:
      - TARGET: [contracts, atomic-swap, yield-farming, legacy-currency-contracts, jrt-investors]
  script:
    - yarn test \$TARGET

🧱 cli:build:
  script:
    - yarn build cli

💄 deploy:chromatic:
  script:
    - yarn nx build-storybook ui
    - yarn nx deploy-chromatic ui
  only:
      refs:
        - merge_requests
      changes:
        - apps/libs/ui/*

🚀:
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
    - yarn netlify deploy --dir "/src/apps/\$TARGET/out" --site "\$NETLIFY_SITE_ID" --auth "\$NETLIFY_AUTH_TOKEN" --debug
EOF
