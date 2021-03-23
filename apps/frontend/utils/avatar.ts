import { getOrCreateElement } from '@jarvis-network/web3-utils/base/optional';

import blockies from 'ethereum-blockies';

const cache = new Map<string, string>();

export const avatar = (seed: string): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  return getOrCreateElement(cache, seed, () => {
    const icon = blockies.create({
      seed,
      // warning: due to a bug in etherum-blockies colors can't be left random
      color: '#742dd0',
      bgcolor: '#28b710',
      spotcolor: '#fff',
    });
    return icon.toDataURL('image/png');
  });
};
