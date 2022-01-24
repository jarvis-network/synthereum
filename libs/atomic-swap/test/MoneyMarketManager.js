const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const { toWei, toBN } = web3Utils;
const SynthereumFinder = artifacts.require('SynthereumFinder');
const MintableBurnableSyntheticToken = artifacts.require(
  'MintableBurnableSyntheticToken',
);
const MoneyMarketManager = artifacts.require('MoneyMarketManager');
const { assert } = require('chai');

contract('LiquidityPool', async accounts => {
  let jEURAddress,
    jGBPAddress,
    moneyMarketManager,
    networkId,
    finder,
    DAOAddress;
  let roles = {
    admin: accounts[0],
    maintainer: accounts[1],
  };
  before(async () => {
    DAOAddress = accounts[2];
    networkId = await web3.eth.net.getId();

    jEurInstance = await MintableBurnableSyntheticToken.new(
      'TEST jEur',
      'tjEUR',
      18,
      { from: roles.admin },
    );
    jGBPInstance = await MintableBurnableSyntheticToken.new(
      'TEST jGBP',
      'tjGBP',
      18,
      { from: roles.admin },
    );
    jEURAddress = jEurInstance.address;
    jGBPAddress = jGBPInstance.address;

    finder = await SynthereumFinder.new(roles);
    moneyMarketManager = await MoneyMarketManager.new(roles, finder.address);

    // set Dao as token recipient
    await finder.changeImplementationAddress(
      web3Utils.toHex('MoneyMarketManager'),
      DAOAddress,
      { from: roles.maintainer },
    );

    // set minting capacity
    await moneyMarketManager.setMaxSupply(jEURAddress, toWei('1000'), {
      from: roles.maintainer,
    });

    // set moneyMarketManager as minter
    await jEurInstance.addMinter(moneyMarketManager.address, {
      from: roles.admin,
    });
    await jEurInstance.addBurner(moneyMarketManager.address, {
      from: roles.admin,
    });
  });

  it('Correctly mints and burns to DAO address', async () => {
    // mint
    let balanceBefore = await jEurInstance.balanceOf.call(DAOAddress);
    let amount = toWei('10');
    await moneyMarketManager.mint(jEURAddress, amount, { from: DAOAddress });
    let balanceAfterMint = await jEurInstance.balanceOf.call(DAOAddress);

    let circulatingSupply = await moneyMarketManager.circulatingSupply.call(
      jEURAddress,
    );
    assert.equal(
      balanceBefore.add(toBN(amount)).toString(),
      balanceAfterMint.toString(),
    );
    assert.equal(circulatingSupply.toString(), amount.toString());

    // redeem
    await truffleAssert.reverts(
      moneyMarketManager.redeem(jEURAddress, toWei('100000'), {
        from: DAOAddress,
      }),
      'Redeeming more than circulating supply',
    );
    let redeemAmount = toWei('6');
    await jEurInstance.approve(moneyMarketManager.address, redeemAmount, {
      from: DAOAddress,
    });
    await moneyMarketManager.redeem(jEURAddress, redeemAmount, {
      from: DAOAddress,
    });
    let balanceAfterRedeem = await jEurInstance.balanceOf.call(DAOAddress);
    circulatingSupply = await moneyMarketManager.circulatingSupply.call(
      jEURAddress,
    );

    assert.equal(
      balanceAfterMint.sub(toBN(redeemAmount)).toString(),
      balanceAfterRedeem.toString(),
    );
    assert.equal(
      circulatingSupply.toString(),
      toBN(amount).sub(toBN(redeemAmount)),
    );
  });

  it('Reverts if minting amount overcomes maxLimit', async () => {
    await truffleAssert.reverts(
      moneyMarketManager.mint(jEURAddress, toWei('100000'), {
        from: DAOAddress,
      }),
      'Minting over max limit',
    );
  });

  it('Only registred address can mint and redeem', async () => {
    await truffleAssert.reverts(
      moneyMarketManager.mint(jEURAddress, toWei('10'), { from: accounts[3] }),
      'Only mm manager can perform this operation',
    );
    await truffleAssert.reverts(
      moneyMarketManager.redeem(jEURAddress, toWei('1'), { from: accounts[3] }),
      'Only mm manager can perform this operation',
    );
  });

  it('Only maintainer can set new max supply', async () => {
    await moneyMarketManager.setMaxSupply(jEURAddress, 10, {
      from: roles.maintainer,
    });
    let newSupply = await moneyMarketManager.maxCirculatingSupply.call(
      jEURAddress,
    );
    assert.equal(newSupply, 10);

    truffleAssert.reverts(
      moneyMarketManager.setMaxSupply(jEURAddress, 10, { from: accounts[3] }),
      'Only contract maintainer can call this function',
    );
  });
});
