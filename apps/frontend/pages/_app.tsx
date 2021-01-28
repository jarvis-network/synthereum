import React from 'react';
import type { AppProps /* , AppContext */ } from 'next/app';
import Head from 'next/head';
import { Provider as StateProvider } from 'react-redux';

import { styled } from '@jarvis-network/ui';

import '@/utils/consoleErrorFilter';

import { useStore } from '@/state/store';
import { AppThemeProvider } from '@/components/AppThemeProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { AuthFlow } from '@/components/auth/AuthFlow';

import './_app.scss';
import 'react-table/react-table.css';

const MainWrapper = styled.div`
  height: 100%;
  width: 100vw;
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
`;

function MyApp({ Component, pageProps }: AppProps) {
  const store = useStore(pageProps.initialReduxState);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </Head>
      <StateProvider store={store}>
        <AppThemeProvider>
          <AuthProvider>
            <AuthFlow />
            <MainWrapper>
              <FullScreenLoader />
              <Component {...pageProps} />
            </MainWrapper>
          </AuthProvider>
        </AppThemeProvider>
      </StateProvider>
    </>
  );
}

export default MyApp;
