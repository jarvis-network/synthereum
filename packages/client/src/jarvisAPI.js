const protocol = 'https';
const host = 'data.jarvis.exchange';

const buildQuery = params =>
  Object.keys(params)
    .map(key => key + '=' + params[key])
    .join('&');

export function jarvisExchangeRate(priceFeed, start = 60) {
  const now = Math.floor(Date.now() / 1000);
  const params = {
    symbol: priceFeed,
    resolution: 1,
    from: now - start,
    to: now,
  };

  const url = `${protocol}://${host}/jarvis/prices/history?${buildQuery(
    params,
  )}`;
  return fetch(url)
    .then(response => response.json())
    .then(data => {
      return priceFeed === 'USDCHF' ? 1 / data.c[0] : data.c[0];
    });
}

export function jarvisPriceHistory(priceFeed, start = 60) {
  const now = Math.floor(Date.now() / 1000);
  const params = {
    symbol: priceFeed,
    resolution: '1D',
    from: now - start,
    to: now,
  };

  const url = `${protocol}://${host}/jarvis/prices/history?${buildQuery(
    params,
  )}`;

  return fetch(url)
    .then(response => response.json())
    .then(data => {
      let { o, h, l, c, t } = data;
      if (priceFeed === 'USDCHF') {
        const invert = array => array.map(x => 1 / x);
        o = invert(o);
        h = invert(h);
        l = invert(l);
        c = invert(c);
      }
      return { o, h, l, c, t };
    });
}
