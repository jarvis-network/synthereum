variable "TAG" {
  default = "dev"
}
variable "CTAG" {
  default = ""
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
  tags = [
    notequal("",CTAG) ?  "${REGISTRY_NAME}/base:${CTAG}":  "${REGISTRY_NAME}/base:${TAG}"
  ]
  platforms = ["linux/amd64"]
  target = "install_dep"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/base-cache:${TAG}"
  ]
  cache-to= [
    notequal("",CTAG) ? "type=registry,ref=${REGISTRY_NAME}/base-cache:${CTAG}": "type=registry,ref=${REGISTRY_NAME}/base-cache:${TAG}"
  ]
}

target "install" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = [
    notequal("",CTAG) ?  "${REGISTRY_NAME}/install:${CTAG}":  "${REGISTRY_NAME}/install:${TAG}"
  ]
  platforms = ["linux/amd64"]
  target = "install"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/base-cache:${TAG}",
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${TAG}"
  ]
  cache-to=[
    notequal("",CTAG) ? "type=registry,ref=${REGISTRY_NAME}/install-cache:${CTAG}": "type=registry,ref=${REGISTRY_NAME}/install-cache:${TAG}"
  ]
}

target "libs" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = [
    notequal("",CTAG) ?  "${REGISTRY_NAME}/libs:${CTAG}":  "${REGISTRY_NAME}/libs:${TAG}"
  ]
  platforms = ["linux/amd64"]
  target = "build-libs"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${TAG}",
    "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}"
  ]
  cache-to= [
    notequal("",CTAG) ? "type=registry,ref=${REGISTRY_NAME}/libs-cache:${CTAG}": "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}"
  ]
}


target "validator" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = [
    notequal("",CTAG) ?  "${REGISTRY_NAME}/validator:${CTAG}":  "${REGISTRY_NAME}/validator:${TAG}"
  ]
  platforms = ["linux/amd64"]
  target = "validator"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}",
    "type=registry,ref=${REGISTRY_NAME}/validator-cache:${TAG}"
  ]
  cache-to= [
    notequal("",CTAG) ? "type=registry,ref=${REGISTRY_NAME}/validator-cache:${CTAG}": "type=registry,ref=${REGISTRY_NAME}/validator-cache:${TAG}"
  ]
}

target "validator-meta-tx" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = [
    notequal("",CTAG) ?  "${REGISTRY_NAME}/validator-meta-tx:${CTAG}":  "${REGISTRY_NAME}/validator-meta-tx:${TAG}"
  ]
  platforms = ["linux/amd64"]
  target = "validator-meta-tx"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}",
    "type=registry,ref=${REGISTRY_NAME}/validator-meta-tx-cache:${TAG}"
  ]
  cache-to= [
    notequal("",CTAG) ? "type=registry,ref=${REGISTRY_NAME}/validator-meta-tx-cache:${CTAG}": "type=registry,ref=${REGISTRY_NAME}/validator-meta-tx-cache:${TAG}"
  ]
}

target "release-validator-meta-tx" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = [
    "${REGISTRY_NAME}/validator-meta-tx:${TAG}"
  ]
  platforms = ["linux/amd64"]
  target = "validator-meta-tx"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/libs-cache:${CTAG}",
    "type=registry,ref=${REGISTRY_NAME}/validator-meta-tx-cache:${CTAG}"
  ]

}


target "frontend" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = [
    notequal("",CTAG) ?  "${REGISTRY_NAME}/frontend:${CTAG}":  "${REGISTRY_NAME}/frontend:${TAG}"
  ]
  platforms = ["linux/amd64"]
  target = "frontend"
  cache-from = [
  "type=registry,ref=${REGISTRY_NAME}/frontend-cache:${TAG}",
  "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}"
  ]
  cache-to= [
    notequal("",CTAG) ? "type=registry,ref=${REGISTRY_NAME}/frontend-cache:${CTAG}": "type=registry,ref=${REGISTRY_NAME}/frontend-cache:${TAG}"
  ]
}

target "frontend-old" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = [
    notequal("",CTAG) ?  "${REGISTRY_NAME}/frontend-old:${CTAG}":  "${REGISTRY_NAME}/frontend-old:${TAG}"
  ]
  platforms = ["linux/amd64"]
  target = "frontend-old"
  cache-from = [
  "type=registry,ref=${REGISTRY_NAME}/frontend-old-cache:${TAG}",
  "type=registry,ref=${REGISTRY_NAME}/libs-cache:${TAG}"
  ]
  cache-to= [
    notequal("",CTAG) ? "type=registry,ref=${REGISTRY_NAME}/frontend-old-cache:${CTAG}": "type=registry,ref=${REGISTRY_NAME}/frontend-old-cache:${TAG}"
  ]
}
