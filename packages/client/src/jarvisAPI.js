const protocol = 'https';
const host = 'data.jarvis.exchange';

export function jarvisExchangeRate(priceFeed, start = 60) {
  const now = Math.floor(Date.now() / 1000);
  const params = {
    symbol: priceFeed,
    resolution: 1,
    from: now - start,
    to: now,
  };
  const query = Object.keys(params)
    .map(key => key + '=' + params[key])
    .join('&');
  const url = `${protocol}://${host}/jarvis/prices/history?${query}`;
  console.log(url);
  return fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log(data);
      const rate = priceFeed === 'USDCHF' ? 1 / data.c[0] : data.c[0];
      return rate;
    });
}
