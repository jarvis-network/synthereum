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
  let user1 = accounts[2];
  let collateralAllocation = toWei('100');

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

    // mint collateral to user
    await USDC.mint(user1, collateralAllocation);
  });

  describe('Deployment and initialisation', () => {
    it('Correctly initialise the vault', async () => {
      assert.equal(await vault.getPool.call(), pool.address);
      assert.equal(await vault.getPoolCollateral.call(), USDC.address);
      assert.equal(
        (await vault.getOvercollateralisation.call()).toString(),
        overCollateralization.toString(),
      );
      assert.equal(await vault.name.call(), LPName);
      assert.equal(await vault.symbol.call(), LPSymbol);
      assert.equal((await vault.getRate.call()).toString(), toWei('1'));
    });

    it('Revert if another initialization is tried', async () => {
      await truffleAssert.reverts(
        vault.initialize(LPName, LPSymbol, pool.address, overCollateralization),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('Deposit', () => {
    it('First deposit - activates LP and correctly deposit', async () => {
      // mock set position being overcollateralised
      await pool.setPositionOvercollateralised(true);

      let userBalanceBefore = await USDC.balanceOf.call(user1);
      let userLPBalanceBefore = await vault.balanceOf.call(user1);
      assert.equal(userLPBalanceBefore.toString(), '0');

      // deposit
      let collateralDeposit = toWei('50');
      await USDC.approve(vault.address, collateralDeposit, { from: user1 });
      let tx = await vault.deposit(collateralDeposit, { from: user1 });

      // check event
      truffleAssert.eventEmitted(tx, 'Deposit', ev => {
        return (
          ev.netCollateralDeposited.toString() ==
            collateralDeposit.toString() &&
          ev.lpTokensOut.toString() == collateralDeposit.toString() &&
          ev.rate.toString() == toWei('1') &&
          ev.discountedRate.toString() == '0'
        );
      });

      // check
      let userBalanceAfter = await USDC.balanceOf.call(user1);
      let userLPBalanceAfter = await vault.balanceOf.call(user1);

      let expectedUserBalance = toBN(userBalanceBefore).sub(
        toBN(collateralDeposit),
      );
      assert.equal(expectedUserBalance.toString(), userBalanceAfter.toString());

      let expectedUserLP = collateralDeposit;
      assert.equal(userLPBalanceAfter.toString(), expectedUserLP.toString());
    });
  });

  describe('Withdraw', () => {});
});
