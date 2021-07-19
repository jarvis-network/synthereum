import React, { useEffect, useState } from 'react';
import { formatEther } from '@ethersproject/units';

import { useWeb3React } from '@web3-react/core';

export function Info() {
  const context = useWeb3React();
  const { library, chainId, account, active } = context;

  const [ethBalance, setEthBalance] = useState();
  useEffect(() => {
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

  if (active) {
    return (
      <div>
        <h1>Context information from current web3 provider </h1>
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
      </div>
    );
  } else {
    return (
      <div>
        <span>Not connected to any provider</span>
      </div>
    );
  }
}
