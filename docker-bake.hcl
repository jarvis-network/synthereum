variable "TAG" {
  default = "dev"
}
variable "REGISTRY_NAME" {
  default = "jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo"
}

group "default" {
  targets = ["base","install", "web3-utils", "contracts", "validator"]
}

target "base" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = ["${REGISTRY_NAME}/base:${TAG}"]
  platforms = ["linux/amd64"]
  target = "install_dep"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/base-cache:${TAG}",
    "type=registry,ref=${REGISTRY_NAME}/base-cache:latest"
  ]
  cache-to= ["type=registry,ref=${REGISTRY_NAME}/base-cache:${TAG}"]
}

target "install" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = ["${REGISTRY_NAME}/install:${TAG}"]
  platforms = ["linux/amd64"]
  target = "install"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${TAG}",
    "type=registry,ref=${REGISTRY_NAME}/base-cache:${TAG}"
  ]
  cache-to= ["type=registry,ref=${REGISTRY_NAME}/install-cache:${TAG}"]
}

target "libs" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = ["${REGISTRY_NAME}/libs:${TAG}"]
  platforms = ["linux/amd64"]
  target = "build-libs"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}",
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${TAG}"
  ]
  cache-to= ["type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}"]
}

target "web3-utils" {
  dockerfile = "Dockerfile"
  platforms = ["linux/amd64"]
  target = "build-web3-utils"
  tags = ["${REGISTRY_NAME}/web3-utils:${TAG}"]
  output = ["type=registry"]
  cache-from = [
  "type=registry,ref=${REGISTRY_NAME}/web3-utils-cache:${TAG}",
  "type=registry,ref=${REGISTRY_NAME}/base-cache:${TAG}"
  ]
  cache-to= ["type=registry,ref=${REGISTRY_NAME}/web3-utils-cache:${TAG}"]
}

target "contracts" {
  dockerfile = "Dockerfile"
  platforms = ["linux/amd64"]
  target = "build-contract"
  output = ["type=registry"]
  tags = ["${REGISTRY_NAME}/contracts:${TAG}"]
  cache-from = [
  "type=registry,ref=${REGISTRY_NAME}/contracts-cache:${TAG}",
  "type=registry,ref=${REGISTRY_NAME}/web3-utils-cache:${TAG}",
  ]
  cache-to= ["type=registry,ref=${REGISTRY_NAME}/contracts-cache:${TAG}"]
}

target "validator" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = ["${REGISTRY_NAME}/validator:${TAG}"]
  platforms = ["linux/amd64"]
  target = "validator"
  cache-from = [
  "type=registry,ref=${REGISTRY_NAME}/validator-cache:${TAG}",
  "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}",
  ]
  cache-to= ["type=registry,ref=${REGISTRY_NAME}/validator-cache:${TAG}"]
}


target "frontend" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = ["${REGISTRY_NAME}/frontend:${TAG}"]
  platforms = ["linux/amd64"]
  target = "frontend"
  cache-from = [
  "type=registry,ref=${REGISTRY_NAME}/frontend-cache:${TAG}",
  "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}",
  ]
  cache-to = ["type=registry,ref=${REGISTRY_NAME}/frontend-cache:${TAG}"]
}

target "frontend-old" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = ["${REGISTRY_NAME}/frontend-old:${TAG}"]
  platforms = ["linux/amd64"]
  target = "frontend-old"
  cache-from = [
  "type=registry,ref=${REGISTRY_NAME}/frontend-old-cache:${TAG}",
  "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}",
  ]
  cache-to = ["type=registry,ref=${REGISTRY_NAME}/frontend-old-cache:${TAG}"]
}
