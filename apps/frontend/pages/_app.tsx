import React from 'react';
import type { AppProps /* , AppContext */ } from 'next/app';
import Head from 'next/head';
import { Provider as StateProvider } from 'react-redux';
import { BehaviorSubject } from 'rxjs';
import Web3 from 'web3';
import Onboard from 'bnc-onboard';

import {
  BackgroundPreloader,
  NotificationsProvider,
  NotificationType,
  styled,
  useIsMounted,
} from '@jarvis-network/ui';
import {
  CoreObservablesContextProvider,
  ENSHelper,
  useConstant,
  AuthFlow,
  useRealmAgentProvider,
} from '@jarvis-network/app-toolkit';

import '@/utils/consoleErrorFilter';

import { useStore } from '@/state/store';
import { AppThemeProvider } from '@/components/AppThemeProvider';
import { FullScreenLoader } from '@/components/FullScreenLoader';

import './_app.scss';
import 'react-table/react-table.css';
import type { RealmAgent } from '@jarvis-network/synthereum-contracts/dist/src/core/realm-agent';
import { GDPRPopup } from '@/components/GDPRPopup';
import { backgroundList } from '@/data/backgrounds';
import { ServiceSelect } from '@/components/auth/flow/ServiceSelect';
import { Welcome } from '@/components/auth/flow/Welcome';
import { authFactory, useAuth } from '@/utils/useAuth';
import { setAuthModalVisible } from '@/state/slices/app';
import { Terms } from '@/components/auth/flow/Terms';

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

  const store = useStore(pageProps.initialReduxState);

  useRealmAgentProvider(store, subjects);

  const isMounted = useIsMounted();
  if (!isMounted) return null;

  return (
    <CoreObservablesContextProvider value={subjects}>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover"
        />
      </Head>
      <StateProvider store={store}>
        <AppThemeProvider>
          <NotificationsProvider>
            <AuthFlow<Parameters<typeof useStore>['0']>
              notify={(notify, isMobile) =>
                notify(
                  'You have successfully signed in',
                  {
                    type: NotificationType.success,
                    icon: '👍🏻',
                  },
                  isMobile ? 'global' : 'exchange',
                )
              }
              ServiceSelect={ServiceSelect}
              Welcome={Welcome}
              Terms={Terms}
              appName="jarvis"
              authFactory={authFactory}
              useAuth={useAuth}
              setAuthModalVisibleAction={setAuthModalVisible}
            />
            <BackgroundPreloader backgrounds={backgroundList} />
            <MainWrapper>
              <FullScreenLoader />
              <Component {...pageProps} />
              <GDPRPopup />
            </MainWrapper>
          </NotificationsProvider>
        </AppThemeProvider>
      </StateProvider>
    </CoreObservablesContextProvider>
  );
}

export default MyApp;
