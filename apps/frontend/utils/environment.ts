export const getPriceFeedEndpoint = () =>
  process.env.NEXT_PUBLIC_PRICE_FEED_ROOT ||
  'ws://pricefeed-dev.jarvis.exchange:8080';

export const getFrontendSupportedAssets = () => {
  return process.env.NEXT_PUBLIC_SUPPORTED_ASSETS
    ? process.env.NEXT_PUBLIC_SUPPORTED_ASSETS.split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : null;
};
