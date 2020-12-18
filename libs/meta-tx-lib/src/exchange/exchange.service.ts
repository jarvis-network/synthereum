import { SupportedNetworkName } from '@jarvis-network/synthereum-contracts/dist/src/config/supported-networks';
import { AddressOn } from '@jarvis-network/web3-utils/eth/address';
import { soliditySha3, utf8ToHex } from 'web3-utils';
import { EIP712DomainLib } from '../eip712domain';
import { IExchangeRequest } from '../interfaces/exchange.interface';
import { ExchangeUtils } from './exchange.utils';

export class ExchangeService {
  createMessageBody(
    payload: IExchangeRequest,
    networkId?: SupportedNetworkName,
    contractAddress?: AddressOn<SupportedNetworkName>,
  ): Uint8Array {
    /* ----------------------------- Create message ----------------------------- */
    const exchangeUtils = new ExchangeUtils();
    const messagePayload = exchangeUtils.generateMessage(payload);
    /* ----------------------------------- End ---------------------------------- */

    /* -------------------------- Create Domain Message ------------------------- */

    const domainPayload = EIP712DomainLib.generateMessage(
      process.env.REACT_APP_EIP712_DOMAIN || 'Synthereum Pool',
      process.env.REACT_APP_EIP712_VERSION || '1',
      networkId || 42,
      contractAddress!,
    );
    /* ----------------------------------- End ---------------------------------- */

    const versionSignature = utf8ToHex(ExchangeUtils.versionSignature);
    const digestBody = versionSignature.concat(domainPayload, messagePayload);
    const body = soliditySha3(digestBody);
    return new Uint8Array(Buffer.from(body!.replace('0x', ''), 'hex'));
  }
}
