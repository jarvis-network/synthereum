import { AppProps } from 'next/app';
import Head from 'next/head';
import { ReactComponent as NxLogo } from '../public/nx-logo-white.svg';

import { Auth } from '../components/Auth';
import { Info } from '../components/Info';

import { Web3Provider } from '@ethersproject/providers';
import { Web3ReactProvider } from '@web3-react/core';
import './styles.css';

function getLibrary(provider) {
  return new Web3Provider(provider);
}

function CustomApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Welcome to sample-app!</title>
      </Head>
      <div className="app">
        <header className="flex">
          <NxLogo width="75" height="50" />
          <h1>Welcome to sample-app!</h1>
        </header>
        <main>
          <Web3ReactProvider getLibrary={getLibrary}>
            <Auth />
            <Info />
            <Component {...pageProps} />
          </Web3ReactProvider>
        </main>
      </div>
    </>
  );
}

export default CustomApp;
