variable "YARN_LOCK_SHA256" {}

variable "REGISTRY_NAME" {
  default = "jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo"
}

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
