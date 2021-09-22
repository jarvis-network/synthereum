import { Contract } from 'web3-eth-contract';
import {
  SupportedNetworkId,
  SupportedNetworkName,
  SupportedSelfMintingPairExact,
  SelfMintingCollateralSymbol,
} from '@jarvis-network/synthereum-config';
import { chainlinkAggregators } from '@jarvis-network/synthereum-config/dist/data';
import { ChainlinkPair } from '@jarvis-network/synthereum-config/dist/types/config';
import { AggregatorV3Interface_Abi } from '@jarvis-network/synthereum-contracts/dist/contracts/abi';
import Web3 from 'web3';
import { create, all } from 'mathjs';

import { ToNetworkId } from '@jarvis-network/core-utils/dist/eth/networks';

import { StringAmount } from '@jarvis-network/core-utils/dist/base/big-number';

import { PriceFeedSymbols } from '../../epics/price-feed';
import { syntheticPriceExpression } from '../expressions';

const math = create(all, { number: 'BigNumber', precision: 100 });
const ether = math.bignumber!(10).pow(18);
export interface IPriceFeedInstance {
  decimals: number;
  instance: Contract;
}

const convertToDecimal = (price: string, inputDecimals: number) => {
  const decimals = math.bignumber!(inputDecimals);
  const decimalsMultiplier = math.bignumber!(10).pow(decimals);
  return math.bignumber!(price.toString()).div(decimalsMultiplier);
};

export interface IFeedDetails {
  pairs: ChainlinkPair[];
  expressionCode: math.EvalFunction;
  priceFeedInstances: IPriceFeedInstance[];
  currentPrice: StringAmount | undefined;
  // poolingInterval: ReturnType<typeof setInterval>;
}
export class ChainLinkPriceFeed<
  Net extends SupportedNetworkName = SupportedNetworkName
> {
  private feed: {
    [key in
      | SupportedSelfMintingPairExact
      | SelfMintingCollateralSymbol]?: IFeedDetails;
  } = {};

  private web3: Web3;

  private netId!: SupportedNetworkId;

  constructor({
    web3,
    symbols,
    netId,
  }: {
    web3: Web3;
    netId: ToNetworkId<Net>;
    symbols: PriceFeedSymbols[];
  }) {
    this.netId = netId;
    this.web3 = web3;
    for (const symbol of symbols) {
      this.feed[symbol] ??= {} as IFeedDetails;

      this.feed[symbol]!.expressionCode = math.parse!(
        syntheticPriceExpression[this.netId][symbol].simple,
      ).compile();

      this.feed[symbol]!.pairs = math.parse!(
        syntheticPriceExpression[this.netId][symbol].simple,
      )
        .filter(node => node.isSymbolNode)
        .map(node => node.name) as ChainlinkPair[]; // '[CADUSD ,ETHUSD, UMAETH'

      this.feed[symbol]!.priceFeedInstances = new Array<IPriceFeedInstance>(
        this.feed[symbol]!.pairs.length,
      );
    }
  }

  async init() {
    const loadedFeedSymbols = Object.entries(this.feed);
    await Promise.all(
      loadedFeedSymbols.flatMap(([symbol_, { pairs, priceFeedInstances }]) => {
        const symbol = symbol_ as
          | SupportedSelfMintingPairExact
          | SelfMintingCollateralSymbol;
        return Promise.all(
          pairs.map(async (pair: ChainlinkPair, index: number) => {
            if (!this.feed[symbol]!.priceFeedInstances[index]) {
              this.feed[symbol]!.priceFeedInstances[
                index
              ] = {} as IPriceFeedInstance;
            }
            try {
              this.feed[symbol]!.priceFeedInstances[
                index
              ].instance = new this.web3.eth.Contract(
                AggregatorV3Interface_Abi,
                chainlinkAggregators[this.netId][pair],
              );
              this.feed[symbol]!.priceFeedInstances[
                index
              ].decimals = await priceFeedInstances[index].instance.methods
                .decimals()
                .call();
            } catch (error) {
              console.log(error, `Unable to create contract instance ${pair}`);
            }
          }),
        );
      }),
    );
  }

  public async getPrice(
    symbol: PriceFeedSymbols,
  ): Promise<StringAmount | null> {
    if (this.netId !== (await this.web3.eth.net.getId())) {
      return null;
    }
    const prices: {
      [key in ChainlinkPair]?: any;
    } = {} as any;
    for (const [index, pair] of this.feed[symbol]!.pairs.entries()) {
      try {
        if (this.feed[symbol]!.priceFeedInstances[index].decimals) {
          const p = (
            await this.feed[symbol]?.priceFeedInstances[index].instance.methods // eslint-disable-line
              .latestRoundData()
              .call()
          )[1];
          prices[pair] = convertToDecimal(
            p,
            this.feed[symbol]!.priceFeedInstances[index].decimals!,
          );
        }
      } catch (err) {
        console.error(`Error getting the price of ${symbol}:`, err);
      }
    }
    if (this.feed[symbol]) {
      return this.feed[symbol]!.expressionCode.evaluate(prices)
        .mul(ether)
        .toFixed(0) as StringAmount;
    }
    return null;
  }
}
