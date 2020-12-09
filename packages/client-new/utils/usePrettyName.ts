import { useContext, useEffect, useState } from 'react';

import { ENSContext } from '@/components/auth/AuthProvider';
import { Address } from '@jarvis-network/web3-utils/eth/address';

const noop = () => undefined;

export const usePrettyName = (address: Address | null) => {
  const [name, setName] = useState<string | null>(null);
  const ens = useContext(ENSContext);

  useEffect(() => {
    if (!ens || !address) {
      return () => {};
    }

    let cancelled = false;

    setName(null);
    ens
      .prettyName(address)
      .then(resolvedName => {
        if (!cancelled) {
          setName(resolvedName);
        }
      })
      .catch(noop);

    return () => {
      cancelled = true;
      setName(null);
    };
  }, [ens, address]);

  return name;
};
