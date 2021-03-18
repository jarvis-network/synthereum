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
  && find . -name "tsconfig*.json" -o -name "package.json" -o -name "nx.json" -o -name "workspace.json" -o -name ".eslintrc.json" | \
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
COPY --from=config_files /out .

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

# ------------------------------ Build Validator ----------------------------- #
FROM install as build-validator
WORKDIR /src
COPY --from=build-web3-utils /out  node_modules/@jarvis-network/web3-utils
COPY --from=build-contract /out node_modules/@jarvis-network/synthereum-contracts
COPY libs/validator-lib libs/validator-lib
RUN yarn nx build validator-lib
COPY apps/validator apps/validator
RUN yarn nx build validator
RUN cp -r apps/validator/dist /out

# ----------------- Build @jarvis-network/ui library ----------------- #
FROM install as build-ui
COPY libs/ui libs/ui
RUN yarn nx build ui
RUN cp -r libs/ui/dist /out && ls -lah /out

# ------------------------------ Build Frontend ------------------------------ #
FROM install as build-frontend
COPY apps/frontend apps/frontend
COPY --from=build-ui /out node_modules/@jarvis-network/ui
COPY --from=build-web3-utils /out node_modules/@jarvis-network/web3-utils
COPY --from=build-contract /out node_modules/@jarvis-network/synthereum-contracts
# Keep in sync with docker-bake.hcl and apps/frontend/.env.example
ARG NEXT_PUBLIC_ONBOARD_API_KEY
ARG NEXT_PUBLIC_NETWORK_ID
ARG NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET
ARG NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET
ARG NEXT_PUBLIC_INFURA_API_KEY
ARG NEXT_PUBLIC_PORTIS_API_KEY
ARG NEXT_PUBLIC_PRICE_FEED_ROOT
ARG NEXT_PUBLIC_SUPPORTED_ASSETS
RUN yarn nx build frontend
RUN cp -r apps/frontend/out /out

# ---------------------------------------------------------------------------- #
#                                Deploy Frontend                               #
# ---------------------------------------------------------------------------- #

FROM node:${NODE_VERSION}-alpine as frontend
RUN yarn global add netlify-cli
COPY --from=build-frontend /out /src


FROM node:${NODE_VERSION}-alpine as frontend-old
COPY --from=old-frontend /out /src

# ------------------------------ Build Borrowing ------------------------------ #
FROM install as build-borrowing
COPY apps/borrowing apps/borrowing
COPY --from=build-ui /out node_modules/@jarvis-network/ui
COPY --from=build-web3-utils /out node_modules/@jarvis-network/web3-utils
COPY --from=build-contract /out node_modules/@jarvis-network/synthereum-contracts
# Keep in sync with docker-bake.hcl and apps/borrowing/.env.example
ARG NEXT_PUBLIC_ONBOARD_API_KEY
ARG NEXT_PUBLIC_NETWORK_ID
ARG NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET
ARG NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET
ARG NEXT_PUBLIC_INFURA_API_KEY
ARG NEXT_PUBLIC_PORTIS_API_KEY
ARG NEXT_PUBLIC_PRICE_FEED_ROOT
ARG NEXT_PUBLIC_SUPPORTED_ASSETS
RUN yarn nx build borrowing
RUN cp -r apps/borrowing/out /out

# ---------------------------------------------------------------------------- #
#                                Deploy Borrowing                               #
# ---------------------------------------------------------------------------- #

FROM node:${NODE_VERSION}-alpine as borrowing
RUN yarn global add netlify-cli
COPY --from=build-borrowing /out /src


FROM node:${NODE_VERSION}-alpine as borrowing-old
COPY --from=old-borrowing /out /src

# ---------------------------------------------------------------------------- #
#                               Deploy Validator                               #
# ---------------------------------------------------------------------------- #

FROM node:${NODE_VERSION}-alpine as validator
WORKDIR /app
RUN  apk add --update --no-cache \
    ca-certificates \
    bash
COPY --from=install /production_modules/* node_modules
COPY --from=build-libs /src/node_modules/@jarvis-network node_modules/@jarvis-network
COPY --from=build-validator  /out/ .
CMD ["node", "dist/index.js"]
