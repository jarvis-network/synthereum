async function getDeploymentInstance(artifact, contractName, networkId) {
  let contractInstance;
  let isDeployed;
  try {
    contractInstance = await artifact.deployed();
    isDeployed = true;
  } catch (e) {
    const networks = require(`../networks/${networkId}.json`);
    const networkContractAddresses = networks.filter(contract => {
      return contract.contractName === contractName;
    });
    contractInstance = new web3.eth.Contract(
      artifact.abi,
      networkContractAddresses[networkContractAddresses.length - 1].address,
    );
    isDeployed = false;
  }
  return { contractInstance, isDeployed };
}

async function printTruffleLikeTransactionOutput(
  contractName,
  contractAddress,
  txhash,
) {
  if (!web3) return;
  const { gasPrice, gas: gasLimit, value } = await web3.eth.getTransaction(
    txhash,
  );
  const { blockNumber, from, gasUsed } = await web3.eth.getTransactionReceipt(
    txhash,
  );

  const accountBalance = await web3.eth.getBalance(from);
  const { timestamp } = await web3.eth.getBlock(blockNumber);

  const ethSent = parseFloat(value);

  console.log(`
   Deploying '${contractName}'
   -------------------------------
   > transaction hash:    ${txhash}
   > contract address:    ${contractAddress}
   > block number:        ${blockNumber}
   > block timestamp:     ${timestamp} (${new Date(timestamp * 1000)})
   > account:             ${from}
   > balance:             ${accountBalance * 1e-18}
   > gas used:            ${gasUsed} / ${gasLimit} ${(
    (gasUsed / gasLimit) *
    100
  ).toFixed(2)}%
   > gas price:           ${gasPrice * 1e-9} gwei
   > value sent:          ${ethSent * 1e-18} ETH
   > total cost:          ${(ethSent + gasUsed * gasPrice) * 1e-18} ETH
  `);
}

module.exports = { getDeploymentInstance, printTruffleLikeTransactionOutput };
