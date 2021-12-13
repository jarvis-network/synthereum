import { FC } from 'react';
import { AppProps } from 'next/app';
import Image from 'next/image';
import Head from 'next/head';

import NxLogo from '@/img/nx-logo-white.svg';
import './styles.css';

const CustomApp: FC<AppProps> = ({ Component, pageProps }) => (
  <>
    <Head>
      <title>Welcome to burner-wallet!</title>
    </Head>
    <div className="app">
      <header className="flex">
        <Image width="75" height="50" src={NxLogo} />
        <h1>Welcome to burner-wallet!</h1>
      </header>
      <main>
        <Component {...pageProps} />
      </main>
    </div>
  </>
);

export default CustomApp;
