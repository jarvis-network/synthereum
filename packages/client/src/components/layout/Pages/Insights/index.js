import React, { useState, useEffect } from "react";
import Candlestick from "../../../elements/Candlestick";
import Grid from "@material-ui/core/Grid";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";

import { jarvisExchangeRate } from "../../../../jarvisAPI";
import defaultAssets from "../../../../helpers/defaultAssets";

import useStyles from "./styles";
import LatestPrice from "../../../elements/LatestPrice";

const Insights = ({}) => {

  const [symbol, setSymbol] = useState(defaultAssets[0].priceFeed);
  const [days, setDays] = useState("30");
  const [price, setPrice] = useState(0);
  const classes = useStyles();

  async function getPrice() {
    try {
      const response = await jarvisExchangeRate(symbol);
      setPrice(response);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
      getPrice();
  }, [symbol]);

  return (
    <Grid container spacing={4} justify="space-around">
      <Grid item md={8}>
        <Typography variant="h4" noWrap>
          {symbol}
        </Typography>
      </Grid>
      <Grid item md={2}>
        <FormControl className={classes.formControl}>
          <InputLabel id="days-select-label">Timeframe</InputLabel>
          <Select
            labelId="days-select-label"
            id="days-select"
            value={days}
            onChange={ev => setDays(ev.target.value)}
          >
            <MenuItem value={1}>1 Day</MenuItem>
            <MenuItem value={10}>10 Days</MenuItem>
            <MenuItem value={30}>1 Month</MenuItem>
            <MenuItem value={90}>3 Months</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item md={2}>
        <FormControl className={classes.formControl}>
          <InputLabel id="symbol-select-label">Symbol</InputLabel>
          <Select
            labelId="symbol-select-label"
            id="symbol-select"
            value={symbol}
            onChange={ev => setSymbol(ev.target.value)}
          >
            {defaultAssets.map(asset => (
              <MenuItem key={asset.priceFeed} value={asset.priceFeed}>
                {asset.priceFeed}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item md={3}>
        <LatestPrice price={price} />
      </Grid>
      <Grid item md={9}>
        <Candlestick symbol={symbol} days={days} />
      </Grid>
    </Grid>
  );
};

export default Insights;
