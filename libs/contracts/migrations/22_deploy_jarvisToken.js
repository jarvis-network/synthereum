module.exports = require('../utils/getContractsFactory')(migrate, [
  'SynthereumFinder',
  'JarvisToken',
  'JarvisTokenImplementation',
]);

async function migrate(deployer, network, accounts) {
  const rolesConfig = require('../data/roles.json');
  const {
    getExistingInstance,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/get-existing-instance');
  const { SynthereumFinder, JarvisToken, JarvisTokenImplementation } =
    migrate.getContracts(artifacts);
  const {
    getKeysForNetwork,
    deploy,
  } = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
  const {
    toNetworkId,
  } = require('@jarvis-network/core-utils/dist/eth/networks');
  const tokenData = require('../data/jarvisToken.json');

  const networkId = process.env.FORKCHAINID
    ? process.env.FORKCHAINID
    : toNetworkId(network);
  const admin = process.env.FORKCHAINID
    ? accounts[0]
    : rolesConfig[networkId]?.admin ?? accounts[0];
  const maintainer = process.env.FORKCHAINID
    ? accounts[1]
    : rolesConfig[networkId]?.maintainer ?? accounts[1];
  const synthereumFinder = await getExistingInstance(
    web3,
    SynthereumFinder,
    '@jarvis-network/synthereum-contracts',
  );
  const keys = getKeysForNetwork(network, accounts);
  await deploy(
    web3,
    deployer,
    network,
    JarvisTokenImplementation,
    synthereumFinder.options.address,
    {
      from: keys.deployer,
    },
  );
  const JarvisTokenImplInstance = await getExistingInstance(
    web3,
    JarvisTokenImplementation,
    '@jarvis-network/synthereum-contracts',
  );
  await deploy(
    web3,
    deployer,
    network,
    JarvisToken,
    JarvisTokenImplInstance.options.address,
    admin,
    web3.eth.abi.encodeFunctionCall(
      {
        name: 'initialize',
        type: 'function',
        inputs: [
          {
            type: 'uint256',
            name: '_totSupply',
          },
          {
            type: 'address',
            name: '_recipient',
          },
        ],
      },
      [tokenData[networkId].totSupply, tokenData[networkId].firstReceiver],
    ),
    {
      from: keys.deployer,
    },
  );
  const jarvisToken = await getExistingInstance(
    web3,
    JarvisToken,
    '@jarvis-network/synthereum-contracts',
  );
  const jarvisTokenInterface = await web3.utils.stringToHex('JarvisToken');
  await synthereumFinder.methods
    .changeImplementationAddress(
      jarvisTokenInterface,
      jarvisToken.options.address,
    )
    .send({ from: maintainer });
  console.log('Jarvis token added to SynthereumFinder');
}
