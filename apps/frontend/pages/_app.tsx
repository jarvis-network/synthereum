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
  useRealmAgentProvider,
  useSubjects,
  AuthProvider,
  BlockNumber$ContextProvider as BlockNumberObservableContextProvider,
  MulticallContextProvider,
  TransactionSpeedProvider,
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
import { useChainlinkPriceFeed } from '@/utils/chainlinkPriceFeed';
import { assertIsSupportedPoolVersion } from '@jarvis-network/synthereum-ts/dist/core/types/pools';
import { FetchWalletBalancesOnNewBlock } from '@/utils/FetchWalletBalancesOnNewBlock';
import { ExchangeContextProvider } from '@/utils/ExchangeContext';

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

  const isMounted = useIsMounted();
  if (!isMounted) return null;

  const app = (
    <TransactionSpeedProvider>
      <HooksDependingOnWeb3React
        dispatch={store.dispatch}
        subjects={subjects}
        staticProps={pageProps.pools}
      />
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
      <FetchWalletBalancesOnNewBlock />
      <BackgroundPreloader backgrounds={backgroundList} />
      <MainWrapper>
        <FullScreenLoader />
        <Component {...pageProps} />
        <GDPRPopup />
      </MainWrapper>
    </TransactionSpeedProvider>
  );

  return (
    <CoreObservablesContextProvider value={subjects}>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover"
        />

        <title>Jarvis Exchange</title>
      </Head>
      <StateProvider store={store}>
        <AppThemeProvider>
          <NotificationsProvider>
            <AuthProvider>
              <BlockNumberObservableContextProvider>
                <MulticallContextProvider>
                  <ExchangeContextProvider>{app}</ExchangeContextProvider>
                </MulticallContextProvider>
              </BlockNumberObservableContextProvider>
            </AuthProvider>
          </NotificationsProvider>
        </AppThemeProvider>
      </StateProvider>
    </CoreObservablesContextProvider>
  );
}

export default MyApp;

function HooksDependingOnWeb3React({
  dispatch,
  subjects,
  staticProps,
}: {
  dispatch: ReturnType<typeof useStore>['dispatch'];
  subjects: ReturnType<typeof useSubjects>;
  staticProps: Parameters<typeof useRealmAgentProvider>['2'];
}) {
  useChainlinkPriceFeed(dispatch);
  useRealmAgentProvider(
    assertIsSupportedPoolVersion(process.env.NEXT_PUBLIC_POOL_VERSION),
    subjects,
    staticProps,
  );

  return null;
}
