import React from 'react';
import type { AppProps /* , AppContext */ } from 'next/app';
import Head from 'next/head';
import { Provider as StateProvider } from 'react-redux';

import {
  BackgroundPreloader,
  NotificationsProvider,
  styled,
  useIsMounted,
} from '@jarvis-network/ui';
import {
  CoreObservablesContextProvider,
  AuthFlow,
  useSynthereumRealmAgentProvider,
  useSubjects,
  AuthProvider,
} from '@jarvis-network/app-toolkit';

import '@/utils/consoleErrorFilter';

import { useStore } from '@/state/store';
import { AppThemeProvider } from '@/components/AppThemeProvider';
import { FullScreenLoader } from '@/components/FullScreenLoader';

import './_app.scss';
import 'react-table/react-table.css';
import { GDPRPopup } from '@/components/GDPRPopup';
import { backgroundList } from '@/data/backgrounds';
import { ServiceSelect } from '@/components/auth/flow/ServiceSelect';
import { Welcome } from '@/components/auth/flow/Welcome';
import { setAuthModalVisible } from '@/state/slices/app';
import { Terms } from '@/components/auth/flow/Terms';
import { useFetchWalletBalancesOnNewBlock } from '@/utils/useFetchWalletBalancesOnNewBlock';
import { assertIsSupportedPoolVersion } from '@jarvis-network/synthereum-ts/dist/core/types/pools';

const MainWrapper = styled.div`
  height: 100%;
  width: 100vw;
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
`;

/*

Technical maintenance:

1. Add `import { TechnicalMaintenance } from '@/components/TechnicalMaintenance';` (don't forget about ESLint import/order)
2. Add `return <TechnicalMaintenance />;` as the first line in `MyApp`

*/

function MyApp({ Component, pageProps }: AppProps): JSX.Element | null {
  const subjects = useSubjects();

  const store = useStore(pageProps.initialReduxState);

  useFetchWalletBalancesOnNewBlock(store.dispatch, subjects);

  const isMounted = useIsMounted();
  if (!isMounted) return null;

  const app = (
    <AuthProvider>
      <Providers subjects={subjects} store={store} />
      <AuthFlow<typeof store>
        notify={(notify, isMobile, title, options) =>
          notify(title, options, isMobile ? 'global' : 'exchange')
        }
        ServiceSelect={ServiceSelect}
        Welcome={Welcome}
        Terms={Terms}
        appName="jarvis"
        setAuthModalVisibleAction={setAuthModalVisible}
      />
      <BackgroundPreloader backgrounds={backgroundList} />
      <MainWrapper>
        <FullScreenLoader />
        <Component {...pageProps} />
        <GDPRPopup />
      </MainWrapper>
    </AuthProvider>
  );

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
          <NotificationsProvider>{app}</NotificationsProvider>
        </AppThemeProvider>
      </StateProvider>
    </CoreObservablesContextProvider>
  );
}

export default MyApp;

function Providers({
  store,
  subjects,
}: {
  store: ReturnType<typeof useStore>;
  subjects: ReturnType<typeof useSubjects>;
}) {
  useSynthereumRealmAgentProvider(
    assertIsSupportedPoolVersion(process.env.NEXT_PUBLIC_POOL_VERSION),
    subjects,
  );
  useFetchWalletBalancesOnNewBlock(store.dispatch, subjects);

  return null;
}
