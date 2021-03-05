import React, { useEffect, useState } from 'react';
import type { AppProps /* , AppContext */ } from 'next/app';
import Head from 'next/head';
import { Provider as StateProvider } from 'react-redux';
import { BehaviorSubject } from 'rxjs';
import Web3 from 'web3';
import Onboard from 'bnc-onboard';

import { styled } from '@jarvis-network/ui';

import '@/utils/consoleErrorFilter';

import { useStore } from '@/state/store';
import { AppThemeProvider } from '@/components/AppThemeProvider';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { AuthFlow } from '@/components/auth/AuthFlow';

import './_app.scss';
import 'react-table/react-table.css';
import { BackgroundPreloader } from '@/components/BackgroundsPreloader';
import { CoreObservablesContextProvider } from '@/utils/CoreObservablesContext';
import { useConstant } from '@/utils/useConstant';
import { getOnboardConfig } from '@/utils/onboardConfig';
import { ENSHelper } from '@/utils/ens';
import { useRealmAgentProvider } from '@/utils/useRealmAgentProvider';
import type { RealmAgent } from '@jarvis-network/synthereum-contracts/dist/src/core/realm-agent';

const MainWrapper = styled.div`
  height: 100%;
  width: 100vw;
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
`;

function MyApp({ Component, pageProps }: AppProps) {
  const subjects = useConstant({
    web3$: new BehaviorSubject<Web3 | null>(null),
    ens$: new BehaviorSubject<ENSHelper | null>(null),
    onboard$: new BehaviorSubject<ReturnType<typeof Onboard> | null>(null),
    realmAgent$: new BehaviorSubject<RealmAgent | null>(null),
  });

  useEffect(() => {
    const onboardInstance = Onboard({
      ...getOnboardConfig(),
      subscriptions: {
        wallet: wallet => {
          const web3instance = new Web3(wallet.provider);
          subjects.web3$.next(web3instance);
          const ensInstance = new ENSHelper(web3instance);
          subjects.ens$.next(ensInstance);
        },
      },
    });
    subjects.onboard$.next(onboardInstance);
  }, []);

  const store = useStore(pageProps.initialReduxState);

  useRealmAgentProvider(store, subjects.web3$, subjects.realmAgent$);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <CoreObservablesContextProvider value={subjects}>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </Head>
      <StateProvider store={store}>
        <AppThemeProvider>
          <AuthFlow />
          <BackgroundPreloader />
          <MainWrapper>
            <FullScreenLoader />
            <Component {...pageProps} />
          </MainWrapper>
        </AppThemeProvider>
      </StateProvider>
    </CoreObservablesContextProvider>
  );
}

export default MyApp;
