import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import { jarvisExchangeRate } from "../../../jarvisAPI.js";

import TICFactory from "../../../contracts/TICFactory.json";
import TIC from "../../../contracts/TIC.json";
import ExpiringMultiParty from "../../../contracts/ExpiringMultiParty.json";
import MCD_DAI from "../../../MCD_DAI.json";
import IERC20 from "../../../contracts/IERC20.json";

import defaultAssets from "../../../helpers/defaultAssets";

import WalletBalance from "../../elements/WalletBalance";
import PageHeader from "../PageHeader";
import Navigation from "../Navigation";
import Pages from "../Pages";
import WalletHeader from "../WalletHeader";

import Grid from "@material-ui/core/Grid";
import useStyles from "./styles";
import Liquidity from "../../elements/Liquidity";

export default function Wallet({ setLoading }) {

  const classes = useStyles();
  const [open, setOpen] = React.useState(false);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  }

  const context = useWeb3Context();

  // const [token, setToken] = useState(0);
  const [assets, setAssets] = useState(defaultAssets);
  const [syntheticTokens, setSyntheticTokens] = useState([]);
  const [dai, setDai] = useState(null);
  // Used to refresh stale data after a transaction is made
  const [lastTx, setLastTx] = useState("");

  useEffect(() => {
    if (context.active) {
      const { library: { eth: { Contract } } } = context;

      const factory = new Contract(
        TICFactory.abi,
        TICFactory.networks[context.networkId].address
      );

      let newAssets = [...assets];
      Promise.all(newAssets.map(asset => {
        return factory.methods.symbolToTIC(asset.symbol).call();
      })).then(addresses => {
        for (let i in newAssets) {
          newAssets[i].contract = new Contract(TIC.abi, addresses[i]);
        }

        return Promise.all(newAssets.map(asset => {
          return asset.contract.methods.derivative().call();
        }));
      }).then(derivatives => {
        for (let i in newAssets) {
          newAssets[i].derivative = new Contract(ExpiringMultiParty.abi, derivatives[i]);
        }

        setAssets(newAssets)

        return Promise.all(newAssets.map(asset => {
          return asset.derivative.methods.tokenCurrency().call();
        }));
      }).then(syntheticTokens => {
        let newSyntheticTokens = [];

        for (let i in newAssets) {
          newSyntheticTokens[i] = new Contract(IERC20.abi, syntheticTokens[i]);
        }

        setSyntheticTokens(newSyntheticTokens);
      });


      Promise.all(newAssets.map(asset => {
        return jarvisExchangeRate(asset.priceFeed);
      })).then(exchangeRates => {
        for (let i in newAssets) {
          newAssets[i].price = exchangeRates[i] ? exchangeRates[i] : 0;
        }

        setAssets(newAssets)
      });

      setDai(new Contract(IERC20.abi, MCD_DAI.networks[context.networkId].address));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, context.active]);

  return (
    <div className={classes.root}>
    <Grid container>
      <Grid item md={7}>
        <PageHeader open={open} handleDrawerOpen={handleDrawerOpen} />
        <Navigation open={open} handleDrawerClose={handleDrawerClose} />
        <main className={classes.content}>
        <div className={classes.toolbar} />
          <Pages 
            assets={assets} 
            dai={dai} 
            syntheticTokens={syntheticTokens} 
            setLoading={setLoading} 
            setLastTx={setLastTx}
          />
        </main>
      </Grid>
      <Grid item md={5}>
        <WalletHeader />
        <WalletBalance
          className={classes.table}
          assets={assets}
          syntheticTokens={syntheticTokens}
          dai={dai}
          lastTx={lastTx}
        />
        <Liquidity />
      </Grid>
    </Grid>
    </div>
  );
}
