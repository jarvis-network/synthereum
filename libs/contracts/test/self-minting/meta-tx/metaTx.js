const { signMetaTxRequest } = require('./signer.js');

let utils = {};

utils.signAndSendMetaTx = async (
  forwarderInstance,
  signer,
  functionSig,
  params,
  from,
  to,
  value,
  networkId,
) => {
  let { request, signature } = await signMetaTxRequest(
    signer,
    forwarderInstance,
    {
      from,
      to,
      data: functionSig + params,
      value,
    },
    networkId,
  );
  await forwarderInstance.execute(request, signature);
};

module.exports = utils;
