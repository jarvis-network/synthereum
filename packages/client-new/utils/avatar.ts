import blockies from 'ethereum-blockies';

const cache = new Map<string, string>();

const avatar = (seed: string): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  if (cache.get(seed)) {
    return cache.get(seed);
  }

  const icon = blockies.create({
    seed,
    // warning: due to a bug in etherum-blockies colors can't be left random
    color: '#742dd0',
    bgcolor: '#28b710',
    spotcolor: '#fff',
  });
  cache.set(seed, icon.toDataURL('image/png'));
  return cache.get(seed);
};

export default avatar;
