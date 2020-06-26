import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import * as serviceWorker from './serviceWorker';
import Web3Provider from 'web3-react';
import { Connectors } from 'web3-react';
import Web3 from 'web3';
import { ThemeProvider } from '@material-ui/core';
import CssBaseline from "@material-ui/core/CssBaseline";
import theme from "./theme";

const { InjectedConnector, NetworkOnlyConnector } = Connectors;

const MetaMask = new InjectedConnector();
const Infura = new NetworkOnlyConnector({
    providerURL: 'https://mainnet.infura.io/v3/e8d0916e2d8f4a57b5dd4545bd33b982'
});

const connectors = { MetaMask, Infura };

ReactDOM.render(
  <Web3Provider
    connectors={connectors}
    libraryName='web3.js'
    web3Api={Web3}
  >
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
  </Web3Provider>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
