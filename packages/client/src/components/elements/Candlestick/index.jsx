import React, { useEffect } from "react";
import { jarvisExchangeRate } from "../../../jarvisAPI.js";

const Candlestick = ({ token }) => {

    async function getHistory() {

        try {

            const data = await jarvisExchangeRate("EURUSD", 600);
            console.log(data);

        } catch(err) {
            console.error(err);
        }
    }

    useEffect(() => {
        getHistory();
    }, []);


    return (
        
    )

};