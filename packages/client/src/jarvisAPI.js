const protocol = 'https';
const host = 'data.jarvis.exchange';

export function jarvisExchangeRate(priceFeed, start = 60) {
  const now = Math.floor(Date.now() / 1000);
  const params = {
    symbol: priceFeed,
    resolution: start === 60 ? 1 : "1D",
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
      if (start === 60) {
        const rate = priceFeed === 'USDCHF' ? 1 / data.c[0] : data.c[0];
        return rate;
      } else {
        let { o, h, l, c} = data;
        if (priceFeed === 'USDCHF') {
          const invert = array => array.map(x => 1 / x);
          o = invert(o);
          h = invert(h);
          l = invert(l);
          c = invert(c);
        }
        return { o, h, l, c };
      }
    });
}
