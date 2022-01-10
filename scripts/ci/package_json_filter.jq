{
  name, version, license, packageManager, bin,
  private, workspaces, resolutions, installConfig,
  dependencies, devDependencies, peerDependencies, optionalDependencies,
  dependenciesMeta, peerDependenciesMeta
} | with_entries(select(.value != null))
