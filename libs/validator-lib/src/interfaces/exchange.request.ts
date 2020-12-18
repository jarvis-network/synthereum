interface IExchangeRequest {
  exchange_id: string;
  timestamp: string;
  sender: string;
  dest_tic: string;
  num_tokens: [string];
  collateral_amount: [string];
  dest_num_tokens: [string];
}
export type ExchangeRequest = IExchangeRequest;
