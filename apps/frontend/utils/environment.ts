export const getPriceFeedEndpoint = () =>
  process.env.NEXT_PUBLIC_PRICE_FEED_ROOT || 'wss://pricefeed.jarvis.exchange';
