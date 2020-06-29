import React, { useState, useEffect } from "react";
import moment from "moment";
import { Chart } from "react-google-charts";
import { jarvisExchangeRate } from "../../../jarvisAPI.js";

const Candlestick = () => {
  const [symbol, setSymbol] = useState("EURUSD");
  const [days, setDays] = useState(30);
  const [data, setData] = useState([]);

  async function getHistory() {
    try {
      const start = days * 60 * 60 * 24;
      const response = await jarvisExchangeRate(symbol, start);
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
    getHistory();
  }, []);

  return (
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
  );
};

export default Candlestick;
