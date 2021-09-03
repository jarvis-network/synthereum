import { Contract } from 'web3-eth-contract';
import { SupportedSelfMintingPair } from '@jarvis-network/synthereum-config';
import { chainlinkAggregators } from '@jarvis-network/synthereum-config/dist/data';
import { ChainlinkPair } from '@jarvis-network/synthereum-config/dist/types/config';
import { AggregatorV3Interface_Abi } from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import Web3 from 'web3';
import math from 'mathjs';

import { syntheticPriceExpression } from '../expressions';

export interface IPriceFeedInstance {
  decimals: number;
  instance: Contract;
}

const CURRENT_NETWORK = 1;

const convertToDecimal = (price: string, inputDecimals: number) => {
  const decimals = math.bignumber(inputDecimals);
  const decimalsMultiplier = math.bignumber(10).pow(decimals);
  return math.bignumber(price.toString()).div(decimalsMultiplier);
};
export class ChainLinkPriceFeed {
  public currentPrice: BigInt | undefined;

  private priceFeeds: IPriceFeedInstance[];

  private chainLinkPriceFeedSymbol: ChainlinkPair[];

  private expressionCode: math.EvalFunction;

  private web3: Web3;

  constructor({
    web3,
    symbol,
  }: {
    web3: Web3;
    symbol: SupportedSelfMintingPair;
    mainNet?: boolean;
  }) {
    this.expressionCode = math
      .parse(syntheticPriceExpression[symbol].simple)
      .compile();

    this.chainLinkPriceFeedSymbol = math
      .parse(syntheticPriceExpression[symbol].simple)
      .filter(node => node.isSymbolNode)
      .map(node => node.name) as ChainlinkPair[];

    this.priceFeeds = new Array<IPriceFeedInstance>(
      this.chainLinkPriceFeedSymbol.length,
    );
    this.web3 = web3;

    this.init();
  }

  async init(): Promise<void> {
    const web3Instances = this.chainLinkPriceFeedSymbol.map(
      async (symbol: ChainlinkPair, index: number) => {
        if (!this.priceFeeds[index]) {
          this.priceFeeds[index] = {} as IPriceFeedInstance;
        }
        this.priceFeeds[index].instance = new this.web3.eth.Contract(
          AggregatorV3Interface_Abi,
          chainlinkAggregators[CURRENT_NETWORK][symbol],
        );
        this.priceFeeds[index].decimals = await this.priceFeeds[
          index
        ].instance.methods
          .decimals()
          .call();
      },
    );
    await Promise.all(web3Instances);
  }

  public getCurrentPrice(): BigInt | undefined {
    return this.currentPrice;
  }

  public async getPrice(): Promise<BigInt | undefined> {
    const prices = {} as any;
    const getPrices = this.chainLinkPriceFeedSymbol.map(
      async (symbol: ChainlinkPair, index: number) => {
        prices[symbol] = convertToDecimal(
          (
            await this.priceFeeds[index].instance.methods
              .latestRoundData()
              .call()
          )[1],
          this.priceFeeds[index].decimals,
        );
      },
    );
    await Promise.all(getPrices);
    this.currentPrice = this.expressionCode.evaluate(prices);
    return this.currentPrice;
  }
}
