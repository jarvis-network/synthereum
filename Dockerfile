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
FROM base as install
COPY --from=yarn_lock /out .
COPY --from=config_files /out .
RUN yarn install --frozen-lock
RUN mkdir -p /out

# -------------- Project Builder image with everything installed ------------- #
FROM install as installed-project
COPY . .

# ---------------------------------------------------------------------------- #
#                                Build Frontend base                           #
# ---------------------------------------------------------------------------- #

FROM installed-project as build-frontend-base
# Keep in sync with docker-bake.hcl and apps/frontend/.env.example
ARG NEXT_PUBLIC_ONBOARD_API_KEY
ARG NEXT_PUBLIC_NETWORK_ID
ARG NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET
ARG NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET
ARG NEXT_PUBLIC_INFURA_API_KEY
ARG NEXT_PUBLIC_PORTIS_API_KEY
ARG NEXT_PUBLIC_PRICE_FEED_ROOT
ARG NEXT_PUBLIC_SUPPORTED_ASSETS

# ------------------------------ Build Frontend ------------------------------ #

FROM build-frontend-base as build-frontend
RUN yarn build frontend
RUN cp -r apps/frontend/out /out

# ------------------------------ Build Borrowing ------------------------------ #

FROM build-frontend-base as build-borrowing
RUN yarn build borrowing
RUN cp -r apps/borrowing/out /out

# ---------------------------------------------------------------------------- #
#                       Frontend deployment final images:                      #
# ---------------------------------------------------------------------------- #

# ---------------------------- Netlify base image ---------------------------- #
FROM node:${NODE_VERSION}-alpine as netlify
RUN yarn global add netlify-cli

# ------------------ Exchange frontend Netlify deploy image: ----------------- #
FROM netlify as frontend
COPY --from=build-frontend /out /src

# ----------------- Borrowing frontend Netlify deploy image: ----------------- #
FROM netlify as borrowing
COPY --from=build-borrowing /out /src

# ---------------------------------------------------------------------------- #
#                               Deploy Validator                               #
# ---------------------------------------------------------------------------- #

FROM base as prod_install
# Install only dependencies (no devDependencies)
RUN yarn install --production --frozen-lock
RUN mkdir -p /production_modules
RUN cp -r node_modules /production_modules

FROM node:${NODE_VERSION}-alpine as validator
WORKDIR /app
RUN  apk add --update --no-cache \
    ca-certificates \
    bash
COPY --from=prod_install /production_modules/* node_modules
COPY --from=build-libs /src/node_modules/@jarvis-network node_modules/@jarvis-network
COPY --from=build-validator  /out/ .
CMD ["node", "dist/index.js"]
