ARG NODE_VERSION=16.13.1

FROM node:${NODE_VERSION}-alpine as base
RUN apk add coreutils bash jq g++ git make python3 linux-headers eudev-dev libusb-dev
WORKDIR /src

# ------------------- Copy package.json and yarn.lock files ------------------ #
FROM base as yarn_lock
COPY . .
RUN mkdir /out \
  && JQ_EXPR='{ name, version, packageManager, license, private, workspaces, resolutions, dependencies, devDependencies,' \
  && JQ_EXPR="${JQ_EXPR} scripts: .scripts | { preinstall, install, postinstall } | with_entries(select(.value != null)) } | with_entries(select(.value != null))" \
  && git ls-files | grep "package.json" | tr '\n' '\0' | \
    xargs -0 -n1 sh -c 'x="/out/$1" && mkdir -p "${x%/*}" && cat "$1" | jq "'"$JQ_EXPR"'" > "$x"' -s \
  && cp .yarnrc.yml yarn.lock /out \
  && mkdir -p /out/.yarn/releases \
  && cp .yarn/releases/yarn-3.1.1.cjs /out/.yarn/releases/

# --------------- Builder image with all dependencies installed -------------- #
FROM base as install
COPY --from=yarn_lock /out .
RUN yarn install
RUN mkdir -p /out
