import React, { useEffect, useState } from 'react';
import { formatEther } from '@ethersproject/units';

import { useWeb3React } from '@web3-react/core';
import { injected, walletconnect } from '../src/connectors';
import { useEagerConnect, useInactiveListener } from '../src/hooks';

export function Auth() {
  const context = useWeb3React();
  const { activate, deactivate, active, error } = context;

  const nameToConnector = {
    Injected: injected,
    WalletConnect: walletconnect,
  };

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
