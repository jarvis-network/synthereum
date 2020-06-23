import React from "react";
import {
    Switch,
    Route,
  } from "react-router-dom";

import ExchangeRates from "../../elements/ExchangeRates";
import OrderForm from "../../elements/OrderForm";

const Pages = ({ assets, dai, syntheticTokens, setLoading, setLastTx }) => {

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
            <Route path="/settings">
                <h3>Settings</h3>
            </Route>
            <Route path="/help">
                <h3>Help</h3>
            </Route>
            <Route path="/docs">
                <h3>Documenation</h3>
            </Route>
            <Route path="/">
                <OrderForm
                  assets={assets}
                  dai={dai}
                  syntheticTokens={syntheticTokens}
                  setLoading={setLoading}
                  setLastTx={setLastTx}
                />
            </Route>
        </Switch>
    )
}

export default Pages;