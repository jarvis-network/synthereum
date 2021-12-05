import { FC } from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';

import { ReactComponent as NxLogo } from '../public/nx-logo-white.svg';
import './styles.css';

const CustomApp: FC<AppProps> = ({ Component, pageProps }) => (
  <>
    <Head>
      <title>Welcome to burner-wallet!</title>
    </Head>
    <div className="app">
      <header className="flex">
        <NxLogo width="75" height="50" />
        <h1>Welcome to burner-wallet!</h1>
      </header>
      <main>
        <Component {...pageProps} />
      </main>
    </div>
  </>
);

export default CustomApp;
