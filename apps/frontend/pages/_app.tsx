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
  UnsupportedNetworkModal,
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
import {
  setAuthModalVisible,
  setUnsupportedNetworkModalVisible,
} from '@/state/slices/app';
import { Terms } from '@/components/auth/flow/Terms';
import { login } from '@/state/slices/auth';
import { addressSwitch, logoutAction, networkSwitch } from '@/state/actions';
import { useFetchWalletBalancesOnNewBlock } from '@/utils/useFetchWalletBalancesOnNewBlock';
import { DEFAULT_NETWORK } from '@/utils/environment';
import { TutorialContent } from '@/components/auth/flow/ModalComponents';

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

  useRealmAgentProvider(store, subjects);
  useFetchWalletBalancesOnNewBlock(store.dispatch, subjects);

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
            <AuthProvider loginAction={login} logoutAction={logoutAction}>
              <AuthFlow<typeof store>
                notify={(notify, isMobile, title, options) =>
                  notify(title, options, isMobile ? 'global' : 'exchange')
                }
                ServiceSelect={ServiceSelect}
                Welcome={Welcome}
                Terms={Terms}
                appName="jarvis"
                setAuthModalVisibleAction={setAuthModalVisible}
                setUnsupportedNetworkModalVisibleAction={
                  setUnsupportedNetworkModalVisible
                }
                addressSwitchAction={addressSwitch}
                networkSwitchAction={networkSwitch}
                defaultNetwork={DEFAULT_NETWORK}
              />
              <UnsupportedNetworkModal<typeof store>
                setUnsupportedNetworkModalVisibleAction={
                  setUnsupportedNetworkModalVisible
                }
                TutorialContent={TutorialContent}
              />
              <BackgroundPreloader backgrounds={backgroundList} />
              <MainWrapper>
                <FullScreenLoader />
                <Component {...pageProps} />
                <GDPRPopup />
              </MainWrapper>
            </AuthProvider>
          </NotificationsProvider>
        </AppThemeProvider>
      </StateProvider>
    </CoreObservablesContextProvider>
  );
}

export default MyApp;
