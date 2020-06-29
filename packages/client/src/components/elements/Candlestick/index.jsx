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
        response.o[index],
        response.h[index],
        response.l[index],
        response.c[index]
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
          legend: "none"
        }}
        rootProps={{ "data-testid": "candlestick" }}
    />
    </Paper>
  );
};

export default Candlestick;
