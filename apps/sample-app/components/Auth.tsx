import React, { useState, useEffect } from 'react';

import { useWeb3React, UnsupportedChainIdError } from '@web3-react/core';
import {
  NoEthereumProviderError,
  UserRejectedRequestError as UserRejectedRequestErrorInjected,
} from '@web3-react/injected-connector';

import {
  injected,
  walletconnect,
  torus,
  portis,
  fortmatic,
} from '../src/connectors';
import { useEagerConnect } from '../src/hooks';

export function Auth() {
  const context = useWeb3React();
  const { activate, deactivate, active, error, connector, chainId } = context;

  const nameToConnector = {
    Metamask: injected,
    WalletConnect: walletconnect,
    Portis: portis,
    Torus: torus,
    Fortmatic: fortmatic,
  };

  // try to connect with cached provider
  // useEagerConnect()

  const errorMessage = error => {
    if (error instanceof NoEthereumProviderError) {
      return 'No Ethereum browser extension detected.';
    } else if (error instanceof UnsupportedChainIdError) {
      return 'This network is currently not supported';
    } else if (error instanceof UserRejectedRequestErrorInjected) {
      return 'Authorise this website to use your account before proceeding';
    } else {
      console.log(error);
      return 'Unknown error. Check console.';
    }
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
            Sign in with {name}
          </button>
          <br />
        </>
      );
    });
  };

  const generateSignoutButtons = () => {
    console.log(connector);
    switch (connector) {
      case portis || torus || fortmatic || walletconnect:
        return (
          <>
            <button
              key="deactivate"
              onClick={() => {
                portis.close();
              }}
            >
              Log out
            </button>

            <button
              key="change-network"
              onClick={() => {
                portis.changeNetwork(chainId === 1 ? 42 : 1);
              }}
            >
              Switch Network
            </button>
          </>
        );

      case torus:
        return (
          <>
            <button
              key="deactivate"
              onClick={() => {
                torus.close();
              }}
            >
              Log out
            </button>
          </>
        );

      case walletconnect:
        return (
          <>
            <button
              key="deactivate"
              onClick={() => {
                walletconnect.close();
              }}
            >
              Log out
            </button>
          </>
        );

      case fortmatic:
        return (
          <>
            <button
              key="deactivate"
              onClick={() => {
                fortmatic.close();
              }}
            >
              Log out
            </button>
          </>
        );

      case injected:
        return (
          <>
            <button
              key="deactivate"
              onClick={() => {
                deactivate();
              }}
            >
              Log out
            </button>
          </>
        );
    }
  };

  return (
    <div>
      <br></br>
      {!!error && <h3>{errorMessage(error)}</h3>}
      {!active && generateSignInButtons()}
      <br></br>
      {active && generateSignoutButtons()}
    </div>
  );
}
