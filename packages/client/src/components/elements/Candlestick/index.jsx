import React, { useState, useEffect } from "react";
import moment from "moment";
import { Chart } from "react-google-charts";
import { jarvisPriceHistory } from "../../../jarvisAPI.js";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";

import defaultAssets from "../../../helpers/defaultAssets";

import useStyles from "./styles";

const Candlestick = () => {
  const [symbol, setSymbol] = useState(defaultAssets[0].priceFeed);
  const [days, setDays] = useState("30");
  const [data, setData] = useState([]);
  const classes = useStyles();

  async function getHistory() {
    try {
      const start = parseInt(days) * 60 * 60 * 24;
      const response = await jarvisPriceHistory(symbol, start);
      let dataToSet = response.t.map((day, index) => [
        moment(day * 1000).format("M/D"),
        response.o[index],
        response.h[index],
        response.l[index],
        response.c[index]
      ]);
      console.log(dataToSet);
      setData(dataToSet);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    console.log(days, symbol);
    getHistory();
  }, [days, symbol]);

  return (
    <Paper className={classes.Panel}>
      <Typography variant="h6" noWrap>
        {symbol}
      </Typography>
      <Grid>
        <Grid item>
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
        <Grid item>
          <FormControl className={classes.formControl}>
            <InputLabel id="symbol-select-label">Symbol</InputLabel>
            <Select
              labelId="symbol-select-label"
              id="symbol-select"
              value={symbol}
              onChange={ev => setSymbol(ev.target.value)}
            >
              {
                  defaultAssets.map(asset => (
                    <MenuItem value={asset.priceFeed}>{asset.priceFeed}</MenuItem>
                  ))
              }
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      <Chart
        width={"100%"}
        height={400}
        chartType="CandlestickChart"
        loader={<div>Loading Chart</div>}
        data={[["day", "Opening", "High", "Low", "Closing"], ...data]}
        options={{
          legend: "none"
        }}
        rootProps={{ "data-testid": "candlestick" }}
      />
    </Paper>
  );
};

export default Candlestick;
