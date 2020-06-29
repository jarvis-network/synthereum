import React from "react";
import { Switch, Route } from "react-router-dom";

import Grid from "@material-ui/core/Grid";

import ExchangeRates from "../../elements/ExchangeRates";
import OrderForm from "../../elements/OrderForm";
import WalletBalance from "../../elements/WalletBalance";

import Insights from "./Insights";

const Pages = ({
  assets,
  dai,
  syntheticTokens,
  setLoading,
  lastTx,
  setLastTx
}) => {
  return (
    <Switch>
      <Route path="/exchange">
        <ExchangeRates assets={assets} />
      </Route>
      <Route path="/transactions">
        <h3>Transactions</h3>
      </Route>
      <Route path="/insights">
          <Insights />
      </Route>
      <Route path="/help">
        <h3>Help</h3>
      </Route>
      <Route path="/">
        <Grid container spacing={8}>
          <Grid item md={6}>
            <OrderForm
              assets={assets}
              dai={dai}
              syntheticTokens={syntheticTokens}
              setLoading={setLoading}
              setLastTx={setLastTx}
            />
          </Grid>
          <Grid item md={6}>
            <WalletBalance
              assets={assets}
              syntheticTokens={syntheticTokens}
              dai={dai}
              lastTx={lastTx}
            />
          </Grid>
        </Grid>
      </Route>
    </Switch>
  );
};

export default Pages;
