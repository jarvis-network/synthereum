import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import { jarvisExchangeRate } from "./jarvisAPI.js";

import TICFactory from "@jarvis/synthereum-contracts/dist/abi/TICFactory.json";
import TIC from "@jarvis/synthereum-contracts/dist/abi/TIC.json";
import ExpiringMultiParty from "@jarvis/synthereum-contracts/dist/abi/ExpiringMultiParty.json";
import MCD_DAI from "./MCD_DAI.json";
import IERC20 from "@jarvis/synthereum-contracts/dist/abi/IERC20.json";
import dependencies from '@jarvis/synthereum-contracts/contract-dependencies.json'

import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import InputLabel from "@material-ui/core/InputLabel";

import ExchangeRates from "./ExchangeRates";
import WalletBalance from "./WalletBalance";
import OrderForm from "./OrderForm";

const defaultAssets = [
  {
    "name": "Jarvis Synthetic Euro",
    "symbol": "jEUR",
    "priceFeed": "EURUSD",
    "contract": null,
    "derivative": null,
    "price": "0",
  },
  {
    "name": "Jarvis Synthetic Swiss Franc",
    "symbol": "jCHF",
    "priceFeed": "CHFUSD",
    "contract": null,
    "derivative": null,
    "price": "0",
  },
  {
    "name": "Jarvis Synthetic British Pound",
    "symbol": "jGBP",
    "priceFeed": "GBPUSD",
    "contract": null,
    "derivative": null,
    "price": "0",
  },
  {
    "name": "Jarvis Synthetic Gold",
    "symbol": "jXAU",
    "priceFeed": "XAUUSD",
    "contract": null,
    "derivative": null,
    "price": "0",
  }
];

const useStyles = makeStyles(theme => ({
  table: {
    marginBottom: theme.spacing(4),
  },
}));

export default function Wallet(props) {
  const { className, setLoading } = props;

  const classes = useStyles();

  const context = useWeb3Context();

  const [token, setToken] = useState(0);
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
        dependencies[context.networkId].ticFactory
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
  }, [context, context.active]);

  return (
    <Grid container spacing={4} className={className}>
      <Grid item xs={12}>
        <FormControl>
          <InputLabel>Token</InputLabel>
          <Select
            value={token}
            onChange={event => setToken(event.target.value)}
          >
            {
              assets.map((asset, i) => <MenuItem key={asset.symbol} value={i}>
                {asset.name}
              </MenuItem>)
            }
          </Select>
        </FormControl>
      </Grid>

      <Grid item md={6}>
        <WalletBalance
          className={classes.table}
          assets={assets}
          syntheticTokens={syntheticTokens}
          token={token}
          dai={dai}
          lastTx={lastTx}
        />

      <OrderForm
        className={classes.table}
        assets={assets}
        token={token}
        dai={dai}
        syntheticTokens={syntheticTokens}
        setLoading={setLoading}
        setLastTx={setLastTx}
      />
      </Grid>

      <Grid item md={6}>
        <ExchangeRates className={classes.table} assets={assets} />
      </Grid>
    </Grid>
  );
}
