import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  useCoreObservables,
  useBehaviorSubject,
  useBlockNumber$Context,
  useWeb3,
} from '@jarvis-network/app-toolkit';
import { useReduxSelector } from '@/state/useReduxSelector';
import { Address } from '@jarvis-network/core-utils/dist/eth/address';
import { scaleTokenAmountToWei } from '@jarvis-network/core-utils/dist/eth/contracts/erc20';
import { assert } from '@jarvis-network/core-utils/dist/base/asserts';
import { ExchangeToken } from '@jarvis-network/synthereum-ts/dist/config';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import BN from 'bn.js';

import { updateWalletBalances } from '@/state/actions';

import { useTokenBalances, TokenBalance } from './useTokenBalances';

import { assets as assetsEthereum, assetsPolygon } from '@/data/assets';
import { addresses } from '@/data/addresses';
import { Network } from '@jarvis-network/core-utils/dist/eth/networks';

export const FetchWalletBalancesOnNewBlock = (): null => {
  const dispatch = useDispatch();
  const { chainId: networkId, account: address, library: web3 } = useWeb3();
  const blockNumber$ = useBlockNumber$Context();
  const realmAgent = useBehaviorSubject(useCoreObservables().realmAgent$);
  const assets =
    networkId === Network.polygon || networkId === Network.mumbai
      ? assetsPolygon
      : assetsEthereum;

  useEffect(() => {
    if (!web3 || !address) return;

    function update() {
      web3!.eth.getBalance(address!).then(wei => {
        dispatch(
          updateWalletBalances([
            {
              asset:
                networkId === Network.polygon || networkId === Network.mumbai
                  ? 'MATIC'
                  : 'ETH',
              amount: FPN.fromWei(wei),
            },
          ]),
        );
      });
    }

    update();

    const subscription = blockNumber$.subscribe(() => {
      update();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [blockNumber$, web3, address, dispatch, networkId]);

  const { tokenAddresses, symbols, decimals } = useMemo(() => {
    if (!realmAgent || !networkId)
      return { tokenAddresses: [], symbols: [], decimals: [] };
    const activePools = Object.values(realmAgent.activePools);
    const dexTokens = assets.filter(
      asset => !asset.collateral && !asset.synthetic && !asset.native,
    );
    return {
      tokenAddresses: [realmAgent.realm.collateralToken.address as Address]
        .concat(
          activePools
            .map(pool => pool?.syntheticToken.address as Address)
            .filter(Boolean),
        )
        .concat(
          dexTokens.map(
            token => addresses[networkId as 42][token.symbol as 'WBTC'],
          ),
        ),
      symbols: [realmAgent.realm.collateralToken.symbol as ExchangeToken]
        .concat(
          activePools
            .map(pool => pool?.symbol)
            .filter(Boolean) as ExchangeToken[],
        )
        .concat(dexTokens.map(token => token.symbol as ExchangeToken)),
      decimals: [realmAgent.realm.collateralToken.decimals]
        .concat(
          activePools
            .map(pool => pool?.syntheticToken.decimals)
            .filter(Boolean) as number[],
        )
        .concat(dexTokens.map(token => token.decimals)),
    };
  }, [realmAgent, networkId, assets]);
  console.log({ tokenAddresses, symbols, decimals, realmAgent, networkId });
  const tokenAmounts = useTokenBalances(tokenAddresses, address as any);
  console.log({ tokenAmounts });

  useEffect(() => {
    if (!tokenAmounts.length || !symbols.length || !decimals.length) return;

    assert(
      tokenAmounts.length === symbols.length,
      'tokenAmounts.length should be equal to symbols.length',
    );
    assert(
      decimals.length === symbols.length,
      'decimals.length should be equal to symbols.length',
    );

    const filteredAmounts = tokenAmounts.filter(Boolean) as TokenBalance[][];

    if (!filteredAmounts.length) return;

    dispatch(
      updateWalletBalances(
        filteredAmounts.map((amount, i) => ({
          asset: symbols[i],
          amount: new FPN(
            scaleTokenAmountToWei({
              amount: new BN(amount[0].hex.substr(2), 'hex'),
              decimals: decimals[i],
            }),
            true,
          ),
        })),
      ),
    );
  }, [tokenAmounts, symbols, decimals, dispatch]);

  return null;
};
