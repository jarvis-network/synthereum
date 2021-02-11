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
    contractInstance = new global.web3.eth.Contract(
      artifact.abi,
      networkContractAddresses[networkContractAddresses.length - 1].address,
    );
    isDeployed = false;
  }
  return { contractInstance, isDeployed };
}

module.exports = { getDeploymentInstance };
