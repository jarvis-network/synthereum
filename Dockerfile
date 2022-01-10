FROM node:16.13.1-alpine as base
RUN apk add coreutils bash jq g++ git make python3 linux-headers eudev-dev libusb-dev
WORKDIR /src

# ------------------- Copy package.json and yarn.lock files ------------------ #
FROM base as yarn_lock
COPY . .
RUN OUTDIR='/out' scripts/ci/gather_files_for_yarn_install.bash

# ------------- Builder image with all NPM dependencies installed ------------ #
FROM base as install
COPY --from=yarn_lock /out .
RUN yarn install --immutable
RUN mkdir -p /out
