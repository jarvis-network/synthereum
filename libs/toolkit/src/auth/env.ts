function parseSupportedNetworks(variable?: string) {
  if (typeof variable !== 'string') {
    throw new Error('NEXT_PUBLIC_SUPPORTED_NETWORKS is not a string');
  }
  return variable.split(',').map(id => {
    const result = parseInt(id, 10);
    if (!result) throw new Error(`Network id '${id}' is not a valid integer`);
    return result;
  });
}

export const supportedNetworkIds = parseSupportedNetworks(
  process.env.NEXT_PUBLIC_SUPPORTED_NETWORKS,
);

if (supportedNetworkIds.length === 0) {
  throw new Error('NEXT_PUBLIC_SUPPORTED_NETWORKS has 0 networks');
}
