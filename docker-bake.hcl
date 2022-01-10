variable "TREE_HASH" {}

variable "REGISTRY_NAME" {
  default = "jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo"
}

target "install" {
  dockerfile = "Dockerfile"
  output = ["type=registry"]
  tags = [
    "${REGISTRY_NAME}/install:${TREE_HASH}"
  ]
  platforms = ["linux/amd64"]
  target = "install"
  cache-from = [
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${TREE_HASH}"
  ]
  cache-to=[
    "type=registry,ref=${REGISTRY_NAME}/install-cache:${TREE_HASH}"
  ]
}
