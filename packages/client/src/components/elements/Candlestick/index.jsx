import React, { useState, useEffect } from "react";
import moment from "moment";
import { Chart } from "react-google-charts";
import Paper from "@material-ui/core/Paper";
import Box from "@material-ui/core/Box";
import CircularProgress from '@material-ui/core/CircularProgress';
import useStyles from "./styles";
import { jarvisPriceHistory } from "../../../jarvisAPI.js";

const Candlestick = ({ symbol, days }) => {
  const classes = useStyles();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  async function getHistory() {
    setLoading(true);
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
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    getHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, symbol]);

  const Loader = () => (
    <Box justifyContent="center">
      <CircularProgress />
    </Box>
  )

  return (
    <Paper className={classes.Paper}>
      {
        loading ? (
          <Loader />
        ) : (
          <Chart
            width={"100%"}
            height={400}
            chartType="CandlestickChart"
            loader={<Loader />}
            data={[["day", "Low", "Opening", "Closing", "High"], ...data]}
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
                fallingColor: { strokeWidth: 0, fill: '#9A031E' },
                risingColor: { strokeWidth: 0, fill: '#31E981' }
                // fallingColor: { strokeWidth: 0, fill: '#a52714' },
                // risingColor: { strokeWidth: 0, fill: '#0f9d58' }
              }
            }}
            rootProps={{ "data-testid": "candlestick" }}
          />
        )
      }
    </Paper>
  );
};

export default Candlestick;
