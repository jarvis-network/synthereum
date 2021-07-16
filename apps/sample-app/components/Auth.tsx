import React, { useEffect, useState } from 'react';
import { formatEther } from '@ethersproject/units';

import { useWeb3React } from '@web3-react/core';
import { injected, walletconnect } from '../src/connectors';
import { useEagerConnect, useInactiveListener } from '../src/hooks';

export function Auth() {
  const context = useWeb3React();
  const {
    connector,
    library,
    chainId,
    account,
    activate,
    deactivate,
    active,
    error,
  } = context;

  const nameToConnector = {
    Injected: injected,
    WalletConnect: walletconnect,
  };

  const [ethBalance, setEthBalance] = useState();
  useEffect(() => {
    console.log(connector);
    if (library && account) {
      let active = true;

      library
        .getBalance(account)
        .then(balance => {
          if (active) {
            setEthBalance(balance);
          }
        })
        .catch(() => {
          if (active) {
            setEthBalance(null);
          }
        });

      return () => {
        active = false;
        setEthBalance(undefined);
      };
    }
  }, [library, account, chainId]);

  const generateSignInButtons = () => {
    return Object.keys(nameToConnector).map(name => {
      return (
        <>
          <br />
          <button
            key={name}
            onClick={() => {
              activate(nameToConnector[name]);
            }}
          >
            Sign in with {name === 'Injected' ? 'Metamask' : name}
          </button>
          <br />
        </>
      );
    });
  };
  return (
    <div>
      <span>Chain Id: {chainId ? chainId : 'not connected'}</span>
      <br />
      <span>
        Account:
        {account !== undefined && account !== null ? ` ${account}` : ''}
      </span>
      <br />
      <span>
        Eth Balance:
        {ethBalance !== undefined && ethBalance !== null
          ? ` ${parseFloat(formatEther(ethBalance)).toPrecision(8)}`
          : ''}
      </span>

      <br></br>
      {!active && generateSignInButtons()}
      {active && (
        <button
          key="deactivate"
          onClick={() => {
            deactivate();
          }}
        >
          Log out
        </button>
      )}
    </div>
  );
}
