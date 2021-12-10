#!/usr/bin/env sh

set -eu

YARN_LOCK_SHA256="${YARN_LOCK_SHA256:=$(sha256sum yarn.lock | cut -f1 -d' ')}"

cat <<EOF
default:
  image: '\${REGISTRY}/install:${YARN_LOCK_SHA256}'
  interruptible: true
  before_script:
    - cd /src
    - git init
    - git remote add jn \$CI_PROJECT_URL
    - git fetch jn \$CI_COMMIT_REF_NAME
    - git switch --discard-changes \$CI_COMMIT_REF_NAME

variables:
  GIT_STRATEGY: none

🎨 lint:all:
  script:
    - yarn lint:all
  rules:
    - if: \$CI_MERGE_REQUEST_ID

🧪:
  parallel:
    matrix:
      - TARGET: [contracts, atomic-swap, yield-farming, legacy-currency-contracts, jrt-investors]
  script:
    - yarn test \$TARGET
  rules:
    - if: \$CI_MERGE_REQUEST_ID

🧱 cli:build:
  script:
    - yarn build cli
  rules:
    - if: \$CI_MERGE_REQUEST_ID

💄 deploy:chromatic:
  script:
    - yarn nx build-storybook ui
    - yarn nx deploy-chromatic ui
  rules:
    - if: \$CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH
    - if: \$CI_MERGE_REQUEST_ID
      changes:
        - libs/ui/*

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
      - TARGET: burner-wallet
        NETLIFY_SITE_ID: '\$NETLIFY_SITE_ID_BURNER_WALLET'
  script:
    - yarn build \$TARGET
    - yarn netlify deploy --dir "/src/apps/\$TARGET/out" --site "\$NETLIFY_SITE_ID" --auth "\$NETLIFY_AUTH_TOKEN" --debug
  rules:
    - if: \$CI_MERGE_REQUEST_ID
EOF
