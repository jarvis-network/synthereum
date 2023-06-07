const web3Utils = require('web3-utils');
const Web3EthAbi = require('web3-eth-abi');
const secp256k1 = require('secp256k1');

const versionSignature = '\x19\x01';

const FORWARDER_TYPEHASH = web3Utils.soliditySha3(
  'ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)',
);

function getDomainSeparator(networkId, contract) {
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
    web3Utils.soliditySha3(web3Utils.utf8ToHex('MinimalForwarder')),
    web3Utils.soliditySha3(web3Utils.utf8ToHex('0.0.1')),
    networkId,
    contract,
  ];
  const domainSeparatorBody = Web3EthAbi.encodeParameters(
    domainSeparatorBodyTypes,
    domainSeparatorBodyParametres,
  );
  return web3Utils.soliditySha3(domainSeparatorBody).replace('0x', '');
}

function getForwarderMessageDigest(from, to, value, gas, nonce, data) {
  const messageTypes = [
    'bytes32',
    'address',
    'address',
    'uint256',
    'uint256',
    'uint256',
    'bytes32',
  ];
  const messageParametres = [
    FORWARDER_TYPEHASH,
    from,
    to,
    value,
    gas,
    nonce,
    web3Utils.soliditySha3(data),
  ];
  const messageBody = Web3EthAbi.encodeParameters(
    messageTypes,
    messageParametres,
  );
  return web3Utils.soliditySha3(messageBody).replace('0x', '');
}

function createForwarderMessageBody(
  from,
  to,
  value,
  gas,
  nonce,
  data,
  networkId,
  contract,
) {
  /* ----------------------------- Create Forwarder message ----------------------------- */
  const messagePayload = getForwarderMessageDigest(
    from,
    to,
    value,
    gas,
    nonce,
    data,
  );
  /* ----------------------------------- End ---------------------------------- */

  /* -------------------------- Create Domain Message ------------------------- */

  const domainPayload = getDomainSeparator(networkId, contract);

  /* ----------------------------------- End ---------------------------------- */

  const versionSignatureHex = web3Utils.utf8ToHex(versionSignature);
  const digestBody = versionSignatureHex.concat(domainPayload, messagePayload);
  const body = web3Utils.soliditySha3(digestBody);
  return new Uint8Array(Buffer.from(body.replace('0x', ''), 'hex'));
}

function sign(message, privKey) {
  const sigHex = secp256k1.ecdsaSign(message, privKey);
  const sig = Buffer.from(sigHex.signature).toString('hex');
  const vSig = (sigHex.recid + 27).toString(16);
  const hexInit = '0x';
  return hexInit.concat(sig).concat(vSig);
}

function generateForwarderSignature(
  from,
  to,
  value,
  gas,
  nonce,
  data,
  networkId,
  contract,
  privKey,
) {
  const message = createForwarderMessageBody(
    from,
    to,
    value,
    gas,
    nonce,
    data,
    networkId,
    contract,
  );

  return sign(message, privKey);
}

function mintV5Encoding(minNumTokens, collateralAmount, expiration, recipient) {
  const signatureHash = Web3EthAbi.encodeFunctionSignature(
    'mint((uint256,uint256,uint256,address))',
  );
  const data = Web3EthAbi.encodeParameters(
    [
      {
        MintParams: {
          minNumTokens: 'uint256',
          collateralAmount: 'uint256',
          expiration: 'uint256',
          recipient: 'uint256',
        },
      },
    ],
    [{ minNumTokens, collateralAmount, expiration, recipient }],
  );
  return signatureHash.concat(data.replace('0x', ''));
}

function redeemV5Encoding(numTokens, minCollateral, expiration, recipient) {
  const signatureHash = Web3EthAbi.encodeFunctionSignature(
    'redeem((uint256,uint256,uint256,address))',
  );
  const data = Web3EthAbi.encodeParameters(
    [
      {
        RedeemParams: {
          numTokens: 'uint256',
          minCollateral: 'uint256',
          expiration: 'uint256',
          recipient: 'uint256',
        },
      },
    ],
    [{ numTokens, minCollateral, expiration, recipient }],
  );
  return signatureHash.concat(data.replace('0x', ''));
}

function exchangeV5Encoding(
  destPool,
  numTokens,
  minDestNumTokens,
  expiration,
  recipient,
) {
  const signatureHash = Web3EthAbi.encodeFunctionSignature(
    'exchange((address,uint256,uint256,uint256,address))',
  );
  const data = Web3EthAbi.encodeParameters(
    [
      {
        ExchangeParams: {
          destPool: 'address',
          numTokens: 'uint256',
          minDestNumTokens: 'uint256',
          expiration: 'uint256',
          recipient: 'uint256',
        },
      },
    ],
    [{ destPool, numTokens, minDestNumTokens, expiration, recipient }],
  );
  return signatureHash.concat(data.replace('0x', ''));
}

function withdrawLiquidityV5Encoding(collateralAmount) {
  const signatureHash = Web3EthAbi.encodeFunctionSignature(
    'withdrawLiquidity(uint256)',
  );
  const data = Web3EthAbi.encodeParameters(['uint256'], [collateralAmount]);
  return signatureHash.concat(data.replace('0x', ''));
}

function increaseCollateralV5Encoding(
  collateralToTransfer,
  collateralToIncrease,
) {
  const signatureHash = Web3EthAbi.encodeFunctionSignature(
    'increaseCollateral(uint256,uint256)',
  );
  const data = Web3EthAbi.encodeParameters(
    ['uint256', 'uint256'],
    [collateralToTransfer, collateralToIncrease],
  );
  return signatureHash.concat(data.replace('0x', ''));
}

function decreaseCollateralV5Encoding(
  collateralToDecrease,
  collateralToWithdraw,
) {
  const signatureHash = Web3EthAbi.encodeFunctionSignature(
    'decreaseCollateral(uint256,uint256)',
  );
  const data = Web3EthAbi.encodeParameters(
    ['uint256', 'uint256'],
    [collateralToDecrease, collateralToWithdraw],
  );
  return signatureHash.concat(data.replace('0x', ''));
}

function claimFeeV5Encoding() {
  return Web3EthAbi.encodeFunctionSignature('claimFee()');
}

function liquidateV5Encoding(numSynthTokens) {
  const signatureHash =
    Web3EthAbi.encodeFunctionSignature('liquidate(uint256)');
  const data = Web3EthAbi.encodeParameters(['uint256'], [numSynthTokens]);
  return signatureHash.concat(data.replace('0x', ''));
}

function settleEmergencyShutdownV5Encoding() {
  return Web3EthAbi.encodeFunctionSignature('settleEmergencyShutdown()');
}

module.exports = {
  generateForwarderSignature,
  mintV5Encoding,
  redeemV5Encoding,
  exchangeV5Encoding,
  withdrawLiquidityV5Encoding,
  increaseCollateralV5Encoding,
  decreaseCollateralV5Encoding,
  claimFeeV5Encoding,
  liquidateV5Encoding,
  settleEmergencyShutdownV5Encoding,
};
