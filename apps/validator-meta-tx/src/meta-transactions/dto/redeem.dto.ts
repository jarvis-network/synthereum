import {
  assertIsSyntheticSymbol,
  SyntheticSymbol,
} from '@jarvis-network/synthereum-contracts/dist/src/config/data/all-synthetic-asset-symbols';
import { assertIsAddress } from '@jarvis-network/web3-utils/eth/address';
import * as yup from 'yup';
import { ErrorGenerator } from '../../erros/generator';

export type RedeemRequestParams = {
  sender: string;
  asset: SyntheticSymbol;
  collateral_amount: string;
  num_tokens: string;
};

export const redeemRequestSchema = yup
  .object({
    sender: yup
      .string()
      .trim()
      .required(ErrorGenerator.Required<RedeemRequestParams>('sender')),
    collateral_amount: yup
      .string()
      .trim()
      .required(
        ErrorGenerator.Required<RedeemRequestParams>('collateral_amount'),
      ),
    num_tokens: yup
      .string()
      .trim()
      .required(ErrorGenerator.Required<RedeemRequestParams>('num_tokens')),
    asset: yup
      .mixed<SyntheticSymbol>()
      .required(ErrorGenerator.Required<RedeemRequestParams>('asset')),
  })
  .test(
    'sender',
    ErrorGenerator.NotValiad<RedeemRequestParams>('sender', 'eth_address'),
    (value: RedeemRequestParams) => {
      try {
        assertIsAddress(value.sender);
      } catch (error) {
        return false;
      }

      return true;
    },
  )
  .test(
    'asset',
    ErrorGenerator.NotValiad<RedeemRequestParams>('asset', 'type'),
    (value: RedeemRequestParams) => {
      try {
        assertIsSyntheticSymbol(value.sender);
      } catch (error) {
        return false;
      }

      return true;
    },
  );
