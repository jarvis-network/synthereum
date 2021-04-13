import { useEffect, useState } from 'react';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import type { Asset } from '@/data/assets';

interface GraphResponse {
  data: {
    prices: {
      price: string;
      timestamp: string;
    }[];
  };
}

export interface ChartData {
  close: number;
  time: number;
}

const getQuery = (pair: string, timestampGte: number) => `{
  prices(first: 100, where: {assetPair: "${pair}", timestamp_gte: ${timestampGte}}, orderBy: timestamp, orderDirection: desc) {
    price
    timestamp
  }
}`;
const url =
  'https://api.thegraph.com/subgraphs/name/openpredict/chainlink-prices-subgraph';

const convertToGraphSymbol = (symbol: Asset['symbol']) => {
  if (symbol.startsWith('j')) {
    return symbol.substr(1);
  }
  if (symbol === 'USDC') {
    return 'USD';
  }
  return null;
};

const getPrices = async (
  from: Asset['symbol'],
  to: Asset['symbol'],
  days: number,
) => {
  const fromCurrency = convertToGraphSymbol(from);
  const toCurrency = convertToGraphSymbol(to);

  const invert = from === 'USDC';
  const pair = invert
    ? `${toCurrency}/${fromCurrency}`
    : `${fromCurrency}/${toCurrency}`;

  const timestampGte = Math.round((Date.now() - 86400000 * days) / 1000);
  const query = getQuery(pair, timestampGte);

  const rawData = (await fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  }).then(r => r.json())) as GraphResponse;

  const pricesList = rawData.data.prices.map(p => {
    let val = FPN.fromWei(`${p.price}0000000000`);
    if (invert) {
      val = new FPN(1).div(val);
    }
    return {
      close: Number(val.format(5)),
      time: Number(p.timestamp) * 1000,
    };
  });

  if (pricesList.length === 1) {
    pricesList.push({
      ...pricesList[0],
      time: pricesList[0].time - 1,
    });
  }

  return pricesList;
};

const getIndirectPrices = async (
  from: Asset['symbol'],
  to: Asset['symbol'],
  days: number,
) => {
  const [toUSD, fromUSD] = await Promise.all([
    getPrices(from, 'USDC', days),
    getPrices('USDC', to, days),
  ]);

  // Always drawing using data from pair which has more points results
  // in more precise chart but also keeps the chart "the same but inverted"
  // when from/to is inverted.
  if (toUSD.length > fromUSD.length) {
    return toUSD.map(t => {
      const matchingFrom = fromUSD.find(f => f.time <= t.time);
      const fallbackFrom = fromUSD[fromUSD.length - 1];

      return {
        ...t,
        close: t.close * (matchingFrom || fallbackFrom).close,
      };
    });
  }

  return fromUSD.map(f => {
    const matchingTo = toUSD.find(t => t.time <= f.time);
    const fallbackTo = toUSD[toUSD.length - 1];

    return {
      ...f,
      close: f.close * (matchingTo || fallbackTo).close,
    };
  });
};

export const useChartData = (
  paySymbol: Asset['symbol'] | null,
  receiveSymbol: Asset['symbol'] | null,
  days = 1,
) => {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    // setData([]);
    if (!paySymbol || !receiveSymbol) {
      return;
    }

    let isCancelled = false;

    (async () => {
      if (paySymbol !== 'USDC' && receiveSymbol !== 'USDC') {
        const twoPairsResult = await getIndirectPrices(
          paySymbol,
          receiveSymbol,
          days,
        );
        setData(twoPairsResult);
        return;
      }

      const singlePairResult = await getPrices(paySymbol, receiveSymbol, days);
      if (isCancelled) {
        return;
      }

      setData(singlePairResult);
    })();

    return () => {
      isCancelled = true;
    };
  }, [paySymbol, receiveSymbol, days]);

  return data.sort((a, b) => a.time - b.time);
};
