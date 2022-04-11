const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');

const Vault = artifacts.require('Vault');
const PoolMock = artifacts.require('PoolMockForVault');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const data = require('../../data/test/lendingTestnet.json');

const { toBN, toWei, toHex } = web3Utils;

contract('Lending Vault', accounts => {
  let vault, pool, USDC, jSynth;
  let networkId;
  let overCollateralization = toWei('0.05');
  let LPName = 'vault LP';
  let LPSymbol = 'vLP';

  before(async () => {
    networkId = await web3.eth.net.getId();
    USDC = await TestnetSelfMintingERC20.at(data[networkId].USDC);

    jSynth = await SyntheticToken.new('jarvis euro', 'jEUR', 18, {
      from: accounts[0],
    });

    pool = await PoolMock.new(1, USDC.address, 'jEUR', jSynth.address, {
      from: accounts[0],
    });

    vault = await Vault.new();
    await vault.initialize(
      LPName,
      LPSymbol,
      pool.address,
      overCollateralization,
    );
  });

  it('Correctly initialise the vault', async () => {
    assert.equal(await vault.getPool.call(), pool.address);
    assert.equal(await vault.getPoolCollateral.call(), USDC.address);
    assert.equal(
      (await vault.getOvercollateralisation.call()).toString(),
      overCollateralization.toString(),
    );
    assert.equal(await vault.name.call(), LPName);
    assert.equal(await vault.symbol.call(), LPSymbol);
  });

  it('Revert if another initialization is tried', async () => {
    await truffleAssert.reverts(
      vault.initialize(LPName, LPSymbol, pool.address, overCollateralization),
      'Initializable: contract is already initialized',
    );
  });
});
