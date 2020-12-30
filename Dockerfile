ARG NODE_VERSION=14.15.1

FROM node:${NODE_VERSION}-alpine as core
RUN apk add coreutils
WORKDIR /src

# ------------------- Copy package.json and yarn.lock files ------------------ #
FROM core as yarn_lock
COPY . .
RUN mkdir /out \
  && find . -maxdepth 1  -name "package.json" -o -name "yarn.lock" -o -name ".npmrc" | \
    xargs cp -v --parents -t /out

# ----------------- Copy tsconfig.json and nx.dev json files ----------------- #
FROM core as config_files
COPY . .
RUN mkdir /out \
  && find . -name "tsconfig.json" -o -name "package.json" -o -name "nx.json" -o -name "workspace.json" -o -name ".eslintrc.json" | \
    xargs cp -v --parents -t /out

# ---------------------------- Base builder image ---------------------------- #
FROM node:${NODE_VERSION}-alpine as base
RUN apk add coreutils g++ git make python3 linux-headers eudev-dev libusb-dev
WORKDIR /src

#RUN yarn set version berry
#RUN yarn plugin import typescript
#RUN yarn plugin import workspace-tools
#COPY .yarnrc.yml .yarnrc.yml

# ------------------ Builder image with everything installed ----------------- #

FROM base as install_dep
COPY --from=yarn_lock /out .
# Install only dependencies (no devDependencies)
RUN yarn install --production --frozen-lock
RUN mkdir -p /production_modules
RUN cp -r node_modules /production_modules
# ---------- Builder image with everything installed + config files ---------- #
FROM install_dep as install
COPY --from=config_files /out .
# Not strictly necessary, but we do it to ensure that we get the same result as
# if we had all config files:
RUN yarn install --frozen-lock
RUN mkdir -p /out


# ----------------- Build @jarvis-network/web3-utils library ----------------- #
FROM install as build-web3-utils
COPY libs/web3-utils libs/web3-utils
RUN yarn nx build web3-utils
RUN cp -r libs/web3-utils/dist/* /out

# ------------ Build @jarvis-network/synthereum-contracts library ------------ #
FROM install as build-contract
COPY libs/contracts libs/contracts
COPY --from=build-web3-utils /out node_modules/@jarvis-network/web3-utils
RUN yarn nx build contracts
RUN cp -r libs/contracts/dist /out

# ---------------------- Image containing all libraries ---------------------- #
FROM install as build-libs
COPY --from=build-web3-utils /out  node_modules/@jarvis-network/web3-utils
COPY --from=build-contract /out node_modules/@jarvis-network/synthereum-contracts

# ------------------------------ Build Validator ----------------------------- #
FROM build-libs as build-validator
COPY apps/validator apps/validator
RUN yarn nx build validator
RUN cp -r apps/validator/dist /out

# ------------------------------ Build Frontend ------------------------------ #
FROM build-libs as build-frontend
COPY apps/frontend apps/frontend
RUN yarn nx build frontend
RUN cp -r apps/frontend/out /out

# ---------------------------- Build Old Frontend ---------------------------- #
FROM install as old-frontend
COPY packages/frontend-old packages/frontend-old
RUN yarn --cwd packages/frontend-old build
RUN cp -r packages/frontend-old/build /out

# ---------------------------------------------------------------------------- #
#                                Deploy Frontend                               #
# ---------------------------------------------------------------------------- #

FROM node:${NODE_VERSION}-alpine as frontend
COPY --from=build-frontend /out /src

FROM node:${NODE_VERSION}-alpine as frontend-old
COPY --from=old-frontend /out /src

# ---------------------------------------------------------------------------- #
#                               Deploy Validator                               #
# ---------------------------------------------------------------------------- #

FROM node:${NODE_VERSION}-alpine as validator
WORKDIR /app
RUN  apk add --update --no-cache \
    ca-certificates \
    bash
COPY --from=install /production_modules node_modules
COPY --from=build-web3-utils /out node_modules/@jarvis-network/web3-utils
COPY --from=build-contract /out node_modules/@jarvis-network/synthereum-contracts
COPY --from=build-validator  /out .

CMD ["node", "index.js"]
