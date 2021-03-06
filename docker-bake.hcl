variable "TAG" {
  default = "dev"
}

variable "YARN_LOCK_SHA256" {
  default = "ERROR"
}

variable "REGISTRY_NAME" {
  default = "jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo"
}

# Keep in sync with Dockerfile, apps/frontend/.env.example and below in the
# `frontend` target:
variable "NEXT_PUBLIC_ONBOARD_API_KEY" {}
variable "NEXT_PUBLIC_NETWORK_ID" {}
variable "NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET" {}
variable "NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET" {}
variable "NEXT_PUBLIC_INFURA_API_KEY" {}
variable "NEXT_PUBLIC_PORTIS_API_KEY" {}
variable "NEXT_PUBLIC_PRICE_FEED_ROOT" {}
variable "NEXT_PUBLIC_SUPPORTED_ASSETS" {}

target "install" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = [
    "${REGISTRY_NAME}/install:${YARN_LOCK_SHA256}"
  ]
  platforms = ["linux/amd64"]
  target = "install"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${YARN_LOCK_SHA256}"
  ]
  cache-to=[
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${YARN_LOCK_SHA256}"
  ]
}

target "installed-project" {
  dockerfile = "Dockerfile"
  output = ["type=docker"]
  tags = [
    "${REGISTRY_NAME}/installed-project:${TAG}"
  ]
  platforms = ["linux/amd64"]
  target = "installed-project"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${YARN_LOCK_SHA256}"
  ]
}

target "frontend" {
  dockerfile = "Dockerfile"
  output = ["type=docker"]
  tags = [
    "${REGISTRY_NAME}/frontend:${TAG}"
  ]
  platforms = ["linux/amd64"]
  args = {
    NEXT_PUBLIC_ONBOARD_API_KEY = "${NEXT_PUBLIC_ONBOARD_API_KEY}"
    NEXT_PUBLIC_NETWORK_ID = "${NEXT_PUBLIC_NETWORK_ID}"
    NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET = "${NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET}"
    NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET = "${NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET}"
    NEXT_PUBLIC_INFURA_API_KEY = "${NEXT_PUBLIC_INFURA_API_KEY}"
    NEXT_PUBLIC_PORTIS_API_KEY = "${NEXT_PUBLIC_PORTIS_API_KEY}"
    NEXT_PUBLIC_PRICE_FEED_ROOT = "${NEXT_PUBLIC_PRICE_FEED_ROOT}"
    NEXT_PUBLIC_SUPPORTED_ASSETS = "${NEXT_PUBLIC_SUPPORTED_ASSETS}"
  }
  target = "frontend"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${YARN_LOCK_SHA256}",
    "type=registry,ref=${REGISTRY_NAME}/frontend-cache:${TAG}"
  ]
}

target "borrowing" {
  dockerfile = "Dockerfile"
  output = ["type=docker"]
  tags = [
    "${REGISTRY_NAME}/borrowing:${TAG}"
  ]
  platforms = ["linux/amd64"]
  args = {
    NEXT_PUBLIC_ONBOARD_API_KEY = "${NEXT_PUBLIC_ONBOARD_API_KEY}"
    NEXT_PUBLIC_NETWORK_ID = "${NEXT_PUBLIC_NETWORK_ID}"
    NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET = "${NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET}"
    NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET = "${NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET}"
    NEXT_PUBLIC_INFURA_API_KEY = "${NEXT_PUBLIC_INFURA_API_KEY}"
    NEXT_PUBLIC_PORTIS_API_KEY = "${NEXT_PUBLIC_PORTIS_API_KEY}"
    NEXT_PUBLIC_PRICE_FEED_ROOT = "${NEXT_PUBLIC_PRICE_FEED_ROOT}"
    NEXT_PUBLIC_SUPPORTED_ASSETS = "${NEXT_PUBLIC_SUPPORTED_ASSETS}"
  }
  target = "borrowing"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${YARN_LOCK_SHA256}",
    "type=registry,ref=${REGISTRY_NAME}/borrowing-cache:${TAG}"
  ]
  cache-to= [
    "type=registry,ref=${REGISTRY_NAME}/borrowing-cache:${TAG}"
  ]
}

target "claim" {
  dockerfile = "Dockerfile"
  output = ["type=docker"]
  tags = [
    "${REGISTRY_NAME}/claim:${TAG}"
  ]
  platforms = ["linux/amd64"]
  args = {
    NEXT_PUBLIC_ONBOARD_API_KEY = "${NEXT_PUBLIC_ONBOARD_API_KEY}"
    NEXT_PUBLIC_NETWORK_ID = "${NEXT_PUBLIC_NETWORK_ID}"
    NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET = "${NEXT_PUBLIC_FORTMATIC_API_KEY_MAINNET}"
    NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET = "${NEXT_PUBLIC_FORTMATIC_API_KEY_TESTNET}"
    NEXT_PUBLIC_INFURA_API_KEY = "${NEXT_PUBLIC_INFURA_API_KEY}"
    NEXT_PUBLIC_PORTIS_API_KEY = "${NEXT_PUBLIC_PORTIS_API_KEY}"
    NEXT_PUBLIC_PRICE_FEED_ROOT = "${NEXT_PUBLIC_PRICE_FEED_ROOT}"
    NEXT_PUBLIC_SUPPORTED_ASSETS = "${NEXT_PUBLIC_SUPPORTED_ASSETS}"
  }
  target = "claim"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${YARN_LOCK_SHA256}",
    "type=registry,ref=${REGISTRY_NAME}/claim-cache:${TAG}"
  ]
  cache-to= [
    "type=registry,ref=${REGISTRY_NAME}/claim-cache:${TAG}"
  ]
}
