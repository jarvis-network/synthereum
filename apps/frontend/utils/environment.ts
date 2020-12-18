export const getPriceFeedRoot = () =>
  process.env.NEXT_PUBLIC_PRICE_FEED_ROOT || 'ws://localhost:7770';
