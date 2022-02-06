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
const JarvisBrrrrr = artifacts.require('JarvisBrrrrr');
const { assert } = require('chai');

contract('JarvisBrrrrr', async accounts => {
  let jEURAddress, jarvisBrrrrr, networkId, finder, DAOAddress;
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

    jEURAddress = jEurInstance.address;

    finder = await SynthereumFinder.deployed();
    jarvisBrrrrr = await JarvisBrrrrr.deployed();

    // set Dao as token recipient
    await finder.changeImplementationAddress(
      web3Utils.toHex('MoneyMarketManager'),
      DAOAddress,
      { from: roles.maintainer },
    );

    // set minting capacity
    await jarvisBrrrrr.setMaxSupply(jEURAddress, toWei('1000'), {
      from: roles.maintainer,
    });

    // set jarvisBrrrrr as minter
    await jEurInstance.addMinter(jarvisBrrrrr.address, {
      from: roles.admin,
    });
    await jEurInstance.addBurner(jarvisBrrrrr.address, {
      from: roles.admin,
    });
  });

  it('Correctly mints and burns to DAO address', async () => {
    // mint
    let balanceBefore = await jEurInstance.balanceOf.call(DAOAddress);
    let amount = toWei('10');
    const mintTx = await jarvisBrrrrr.mint(jEURAddress, amount, {
      from: DAOAddress,
    });
    truffleAssert.eventEmitted(mintTx, 'Minted', ev => {
      return (
        ev.token == jEURAddress &&
        ev.recipient == DAOAddress &&
        ev.amount == amount
      );
    });
    let balanceAfterMint = await jEurInstance.balanceOf.call(DAOAddress);

    let circulatingSupply = await jarvisBrrrrr.supply.call(jEURAddress);
    assert.equal(
      balanceBefore.add(toBN(amount)).toString(),
      balanceAfterMint.toString(),
    );
    assert.equal(circulatingSupply.toString(), amount.toString());

    // redeem
    await truffleAssert.reverts(
      jarvisBrrrrr.redeem(jEURAddress, toWei('100000'), {
        from: DAOAddress,
      }),
      'Redeeming more than circulating supply',
    );
    let redeemAmount = toWei('6');
    await jEurInstance.approve(jarvisBrrrrr.address, redeemAmount, {
      from: DAOAddress,
    });
    const redeemTx = await jarvisBrrrrr.redeem(jEURAddress, redeemAmount, {
      from: DAOAddress,
    });
    truffleAssert.eventEmitted(redeemTx, 'Redeemed', ev => {
      return (
        ev.token == jEURAddress &&
        ev.recipient == DAOAddress &&
        ev.amount == redeemAmount
      );
    });
    let balanceAfterRedeem = await jEurInstance.balanceOf.call(DAOAddress);
    circulatingSupply = await jarvisBrrrrr.supply.call(jEURAddress);

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
      jarvisBrrrrr.mint(jEURAddress, toWei('100000'), {
        from: DAOAddress,
      }),
      'Minting over max limit',
    );
  });

  it('Only registred address can mint and redeem', async () => {
    await truffleAssert.reverts(
      jarvisBrrrrr.mint(jEURAddress, toWei('10'), { from: accounts[3] }),
      'Only mm manager can perform this operation',
    );
    await truffleAssert.reverts(
      jarvisBrrrrr.redeem(jEURAddress, toWei('1'), { from: accounts[3] }),
      'Only mm manager can perform this operation',
    );
  });

  it('Only maintainer can set new max supply', async () => {
    const newMaxSupplyTx = await jarvisBrrrrr.setMaxSupply(jEURAddress, 10, {
      from: roles.maintainer,
    });
    truffleAssert.eventEmitted(newMaxSupplyTx, 'NewMaxSupply', ev => {
      return ev.token == jEURAddress && ev.newMaxSupply == 10;
    });
    let newSupply = await jarvisBrrrrr.maxSupply.call(jEURAddress);
    assert.equal(newSupply, 10);

    await truffleAssert.reverts(
      jarvisBrrrrr.setMaxSupply(jEURAddress, 10, { from: accounts[3] }),
      'Sender must be the maintainer',
    );
  });
});
