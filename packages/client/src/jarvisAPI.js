export function jarvisExchangeRate(priceFeed) {
  const now = Math.floor(Date.now() / 1000);
  const protocol = "https";
  const host = "data.jarvis.exchange"
  const params = {
    symbol: priceFeed,
    resolution: 1,
    from: now - 60,
    to: now
  };

  const query = Object.keys(params).map(key => key + "=" + params[key]).join("&");
  const url = `${protocol}://${host}/jarvis/prices/history?${query}`;

  return fetch(url)
    .then(response => response.json())
    .then(data => {
      return data.c[0];
    });
}
