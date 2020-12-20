import {
  assertIsSyntheticSymbol,
  SyntheticSymbol,
} from '@jarvis-network/synthereum-contracts/dist/src/config/data/all-synthetic-asset-symbols';
import { assertIsAddress } from '@jarvis-network/web3-utils/eth/address';
import * as yup from 'yup';
import { ErrorGenerator } from '../../erros/generator';

export type MintRequestParams = {
  sender: string;
  asset: SyntheticSymbol;
  collateral_amount: string;
  num_tokens: string;
};

export const mintRequestSchema = yup
  .object({
    sender: yup
      .string()
      .trim()
      .required(ErrorGenerator.Required<MintRequestParams>('sender')),
    collateral_amount: yup
      .string()
      .trim()
      .required(
        ErrorGenerator.Required<MintRequestParams>('collateral_amount'),
      ),
    num_tokens: yup
      .string()
      .trim()
      .required(ErrorGenerator.Required<MintRequestParams>('num_tokens')),
    asset: yup
      .mixed<SyntheticSymbol>()
      .required(ErrorGenerator.Required<MintRequestParams>('asset')),
  })
  .test(
    'sender',
    ErrorGenerator.NotValiad<MintRequestParams>('sender', 'eth_address'),
    (value: MintRequestParams) => {
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
    ErrorGenerator.NotValiad<MintRequestParams>('asset', 'type'),
    (value: MintRequestParams) => {
      try {
        assertIsSyntheticSymbol(value.sender);
      } catch (error) {
        return false;
      }

      return true;
    },
  );
