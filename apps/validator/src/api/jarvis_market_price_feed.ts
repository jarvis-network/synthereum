import { URLSearchParams } from 'url';
import axios from 'axios';
import { isFinite } from "@jarvis-network/web3-utils/base/asserts";

export type OHLC = {
  o: [number] | [];
  h: [number] | [];
  l: [number] | [];
  c: [number] | [];
}

export async function getPriceFeedOhlc(priceFeed: string, requestTime: string) {
  const endpoint = 'https://data.jarvis.exchange/jarvis/prices/history';

  const query = new URLSearchParams({
    symbol: priceFeed,
    resolution: '1',
    from: (parseInt(requestTime, 10) - 60).toString(),
    to: requestTime,
  });
  const { data: ohlc } = await axios.get<OHLC>(
    `${endpoint}?${query.toString()}`,
  );
  const price = ohlc?.c?.[0];
  return isFinite(price)
    ? priceFeed === 'USDCHF'
      ? 1 / price
      : price
    : null;
}
