const web3Utils = require('web3-utils');
const Web3EthAbi = require('web3-eth-abi');
const secp256k1 = require('secp256k1');

const versionSignature = '\x19\x01';

const MINT_TYPEHASH = web3Utils.soliditySha3(
  'MintParameters(address sender,address derivativeAddr,uint256 collateralAmount,uint256 numTokens,uint256 feePercentage,uint256 nonce,uint256 expiration)',
);

const REDEEM_TYPEHASH = web3Utils.soliditySha3(
  'RedeemParameters(address sender,address derivativeAddr,uint256 collateralAmount,uint256 numTokens,uint256 feePercentage,uint256 nonce,uint256 expiration)',
);
const EXCHANGE_TYPEHASH = web3Utils.soliditySha3(
  'ExchangeParameters(address sender,address derivativeAddr,address destPoolAddr,address destDerivativeAddr,uint256 numTokens,uint256 collateralAmount,uint256 destNumTokens,uint256 feePercentage,uint256 nonce,uint256 expiration)',
);

function getDomainSeparator(networkId, contract, version) {
  const domainSeparatorBodyTypes = [
    'bytes32',
    'bytes32',
    'bytes32',
    'uint256',
    'address',
  ];
  const domainSeparatorBodyParametres = [
    web3Utils.soliditySha3(
      'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
    ),
    web3Utils.soliditySha3(web3Utils.utf8ToHex('Synthereum Pool')),
    web3Utils.soliditySha3(web3Utils.utf8ToHex(version.toString())),
    networkId,
    contract,
  ];
  const domainSeparatorBody = Web3EthAbi.encodeParameters(
    domainSeparatorBodyTypes,
    domainSeparatorBodyParametres,
  );
  return web3Utils.soliditySha3Raw(domainSeparatorBody).replace('0x', '');
}

function getMintMessageDigest(
  sender,
  derivative,
  collateralAmount,
  numTokens,
  feePercentage,
  nonce,
  expiration,
) {
  const messageTypes = [
    'bytes32',
    'address',
    'address',
    'uint256',
    'uint256',
    'uint256',
    'uint256',
    'uint256',
  ];
  const messageParametres = [
    MINT_TYPEHASH,
    sender,
    derivative,
    collateralAmount,
    numTokens,
    feePercentage,
    nonce,
    expiration,
  ];
  const messageBody = Web3EthAbi.encodeParameters(
    messageTypes,
    messageParametres,
  );
  return web3Utils.soliditySha3(messageBody).replace('0x', '');
}

function getRedeemMessageDigest(
  sender,
  derivative,
  collateralAmount,
  numTokens,
  feePercentage,
  nonce,
  expiration,
) {
  const messageTypes = [
    'bytes32',
    'address',
    'address',
    'uint256',
    'uint256',
    'uint256',
    'uint256',
    'uint256',
  ];
  const messageParametres = [
    REDEEM_TYPEHASH,
    sender,
    derivative,
    collateralAmount,
    numTokens,
    feePercentage,
    nonce,
    expiration,
  ];
  const messageBody = Web3EthAbi.encodeParameters(
    messageTypes,
    messageParametres,
  );
  return web3Utils.soliditySha3(messageBody).replace('0x', '');
}

function getExchangeMessageDigest(
  sender,
  derivativeAddr,
  destPoolAddr,
  destDerivativeAddr,
  numTokens,
  collateralAmount,
  destNumTokens,
  feePercentage,
  nonce,
  expiration,
) {
  const messageTypes = [
    'bytes32',
    'address',
    'address',
    'address',
    'address',
    'uint256',
    'uint256',
    'uint256',
    'uint256',
    'uint256',
    'uint256',
  ];
  const messageParametres = [
    EXCHANGE_TYPEHASH,
    sender,
    derivativeAddr,
    destPoolAddr,
    destDerivativeAddr,
    numTokens,
    collateralAmount,
    destNumTokens,
    feePercentage,
    nonce,
    expiration,
  ];
  const messageBody = Web3EthAbi.encodeParameters(
    messageTypes,
    messageParametres,
  );
  return web3Utils.soliditySha3(messageBody).replace('0x', '');
}

function createMintMessageBody(
  sender,
  derivative,
  collateralAmount,
  numTokens,
  feePercentage,
  nonce,
  expiration,
  networkId,
  contract,
  version,
) {
  /* ----------------------------- Create Deposit message ----------------------------- */
  const messagePayload = getMintMessageDigest(
    sender,
    derivative,
    collateralAmount,
    numTokens,
    feePercentage,
    nonce,
    expiration,
  );

  /* ----------------------------------- End ---------------------------------- */

  /* -------------------------- Create Domain Message ------------------------- */

  const domainPayload = getDomainSeparator(networkId, contract, version);

  /* ----------------------------------- End ---------------------------------- */

  const versionSignatureHex = web3Utils.utf8ToHex(versionSignature);
  const digestBody = versionSignatureHex.concat(domainPayload, messagePayload);
  const body = web3Utils.soliditySha3(digestBody);
  return new Uint8Array(Buffer.from(body.replace('0x', ''), 'hex'));
}

function createRedeemMessageBody(
  sender,
  derivative,
  collateralAmount,
  numTokens,
  feePercentage,
  nonce,
  expiration,
  networkId,
  contract,
  version,
) {
  /* ----------------------------- Create Deposit message ----------------------------- */
  const messagePayload = getRedeemMessageDigest(
    sender,
    derivative,
    collateralAmount,
    numTokens,
    feePercentage,
    nonce,
    expiration,
  );

  /* ----------------------------------- End ---------------------------------- */

  /* -------------------------- Create Domain Message ------------------------- */

  const domainPayload = getDomainSeparator(networkId, contract, version);

  /* ----------------------------------- End ---------------------------------- */

  const versionSignatureHex = web3Utils.utf8ToHex(versionSignature);
  const digestBody = versionSignatureHex.concat(domainPayload, messagePayload);
  const body = web3Utils.soliditySha3(digestBody);
  return new Uint8Array(Buffer.from(body.replace('0x', ''), 'hex'));
}

function createExchangeMessageBody(
  sender,
  derivativeAddr,
  destPoolAddr,
  destDerivativeAddr,
  numTokens,
  collateralAmount,
  destNumTokens,
  feePercentage,
  nonce,
  expiration,
  networkId,
  contract,
  version,
) {
  /* ----------------------------- Create Deposit message ----------------------------- */
  const messagePayload = getExchangeMessageDigest(
    sender,
    derivativeAddr,
    destPoolAddr,
    destDerivativeAddr,
    numTokens,
    collateralAmount,
    destNumTokens,
    feePercentage,
    nonce,
    expiration,
  );

  /* ----------------------------------- End ---------------------------------- */

  /* -------------------------- Create Domain Message ------------------------- */

  const domainPayload = getDomainSeparator(networkId, contract, version);

  /* ----------------------------------- End ---------------------------------- */

  const versionSignatureHex = web3Utils.utf8ToHex(versionSignature);
  const digestBody = versionSignatureHex.concat(domainPayload, messagePayload);
  const body = web3Utils.soliditySha3(digestBody);
  return new Uint8Array(Buffer.from(body.replace('0x', ''), 'hex'));
}

function sign(message, privKey) {
  const sigHex = secp256k1.ecdsaSign(message, privKey);
  const sig = Buffer.from(sigHex.signature).toString('hex');
  const hexInit = '0x';
  const rSig = hexInit.concat(sig.substr(0, 64));
  const sSig = hexInit.concat(sig.substr(64, 64));
  const vSig = sigHex.recid + 27;
  return { v: vSig, r: rSig, s: sSig };
}

function generateMintSignature(
  sender,
  derivative,
  collateralAmount,
  numTokens,
  feePercentage,
  nonce,
  expiration,
  networkId,
  contract,
  version,
  privKey,
) {
  const message = createMintMessageBody(
    sender,
    derivative,
    collateralAmount,
    numTokens,
    feePercentage,
    nonce,
    expiration,
    networkId,
    contract,
    version,
  );

  return sign(message, privKey);
}

function generateRedeemSignature(
  sender,
  derivative,
  collateralAmount,
  numTokens,
  feePercentage,
  nonce,
  expiration,
  networkId,
  contract,
  version,
  privKey,
) {
  const message = createRedeemMessageBody(
    sender,
    derivative,
    collateralAmount,
    numTokens,
    feePercentage,
    nonce,
    expiration,
    networkId,
    contract,
    version,
  );

  return sign(message, privKey);
}

function generateExchangeSignature(
  sender,
  derivativeAddr,
  destPoolAddr,
  destDerivativeAddr,
  numTokens,
  collateralAmount,
  destNumTokens,
  feePercentage,
  nonce,
  expiration,
  networkId,
  contract,
  version,
  privKey,
) {
  const message = createExchangeMessageBody(
    sender,
    derivativeAddr,
    destPoolAddr,
    destDerivativeAddr,
    numTokens,
    collateralAmount,
    destNumTokens,
    feePercentage,
    nonce,
    expiration,
    networkId,
    contract,
    version,
  );

  return sign(message, privKey);
}

module.exports = {
  generateMintSignature,
  generateRedeemSignature,
  generateExchangeSignature,
};
