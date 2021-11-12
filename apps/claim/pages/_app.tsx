import React from 'react';
import type { AppProps /* , AppContext */ } from 'next/app';
import Head from 'next/head';
import { Provider as StateProvider } from 'react-redux';

import {
  BackgroundPreloader,
  noop,
  NotificationsProvider,
  useIsMounted,
} from '@jarvis-network/ui';

import { AppThemeProvider } from '@/components/AppThemeProvider';
import { useStore } from '@/state/store';

import './_app.scss';
import './_onboard.scss';
import 'react-table/react-table.css';
import {
  CoreObservablesContextProvider,
  AuthFlow,
  useSubjects,
  AuthProvider,
} from '@jarvis-network/app-toolkit';
import { backgroundList } from '@/data/backgrounds';
import { ServiceSelect } from '@/components/auth/flow/ServiceSelect';
import { Welcome } from '@/components/auth/flow/Welcome';
import { Terms } from '@/components/auth/flow/Terms';
import { setAuthModalVisible } from '@/state/slices/app';
import { Header } from '@/components/header/Header';
import { Container } from '@/components/Container';

function MyApp({ Component, pageProps }: AppProps): JSX.Element | null {
  const subjects = useSubjects();

  const store = useStore(pageProps.initialReduxState);

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
            <AuthProvider>
              <AuthFlow<typeof store>
                notify={noop}
                ServiceSelect={ServiceSelect}
                Welcome={Welcome}
                Terms={Terms}
                appName="jarvis-claim"
                setAuthModalVisibleAction={setAuthModalVisible}
              />
              <BackgroundPreloader backgrounds={backgroundList} />
              <Container>
                <Component {...pageProps} />
              </Container>
              <Header />
            </AuthProvider>
          </NotificationsProvider>
        </AppThemeProvider>
      </StateProvider>
    </CoreObservablesContextProvider>
  );
}

export default MyApp;
