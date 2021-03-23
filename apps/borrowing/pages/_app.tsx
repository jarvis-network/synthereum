import React, { useEffect, useState } from 'react';
import type { AppProps /* , AppContext */ } from 'next/app';
import Head from 'next/head';

import { styled } from '@jarvis-network/ui';

import { AppThemeProvider } from '@/components/AppThemeProvider';

import './_app.scss';
import 'react-table/react-table.css';

const MainWrapper = styled.div`
  height: 100%;
  width: 100vw;
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
`;

function MyApp({ Component, pageProps }: AppProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover"
        />
      </Head>
      <AppThemeProvider>
        <MainWrapper>
          <Component {...pageProps} />
        </MainWrapper>
      </AppThemeProvider>
    </>
  );
}

export default MyApp;
