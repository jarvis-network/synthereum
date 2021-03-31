import { useEffect, useState } from 'react';

import { Address } from '@jarvis-network/web3-utils/eth/address';

import { useBehaviorSubject } from './useBehaviorSubject';
import { useCoreObservables } from './CoreObservablesContext';

const noop = () => undefined;

export const usePrettyName = (address: Address | null) => {
  const [name, setName] = useState<string | null>(null);
  const ens = useBehaviorSubject(useCoreObservables().ens$);

  useEffect(() => {
    if (!ens || !address) return;

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
