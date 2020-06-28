import React from "react";
import { Switch, Route } from "react-router-dom";

import Grid from "@material-ui/core/Grid";

import ExchangeRates from "../../elements/ExchangeRates";
import OrderForm from "../../elements/OrderForm";
import WalletBalance from "../../elements/WalletBalance";
import Liquidity from "../../elements/Liquidity";

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
        <h3>Insights</h3>
      </Route>
      <Route path="/help">
        <h3>Help</h3>
      </Route>
      <Route path="/">
        <Grid container>
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
            <Liquidity />
          </Grid>
        </Grid>
      </Route>
    </Switch>
  );
};

export default Pages;
