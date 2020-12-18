interface IRedeemRequest {
  redeem_id: string;
  timestamp: string;
  sender: string;
  collateral_amount: [string];
  num_tokens: [string];
}
export type RedeemRequest = IRedeemRequest;
