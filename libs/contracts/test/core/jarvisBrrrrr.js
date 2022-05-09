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
const CompoundImplementation = artifacts.require('JarvisBrrCompound');
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
    console.log('TEST', accounts);
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

  describe.only('JarvisBrrr', () => {
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

  // these needs to be run on polygon fork and needs exclusive roles
  // skipping it
  describe('Money market manager - Polygonv - AAVEV3', () => {
    let id = 'aave';
    let bytesId = web3.utils.sha3(
      web3.eth.abi.encodeParameters(['string'], [id]),
    );
    let aaveAddress, args;
    let jEURPol = '0x4e3decbb3645551b8a19f0ea1678079fcb33fb4c';
    let ajEURPol = '0x6533afac2E7BCCB20dca161449A13A32D391fb00';
    let jEurInst, ajEurInst;
    let implementationCallArgs = '0x0000';

    before(async () => {
      jEurInst = await MintableBurnableSyntheticToken.at(jEURPol);
      ajEurInst = await MintableBurnableSyntheticToken.at(ajEURPol);

      let networkId = await web3.eth.net.getId();
      aaveAddress = data[networkId].AaveV3;
      args = web3.eth.abi.encodeParameters(['address'], [aaveAddress]);
      jarvisBrrrrr = await JarvisBrrrrr.at(
        '0xb51c6fDbf82eA5C1c2f39e7e6a3f82586C29c81e',
      );

      // deploy money market manager
      moneyMarketManager = await MoneyMarketManager.at(
        '0x9bd4220809e88d4efc1f36365872e688f33cddf0',
      );

      //deploy aave implementation
      aaveImpl = await AaveImplementation.at(
        '0x37f08323214e8C851e118C4C9Db71321264D1e60',
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

    it('Only maintainer can mint and deposit into aave', async () => {
      let amount = toWei('1', 'gwei');
      let depositedSupplyBefore = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );
      let circSupplyBefore = await jarvisBrrrrr.supply.call(jEURPol);
      let jEurBalanceBefore = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );

      let tx = await moneyMarketManager.deposit(
        jEURPol,
        amount,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'MintAndDeposit', ev => {
        return (
          ev.token.toLowerCase() == jEURPol.toLowerCase() &&
          ev.moneyMarketId == id &&
          ev.amount.toString() == amount.toString()
        );
      });

      let jEurBalanceAfter = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let ajEurBalanceAfter = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let circSupplyAfter = await jarvisBrrrrr.supply.call(jEURPol);
      let depositedSupplyAfter = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );

      assert.equal(
        depositedSupplyAfter.toString(),
        toBN(depositedSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        circSupplyAfter.toString(),
        toBN(circSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(jEurBalanceAfter.toString(), jEurBalanceBefore.toString());

      let assertion = toBN(ajEurBalanceAfter).gte(
        toBN(ajEurBalanceBefore).add(toBN(amount)),
      );
      assert.equal(assertion, true);

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.deposit(
          jEURPol,
          amount,
          id,
          implementationCallArgs,
          {
            from: roles.admin,
          },
        ),
        'Sender must be the maintainer',
      );

      await truffleAssert.reverts(
        moneyMarketManager.deposit(
          jEURPol,
          amount,
          id,
          implementationCallArgs,
          {
            from: accounts[3],
          },
        ),
        'Sender must be the maintainer',
      );
    });

    it('Only maintainer can redeem from aave and burn', async () => {
      let circSupplyBefore = await jarvisBrrrrr.supply.call(jEURPol);
      let depositedSupplyBefore = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );

      let jEurBalanceBefore = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );

      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let amount = ajEurBalanceBefore.divn(2);
      let tx = await moneyMarketManager.withdraw(
        jEURPol,
        amount,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      let ajEurBalanceAfter = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let circSupplyAfter = await jarvisBrrrrr.supply.call(jEURPol);
      let depositedSupplyAfter = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );

      assert.equal(
        depositedSupplyAfter.toString(),
        toBN(depositedSupplyBefore).sub(toBN(amount)).toString(),
      );
      assert.equal(
        circSupplyAfter.toString(),
        toBN(circSupplyBefore).sub(toBN(amount)).toString(),
      );

      truffleAssert.eventEmitted(tx, 'RedeemAndBurn', ev => {
        return (
          ev.token.toLowerCase() == jEURPol.toLowerCase() &&
          ev.moneyMarketId == id &&
          ev.amount.toString() == amount.toString()
        );
      });

      let jEurBalanceAfter = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      assert.equal(jEurBalanceAfter.toString(), jEurBalanceBefore.toString());

      let assertion = toBN(ajEurBalanceAfter).gte(
        toBN(ajEurBalanceBefore).sub(toBN(amount)),
      );
      assert.equal(assertion, true);

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.withdraw(
          jEURPol,
          amount,
          id,
          implementationCallArgs,
          {
            from: roles.admin,
          },
        ),
        'Sender must be the maintainer',
      );

      await truffleAssert.reverts(
        moneyMarketManager.withdraw(
          jEURPol,
          amount,
          id,
          implementationCallArgs,
          {
            from: accounts[3],
          },
        ),
        'Sender must be the maintainer',
      );
    });

    it('Only maintainer can withdraw revenues from deposit', async () => {
      let depositedSupplyBefore = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );
      let maintainerjEurBalanceBefore = await jEurInst.balanceOf.call(
        roles.maintainer,
      );

      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      await moneyMarketManager.withdrawRevenue(
        jEURPol,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      let ajEurBalanceAfter = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );

      let depositedSupplyAfter = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );
      let maintainerjEurBalanceAfter = await jEurInst.balanceOf.call(
        roles.maintainer,
      );
      let expectedRevenue = toBN(ajEurBalanceBefore).sub(
        toBN(depositedSupplyBefore),
      );

      assert.equal(
        depositedSupplyBefore.toString(),
        depositedSupplyAfter.toString(),
      );

      let assertion = maintainerjEurBalanceAfter.gte(
        toBN(maintainerjEurBalanceBefore).add(toBN(expectedRevenue)),
      );
      assert.equal(assertion, true);

      assert.equal(
        ajEurBalanceAfter.toString(),
        toBN(ajEurBalanceBefore).sub(expectedRevenue),
      );

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.withdrawRevenue(
          jEURPol,
          id,
          implementationCallArgs,
          {
            from: roles.maintainer,
          },
        ),
        'Sender must be the maintainer',
      );

      await truffleAssert.reverts(
        moneyMarketManager.withdrawRevenue(
          jEURPol,
          id,
          implementationCallArgs,
          {
            from: roles.maintainer,
          },
        ),
        'Sender must be the maintainer',
      );
    });
  });

  describe('Money market manager - Polygonv - MarketXyz', () => {
    let id = 'marketxyz';
    let bytesId = web3.utils.sha3(
      web3.eth.abi.encodeParameters(['string'], [id]),
    );
    let args = '0x0000';
    let jEURPol = '0x4e3decbb3645551b8a19f0ea1678079fcb33fb4c';
    let ajEURPol = '0xcfa81742393b52c493b8d76e55ffe4992a5cffd9';
    let implementationCallArgs = web3.eth.abi.encodeParameters(
      ['address'],
      [ajEURPol],
    );

    let jEurInst, ajEurInst;
    let implementation;
    before(async () => {
      jEurInst = await MintableBurnableSyntheticToken.at(jEURPol);
      ajEurInst = await MintableBurnableSyntheticToken.at(ajEURPol);

      jarvisBrrrrr = await JarvisBrrrrr.at(
        '0xb51c6fDbf82eA5C1c2f39e7e6a3f82586C29c81e',
      );

      // deploy money market manager
      moneyMarketManager = await MoneyMarketManager.at(
        '0x9bd4220809e88d4efc1f36365872e688f33cddf0',
      );

      //deploy aave implementation
      implementation = await CompoundImplementation.at(
        '0x37f08323214e8C851e118C4C9Db71321264D1e60',
      );
    });

    it('Only maintainer can set a money market implementation', async () => {
      let tx = await moneyMarketManager.registerMoneyMarketImplementation(
        id,
        implementation.address,
        args,
        { from: roles.maintainer },
      );
      truffleAssert.eventEmitted(tx, 'RegisteredImplementation', ev => {
        return (
          ev.id == id &&
          ev.implementation == implementation.address &&
          ev.args == args
        );
      });

      assert.equal(
        await moneyMarketManager.idToMoneyMarketImplementation.call(bytesId),
        implementation.address,
      );
      assert.equal(
        await moneyMarketManager.moneyMarketArgs.call(implementation.address),
        args,
      );
      await truffleAssert.reverts(
        moneyMarketManager.registerMoneyMarketImplementation(
          id,
          implementation.address,
          args,
          { from: accounts[5] },
        ),
        'Sender must be the maintainer',
      );
    });

    it('Only maintainer can mint and deposit into market xyz', async () => {
      let amount = toWei('1', 'gwei');
      let depositedSupplyBefore = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );
      let circSupplyBefore = await jarvisBrrrrr.supply.call(jEURPol);
      let jEurBalanceBefore = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );

      let tx = await moneyMarketManager.deposit(
        jEURPol,
        amount,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'MintAndDeposit', ev => {
        return (
          ev.token.toLowerCase() == jEURPol.toLowerCase() &&
          ev.moneyMarketId == id &&
          ev.amount.toString() == amount.toString()
        );
      });

      let jEurBalanceAfter = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let ajEurBalanceAfter = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let circSupplyAfter = await jarvisBrrrrr.supply.call(jEURPol);
      let depositedSupplyAfter = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );

      assert.equal(
        depositedSupplyAfter.toString(),
        toBN(depositedSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        circSupplyAfter.toString(),
        toBN(circSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(jEurBalanceAfter.toString(), jEurBalanceBefore.toString());

      let assertion = toBN(ajEurBalanceAfter).gte(
        toBN(ajEurBalanceBefore).add(toBN(amount)),
      );
      assert.equal(assertion, true);

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.deposit(
          jEURPol,
          amount,
          id,
          implementationCallArgs,
          {
            from: roles.admin,
          },
        ),
        'Sender must be the maintainer',
      );

      await truffleAssert.reverts(
        moneyMarketManager.deposit(
          jEURPol,
          amount,
          id,
          implementationCallArgs,
          {
            from: accounts[3],
          },
        ),
        'Sender must be the maintainer',
      );
    });

    it('Only maintainer can redeem from aave and burn', async () => {
      let circSupplyBefore = await jarvisBrrrrr.supply.call(jEURPol);
      let depositedSupplyBefore = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );

      let jEurBalanceBefore = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );

      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let amount = ajEurBalanceBefore.divn(2);
      let tx = await moneyMarketManager.withdraw(
        jEURPol,
        amount,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      let ajEurBalanceAfter = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let circSupplyAfter = await jarvisBrrrrr.supply.call(jEURPol);
      let depositedSupplyAfter = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );

      assert.equal(
        depositedSupplyAfter.toString(),
        toBN(depositedSupplyBefore).sub(toBN(amount)).toString(),
      );
      assert.equal(
        circSupplyAfter.toString(),
        toBN(circSupplyBefore).sub(toBN(amount)).toString(),
      );

      truffleAssert.eventEmitted(tx, 'RedeemAndBurn', ev => {
        return (
          ev.token.toLowerCase() == jEURPol.toLowerCase() &&
          ev.moneyMarketId == id &&
          ev.amount.toString() == amount.toString()
        );
      });

      let jEurBalanceAfter = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      assert.equal(jEurBalanceAfter.toString(), jEurBalanceBefore.toString());

      let assertion = toBN(ajEurBalanceAfter).gte(
        toBN(ajEurBalanceBefore).sub(toBN(amount)),
      );
      assert.equal(assertion, true);

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.withdraw(
          jEURPol,
          amount,
          id,
          implementationCallArgs,
          {
            from: roles.admin,
          },
        ),
        'Sender must be the maintainer',
      );

      await truffleAssert.reverts(
        moneyMarketManager.withdraw(
          jEURPol,
          amount,
          id,
          implementationCallArgs,
          {
            from: accounts[3],
          },
        ),
        'Sender must be the maintainer',
      );
    });

    it('Only maintainer can withdraw revenues from deposit', async () => {
      let depositedSupplyBefore = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );
      let maintainerjEurBalanceBefore = await jEurInst.balanceOf.call(
        roles.maintainer,
      );

      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      await moneyMarketManager.withdrawRevenue(
        jEURPol,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      let ajEurBalanceAfter = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );

      let depositedSupplyAfter = await moneyMarketManager.moneyMarketBalances.call(
        bytesId,
        jEURPol,
      );
      let maintainerjEurBalanceAfter = await jEurInst.balanceOf.call(
        roles.maintainer,
      );
      let expectedRevenue = toBN(ajEurBalanceBefore).sub(
        toBN(depositedSupplyBefore),
      );

      assert.equal(
        depositedSupplyBefore.toString(),
        depositedSupplyAfter.toString(),
      );

      let assertion = maintainerjEurBalanceAfter.gte(
        toBN(maintainerjEurBalanceBefore).add(toBN(expectedRevenue)),
      );
      assert.equal(assertion, true);

      assert.equal(
        ajEurBalanceAfter.toString(),
        toBN(ajEurBalanceBefore).sub(expectedRevenue),
      );

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.withdrawRevenue(
          jEURPol,
          id,
          implementationCallArgs,
          {
            from: roles.maintainer,
          },
        ),
        'Sender must be the maintainer',
      );

      await truffleAssert.reverts(
        moneyMarketManager.withdrawRevenue(
          jEURPol,
          id,
          implementationCallArgs,
          {
            from: roles.maintainer,
          },
        ),
        'Sender must be the maintainer',
      );
    });
  });
});
