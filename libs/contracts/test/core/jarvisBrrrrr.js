const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const web3Utils = require('web3-utils');
const { toWei, toBN } = web3Utils;
const truffleAssert = require('truffle-assertions');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const MintableBurnableSyntheticToken = artifacts.require(
  'MintableBurnableSyntheticToken',
);
const JarvisBrrrrr = artifacts.require('JarvisBrrrrr');
const MoneyMarketManager = artifacts.require('MoneyMarketManager');
const AaveImplementation = artifacts.require('JarvisBrrAave');
const data = require('../../data/test/lendingTestnet.json');

contract('Jarvis Printer', async accounts => {
  let jEURAddress,
    jarvisBrrrrr,
    networkId,
    finder,
    DAOAddress,
    moneyMarketManager,
    aaveImpl;
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

  describe('JarvisBrrr', () => {
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
      await jEurInstance.addMinter(roles.admin, {
        from: roles.admin,
      });
      await jEurInstance.addBurner(roles.admin, {
        from: roles.admin,
      });
      const exceedAmount = toWei('100000');
      await jEurInstance.mint(DAOAddress, exceedAmount, {
        from: roles.admin,
      });
      await jEurInstance.approve(jarvisBrrrrr.address, exceedAmount, {
        from: DAOAddress,
      });
      // redeem
      await truffleAssert.reverts(
        jarvisBrrrrr.redeem(jEURAddress, exceedAmount, {
          from: DAOAddress,
        }),
      );
      await jEurInstance.transfer(roles.admin, exceedAmount, {
        from: DAOAddress,
      });
      await jEurInstance.burn(exceedAmount, {
        from: roles.admin,
      });
      await jEurInstance.renounceMinter({
        from: roles.admin,
      });
      await jEurInstance.renounceBurner({
        from: roles.admin,
      });
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

  describe('Money market manager', () => {
    let id = 'aave';
    let aaveAddress, args;

    before(async () => {
      let networkId = await web3.eth.net.getId();
      aaveAddress = data[networkId].AaveV3;
      args = web3.eth.abi.encodeParameters(['address'], [aaveAddress]);

      // deploy money market manager
      moneyMarketManager = await MoneyMarketManager.new(finder.address, roles);
      //deploy aave implementation
      aaveImpl = await AaveImplementation.new();

      // set the contract as token recipient
      await finder.changeImplementationAddress(
        web3Utils.toHex('MoneyMarketManager'),
        moneyMarketManager.address,
        { from: roles.maintainer },
      );
    });

    it('Only maintainer can set a money market implementation', async () => {
      let tx = await moneyMarketManager.registerMoneyMarketImplementation(
        id,
        aaveImpl.address,
        args,
        { from: roles.maintainer },
      );
      truffleAssert.eventEmitted(tx, 'RegisteredImplementation', ev => {
        return (
          ev.id == id &&
          ev.implementation == aaveImpl.address &&
          ev.args == args
        );
      });
      let bytesId = web3.utils.sha3(
        web3.eth.abi.encodeParameters(['string'], [id]),
      );

      assert.equal(
        await moneyMarketManager.idToMoneyMarketImplementation.call(bytesId),
        aaveImpl.address,
      );
      assert.equal(
        await moneyMarketManager.moneyMarketArgs.call(aaveImpl.address),
        args,
      );
      await truffleAssert.reverts(
        moneyMarketManager.registerMoneyMarketImplementation(
          id,
          aaveImpl.address,
          args,
          { from: accounts[5] },
        ),
        'Sender must be the maintainer',
      );
    });
  });
});
