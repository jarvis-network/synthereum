import { useContext, useEffect, useState } from 'react';

import { ENSContext } from '@/components/auth/AuthProvider';

const noop = () => undefined;

const usePrettyName = (address: string) => {
  const [name, setName] = useState<string>(null);
  const ens = useContext(ENSContext);

  useEffect(() => {
    if (!ens) {
      return;
    }

    setName(null);
    ens
      .prettyName(address)
      .then(resolvedName => setName(resolvedName))
      .catch(noop);
  }, [ens, address]);

  return name;
};

export default usePrettyName;
