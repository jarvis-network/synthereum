import React, { useState, useEffect } from "react";
import moment from "moment";
import { Chart } from "react-google-charts";
import Paper from "@material-ui/core/Paper";
import useStyles from "./styles";
import { jarvisPriceHistory } from "../../../jarvisAPI.js";

const Candlestick = ({ symbol, days }) => {
  const classes = useStyles();

  const [data, setData] = useState([]);

  async function getHistory() {
    try {
      const start = parseInt(days) * 60 * 60 * 24;
      console.log(symbol, days);
      const response = await jarvisPriceHistory(symbol, start);
      let dataToSet = response.t.map((day, index) => [
        moment(day * 1000).format("M/D"),
        response.l[index],
        response.o[index],
        response.c[index],
        response.h[index]
      ]);
      setData(dataToSet);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    getHistory();
  }, [days, symbol]);

  return (
    <Paper className={classes.Paper}>
      <Chart
        width={"100%"}
        height={400}
        chartType="CandlestickChart"
        loader={<div>Loading Chart</div>}
        data={[["day", "Opening", "High", "Low", "Closing"], ...data]}
        options={{
          legend: "none",
          chartArea: {
            left: 50,
            top: 50,
            bottom: 50,
            right: 50,
            width: "100%",
            height: "100%"
          },
          bar: { groupWidth: '100%' }, // Remove space between bars.
          candlestick: {
            fallingColor: { strokeWidth: 0, fill: '#a52714' }, // red
            risingColor: { strokeWidth: 0, fill: '#0f9d58' }   // green
          }
        }}
        rootProps={{ "data-testid": "candlestick" }}
      />
    </Paper>
  );
};

export default Candlestick;
