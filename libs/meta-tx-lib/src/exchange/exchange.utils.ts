import { keccak256 } from 'web3-utils';
import { IExchangeRequest } from '../interfaces/exchange.interface';
const Web3EthAbi = require('web3-eth-abi');
export class ExchangeUtils {
  // https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/feature/uma-integration-part-2/libs/contracts/contracts/synthereum-pool/v1/PoolLib.sol#L1182
  public static versionSignature = '\x19\x01';
  // https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/feature/uma-integration-part-2/libs/contracts/contracts/synthereum-pool/v1/Pool.sol#L185
  public static EXCHANGE_TYPEHASH_TEXT =
    'ExchangeParameters(address sender,address derivativeAddr,address destPoolAddr,address destDerivativeAddr,uint256 numTokens,uint256 collateralAmount,uint256 destNumTokens,uint256 feePercentage,uint256 nonce,uint256 expiration)';
  public static EXCHANGE_TYPEHASH_HEX = keccak256(
    ExchangeUtils.EXCHANGE_TYPEHASH_TEXT,
  );
  static getMessageTypes(): string[] {
    return [
      'bytes32', // EXCHANGE_TYPEHASH_TEXT
      'address', // sender
      'address', // derivativeAddr
      'address', // destPoolAddr
      'address', // destDerivativeAddr
      'uint256', // numTokens
      'uint256', // collateralAmount
      'uint256', // destNumTokens
      'uint256', // feePercentage
      'uint256', // nonce
      'bool', // expiration
    ];
  }
  // https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/feature/uma-integration-part-2/libs/contracts/contracts/synthereum-pool/v1/PoolLib.sol#L1175
  public generateMessage({
    sender,
    derivativeAddr,
    destPoolAddr,
    destDerivativeAddr,
    numTokens,
    collateralAmount,
    destNumTokens,
    feePercentage,
    nonce,
    expiry,
  }: IExchangeRequest): string {
    const messageTypes = ExchangeUtils.getMessageTypes();
    const messageParametres = [
      ExchangeUtils.EXCHANGE_TYPEHASH_HEX,
      sender,
      derivativeAddr,
      destPoolAddr,
      destDerivativeAddr,
      numTokens,
      collateralAmount,
      destNumTokens,
      feePercentage,
      nonce,
      expiry,
    ];

    const messageBody = Web3EthAbi.encodeParameters(
      messageTypes,
      messageParametres,
    );
    return keccak256(messageBody).replace('0x', '');
  }
}
