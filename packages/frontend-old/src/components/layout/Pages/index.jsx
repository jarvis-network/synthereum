import React from 'react';
import { Switch, Route } from 'react-router-dom';

import Grid from '@material-ui/core/Grid';

import ExchangeRates from '../../elements/ExchangeRates';
import OrderForm from '../../elements/OrderForm';
import WalletBalance from '../../elements/WalletBalance';
import Faucet from '../../elements/Faucet';

import Insights from './Insights';
import Transactions from './Transactions';

const Pages = ({
  assets,
  collateral,
  syntheticTokens,
  setLoading,
  lastTx,
  setLastTx,
}) => {
  return (
    <Switch>
      <Route path="/exchangerates">
        <ExchangeRates assets={assets} syntheticTokens={syntheticTokens} />
      </Route>
      <Route path="/transactions">
        <Transactions assets={assets} collateral={collateral} />
      </Route>
      <Route path="/insights">
        <Insights />
      </Route>
      <Route path="/help">
        <h3>Help</h3>
      </Route>
      <Route path="/exchange">
        <Grid container spacing={8}>
          <Grid item md={5}>
            <OrderForm
              assets={assets}
              collateral={collateral}
              syntheticTokens={syntheticTokens}
              setLoading={setLoading}
              setLastTx={setLastTx}
            />
          </Grid>
          <Grid item md={7}>
            <WalletBalance
              assets={assets}
              syntheticTokens={syntheticTokens}
              collateral={collateral}
              lastTx={lastTx}
            />
          </Grid>
        </Grid>
      </Route>
      <Route path="/">
        <Faucet />
      </Route>
    </Switch>
  );
};

export default Pages;
