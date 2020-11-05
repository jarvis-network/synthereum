# Enhanced version of node:lts-alpine:
ARG BASE_IMAGE=registry.gitlab.com/jarvis-network/base/container-images/node-alpine-builder

FROM ${BASE_IMAGE} as node_modules_cache
WORKDIR /src
COPY . .
RUN mkdir /out \
  && find . -name "package.json" -o -name "yarn.lock" -o -name "lerna.json" | \
    xargs cp -v --parents -t /out

FROM $BASE_IMAGE AS builder
WORKDIR /src
COPY --from=node_modules_cache /out .
RUN yarn install
# Copy the rest of the files (we already have package.json and node_modules):
COPY . .
RUN yarn run build:keeper-bot

CMD ["yarn", "run", "start:keeper-bot"]
