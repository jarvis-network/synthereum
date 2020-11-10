import { useContext, useEffect, useState } from 'react';

import { ENSContext } from '@/components/auth/AuthProvider';

const noop = () => undefined;

export const usePrettyName = (address: string) => {
  const [name, setName] = useState<string>(null);
  const ens = useContext(ENSContext);

  useEffect(() => {
    if (!ens) {
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
