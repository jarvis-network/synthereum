import React, { useEffect } from "react";
import { jarvisExchangeRate } from "../../../jarvisAPI.js";

const Candlestick = ({ token }) => {

    async function getHistory() {

        try {

            const days = 30;
            console.log(days * 60 * 60 * 24);
            const start = days * 60 * 60 * 24;
            const data = await jarvisExchangeRate("EURUSD", start);
            console.log(data);

        } catch(err) {
            console.error(err);
        }
    }

    useEffect(() => {
        getHistory();
    }, []);


    return (
    <h1>Candlestickk</h1>   
    )

};

export default Candlestick;