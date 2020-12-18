import { keccak256 } from 'web3-utils';
import { IRedeemRequest } from '../interfaces/redeem.interface';
const Web3EthAbi = require('web3-eth-abi');

export class RedeemUtils {
  // https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/feature/uma-integration-part-2/libs/contracts/contracts/synthereum-pool/v1/PoolLib.sol#L1150
  public static versionSignature = '\x19\x01';
  // https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/feature/uma-integration-part-2/libs/contracts/contracts/synthereum-pool/v1/Pool.sol#L182
  public static REDEEM_TYPEHASH_TEXT =
    'RedeemParameters(address sender,address derivativeAddr,uint256 collateralAmount,uint256 numTokens,uint256 feePercentage,uint256 nonce,uint256 expiration)';
  public static REDEEM_TYPEHASH_HEX = keccak256(
    RedeemUtils.REDEEM_TYPEHASH_TEXT,
  );
  static getMessageTypes(): string[] {
    return [
      'bytes32', // MINT_TYPEHASH_TEXT
      'address', // sender
      'address', // derivativeAddr
      'uint256', // collateralAmount
      'uint256', // numTokens
      'uint256', // feePercentage
      'uint256', // nonce
      'bool', // expiration
    ];
  }
  // https://gitlab.com/jarvis-network/apps/exchange/mono-repo/-/blob/feature/uma-integration-part-2/libs/contracts/contracts/synthereum-pool/v1/PoolLib.sol#L1143
  public generateMessage({
    sender,
    derivativeAddr,
    collateralAmount,
    numTokens,
    feePercentage,
    nonce,
    expiry,
  }: IRedeemRequest): string {
    const messageTypes = RedeemUtils.getMessageTypes();
    const messageParametres = [
      RedeemUtils.REDEEM_TYPEHASH_HEX,
      sender,
      derivativeAddr,
      collateralAmount,
      numTokens,
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
