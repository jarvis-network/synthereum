import { useState, useEffect } from 'react';
import { useWeb3React } from '@web3-react/core';

import { injected } from './connectors';

export function useEagerConnect() {
  const { activate, active } = useWeb3React();

  const [tried, setTried] = useState(false);

  // on mount check if an authorized connection is alredy present and activate it in case is authorised
  useEffect(() => {
    injected.isAuthorized().then((isAuthorized: boolean) => {
      if (isAuthorized) {
        activate(injected, undefined, true).catch(() => setTried(true));
      } else {
        setTried(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!tried && active) {
      setTried(true);
    }
  }, [tried, active]);

  return tried;
}

//export function useInactiveListener(suppress: boolean = false) {}
