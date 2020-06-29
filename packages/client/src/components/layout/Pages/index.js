import React from "react";
import { Switch, Route } from "react-router-dom";

import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";

import ExchangeRates from "../../elements/ExchangeRates";
import OrderForm from "../../elements/OrderForm";
import WalletBalance from "../../elements/WalletBalance";
import Liquidity from "../../elements/Liquidity";

import useStyles from "./styles";
import Insights from "./Insights";

const Pages = ({
  assets,
  dai,
  syntheticTokens,
  setLoading,
  lastTx,
  setLastTx
}) => {

  const classes = useStyles();

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
