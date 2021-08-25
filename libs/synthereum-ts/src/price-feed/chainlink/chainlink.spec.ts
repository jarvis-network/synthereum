import { parseSupportedNetworkId } from '@jarvis-network/synthereum-config';
import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';

import { ChainLinkPriceFeed } from './index';

describe('Chainlink Price Feed', () => {
  let chainlinkPrices: ChainLinkPriceFeed;
  beforeAll(() => {
    const netId = parseSupportedNetworkId(1);
    const web3 = getInfuraWeb3(netId);
    chainlinkPrices = new ChainLinkPriceFeed({
      netId,
      web3,
      symbols: [
        'UMA',
        'USDC',
        'jEUR/UMA',
        'jGBP/UMA',
        'jCHF/UMA',
        'jEUR/USDC',
        'jGBP/USDC',
        'jCHF/USDC',
      ],
    });
  });

  it('should get the jEUR/UMA price', async () => {
    const currentPrice = await chainlinkPrices.getPrice('jEUR/UMA');
    expect(currentPrice).toBeDefined();
  });

  it('should get the jEUR/USDC price', async () => {
    const currentPrice = await chainlinkPrices.getPrice('jEUR/USDC');
    expect(currentPrice).toBeDefined();
  });

  it('should get the jGBP/UMA price', async () => {
    const currentPrice = await chainlinkPrices.getPrice('jGBP/UMA');
    expect(currentPrice).toBeDefined();
  });

  it('should get the jGBP/USDC price', async () => {
    const currentPrice = await chainlinkPrices.getPrice('jGBP/USDC');
    expect(currentPrice).toBeDefined();
  });

  it('should get the jCHF/UMA price', async () => {
    const currentPrice = await chainlinkPrices.getPrice('jCHF/UMA');
    expect(currentPrice).toBeDefined();
  });

  it('should get the jCHF/USDC price', async () => {
    const currentPrice = await chainlinkPrices.getPrice('jCHF/USDC');
    expect(currentPrice).toBeDefined();
  });

  it('should get the UMA price', async () => {
    const currentPrice = await chainlinkPrices.getPrice('UMA');
    expect(currentPrice).toBeDefined();
  });

  it('should have USDC price 1', async () => {
    const currentPrice = await chainlinkPrices.getPrice('USDC');
    expect(currentPrice?.toString()).toEqual('1');
  });
});
