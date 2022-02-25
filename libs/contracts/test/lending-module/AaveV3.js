const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const LendingModule = artifacts.require('AaveV3Module');
const PoolMock = artifacts.require('PoolLendingMock');
const LendingProxy = artifacts.require('LendingProxy');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const PoolStorageManager = artifacts.require('PoolStorageManager');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const AToken = artifacts.require('ATokenMock');
const data = require('../../data/test/lendingTestnet.json');

contract('AaveV3 Lending module', accounts => {
  let finder, poolMock, module, proxy, storageManager, networkId;
  let aUSDC, USDC;
  const maintainer = accounts[1];
  const daoInterestShare = web3Utils.toWei('0.04');
  const jrtShare = web3Utils.toWei('0.04');

  before(async () => {
    networkId = await web3.eth.net.getId();
    finder = await SynthereumFinder.deployed();
    storageManager = await PoolStorageManager.new(finder.address);
    proxy = await LendingProxy.new(
      finder.address,
      storageManager.address,
      maintainer,
    );
    aUSDC = await AToken.at(data[networkId].aUSDC);
    USDC = await aUSDC.UNDERLYING_ASSET_ADDRESS.call();
    jEUR = await SyntheticToken.new('jarvis euro', 'jEUR', 18, {
      from: accounts[0],
    });

    module = await LendingModule.new();
    poolMock = await PoolMock.new(
      USDC,
      jEUR.address,
      module.address,
      storageManager.address,
      { from: maintainer },
    );
    await finder.changeImplementationAddress(
      web3Utils.utf8ToHex('LendingProxy'),
      proxy.address,
      { from: maintainer },
    );
  });

  describe('Pool storage manager', async () => {
    it('Allows maintainer to set a pool', async () => {
      await proxy.setLendingModule(module.address, 'aave', {
        from: maintainer,
      });
      await proxy.setPool(
        poolMock.address,
        USDC.address,
        'aave',
        aUSDC.address,
        daoInterestShare,
        jrtShare,
        { from: maintainer },
      );

      let poolStorage = await storageManager.getPoolStorage.call(
        poolMock.address,
      );
      assert.equal(poolStorage.lendingModule, module.address);
    });
  });
});
