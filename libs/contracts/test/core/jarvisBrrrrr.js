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
// const CToken = artifacts.require('CToken');
// const Comptroller = artifacts.require('Comptroller');
const MockCToken = artifacts.require('ICErc20');
const JarvisBrrrrr = artifacts.require('JarvisBrrrrr');
const MoneyMarketManager = artifacts.require('MoneyMarketManager');
const AaveImplementation = artifacts.require('JarvisBrrAave');
const CompoundImplementation = artifacts.require('JarvisBrrCompound');
const data = require('../../data/test/lendingTestnet.json');
const { createToken } = require('typescript');

contract('Jarvis Printer', async accounts => {
  let jEURAddress,
    jarvisBrrrrr,
    networkId,
    finder,
    DAOAddress,
    TestAddress,
    moneyMarketManager,
    aaveImpl;
  let roles = {
    admin: accounts[0],
    maintainer: accounts[1],
  };
  before(async () => {
    DAOAddress = accounts[2];
    TestAddress = accounts[3];
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

    // set Dao has access contract to the printer
    await finder.changeImplementationAddress(
      web3.utils.toHex('Dao'),
      DAOAddress,
      {
        from: roles.maintainer,
      },
    );
    await jarvisBrrrrr.addAccessContract('Dao', { from: roles.maintainer });

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
    it('Correctly add access contract', async () => {
      const moneyMarketAddress = (await MoneyMarketManager.deployed()).address;
      const testContractName = 'TestAdd';
      let hasAccess = await jarvisBrrrrr.hasContractAccess.call(
        testContractName,
      );
      assert.equal(hasAccess, false, 'Wrong access result');
      let whitelist = await jarvisBrrrrr.accessContractWhitelist.call();
      assert.deepEqual(
        whitelist.map(elem => elem[0]),
        ['MoneyMarketManager', 'Dao'],
        'Wrong list name result',
      );
      assert.deepEqual(
        whitelist.map(elem => elem[1]),
        [moneyMarketAddress, DAOAddress],
        'Wrong list address result',
      );
      await finder.changeImplementationAddress(
        web3.utils.toHex(testContractName),
        TestAddress,
        {
          from: roles.maintainer,
        },
      );
      const addTx = await jarvisBrrrrr.addAccessContract(testContractName, {
        from: roles.maintainer,
      });
      truffleAssert.eventEmitted(addTx, 'AccessContractAdded', ev => {
        return ev.contractName == testContractName;
      });
      hasAccess = await jarvisBrrrrr.hasContractAccess.call(testContractName);
      assert.equal(hasAccess, true, 'Wrong access result');
      whitelist = await jarvisBrrrrr.accessContractWhitelist.call();
      assert.deepEqual(
        whitelist.map(elem => elem[0]),
        ['MoneyMarketManager', 'Dao', testContractName],
        'Wrong list name result',
      );
      assert.deepEqual(
        whitelist.map(elem => elem[1]),
        [moneyMarketAddress, DAOAddress, TestAddress],
        'Wrong list address result',
      );
    });

    it('Correctly remove access contract', async () => {
      const moneyMarketAddress = (await MoneyMarketManager.deployed()).address;
      const testContractName = 'TestAdd';
      let hasAccess = await jarvisBrrrrr.hasContractAccess.call(
        testContractName,
      );
      assert.equal(hasAccess, true, 'Wrong access result');
      let whitelist = await jarvisBrrrrr.accessContractWhitelist.call();
      assert.deepEqual(
        whitelist.map(elem => elem[0]),
        ['MoneyMarketManager', 'Dao', testContractName],
        'Wrong list name result',
      );
      assert.deepEqual(
        whitelist.map(elem => elem[1]),
        [moneyMarketAddress, DAOAddress, TestAddress],
        'Wrong list address result',
      );
      const removeTx = await jarvisBrrrrr.removeAccessContract(
        testContractName,
        {
          from: roles.maintainer,
        },
      );
      truffleAssert.eventEmitted(removeTx, 'AccessContractRemoved', ev => {
        return ev.contractName == testContractName;
      });
      hasAccess = await jarvisBrrrrr.hasContractAccess.call(testContractName);
      assert.equal(hasAccess, false, 'Wrong access result');
      whitelist = await jarvisBrrrrr.accessContractWhitelist.call();
      assert.deepEqual(
        whitelist.map(elem => elem[0]),
        ['MoneyMarketManager', 'Dao'],
        'Wrong list name result',
      );
      assert.deepEqual(
        whitelist.map(elem => elem[1]),
        [moneyMarketAddress, DAOAddress],
        'Wrong list address result',
      );
      await finder.changeImplementationAddress(
        web3.utils.toHex(testContractName),
        ZERO_ADDRESS,
        {
          from: roles.maintainer,
        },
      );
    });

    it('Reverts if name passed missing when access contract is added', async () => {
      await truffleAssert.reverts(
        jarvisBrrrrr.addAccessContract('', {
          from: roles.maintainer,
        }),
        'No name passed',
      );
    });

    it('Reverts if name passed missing when access contract is added', async () => {
      await truffleAssert.reverts(
        jarvisBrrrrr.addAccessContract('', {
          from: roles.maintainer,
        }),
        'No name passed',
      );
    });

    it('Reverts if access contract already supported when access contract is added', async () => {
      await truffleAssert.reverts(
        jarvisBrrrrr.addAccessContract('Dao', {
          from: roles.maintainer,
        }),
        'Contract already whitelisted',
      );
    });

    it('Reverts if access contract not supported by the finder when access contract is added', async () => {
      await truffleAssert.reverts(
        jarvisBrrrrr.addAccessContract('Wrong name', {
          from: roles.maintainer,
        }),
        'Contract not supported by the finder',
      );
    });

    it('Reverts if access contract not supported when access contract is removed', async () => {
      await truffleAssert.reverts(
        jarvisBrrrrr.removeAccessContract('Wrong name', {
          from: roles.maintainer,
        }),
        'Contract not whitelisted',
      );
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

    it('Only registred address can mint and redeem', async () => {
      await truffleAssert.reverts(
        jarvisBrrrrr.mint(jEURAddress, toWei('10'), { from: accounts[3] }),
        'Only withelisted contracts can perform this operation',
      );
      await truffleAssert.reverts(
        jarvisBrrrrr.redeem(jEURAddress, toWei('1'), { from: accounts[3] }),
        'Only withelisted contracts can perform this operation',
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

    it('Reverts if mint more than max supply', async () => {
      const amount = toWei('1000.1');
      await truffleAssert.reverts(
        jarvisBrrrrr.mint(jEURAddress, amount, {
          from: DAOAddress,
        }),
        'Minting over max limit',
      );
    });
  });

  // these needs to be run on polygon fork and needs exclusive roles
  // skipping it
  describe.skip('Money market manager - Polygonv - AAVEV3', () => {
    let id = 'aave';
    let indexedId = web3.utils.soliditySha3(id);
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
        '0x95956ae0175e6a681cf54db19c69888079b068b5',
      );

      //deploy aave implementation
      aaveImpl = await AaveImplementation.at(
        '0xdccf2dc10890fec67f858d0c0cabeb6db84c65a7',
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
          ev.id == indexedId &&
          ev.implementation == aaveImpl.address &&
          ev.args == args
        );
      });

      const implementationInfo =
        await moneyMarketManager.getMoneyMarketImplementation.call(id);

      assert.equal(implementationInfo.implementationAddr, aaveImpl.address);
      assert.equal(implementationInfo.moneyMarketArgs, args);
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
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);
      let circSupplyBefore = await jarvisBrrrrr.supply.call(jEURPol);
      let jEurBalanceBefore = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );

      let tokensOut = await moneyMarketManager.deposit.call(
        jEURPol,
        amount,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
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
          ev.moneyMarketId == indexedId &&
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
      let depositedSupplyAfter =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);

      assert.equal(
        depositedSupplyAfter.toString(),
        toBN(depositedSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        circSupplyAfter.toString(),
        toBN(circSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(jEurBalanceAfter.toString(), jEurBalanceBefore.toString());

      assert.equal(
        toBN(ajEurBalanceAfter).lte(
          toBN(ajEurBalanceBefore).add(toBN(tokensOut)),
        ),
        true,
      );

      //revert check
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
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);

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
      let depositedSupplyAfter =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);

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
          ev.moneyMarketId == indexedId &&
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
            from: accounts[3],
          },
        ),
        'Sender must be the maintainer',
      );
    });

    it('Cant redeem and burn more than what deposited', async () => {
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);

      await truffleAssert.reverts(
        moneyMarketManager.withdraw(
          jEURPol,
          depositedSupplyBefore.add(toBN(1)),
          id,
          implementationCallArgs,
          {
            from: roles.maintainer,
          },
        ),
        'Max amount limit',
      );
    });

    it('Only maintainer can withdraw revenues from deposit', async () => {
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);
      let maintainerjEurBalanceBefore = await jEurInst.balanceOf.call(
        roles.maintainer,
      );

      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      await moneyMarketManager.withdrawRevenue(
        jEURPol,
        roles.maintainer,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      let ajEurBalanceAfter = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );

      let depositedSupplyAfter =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);
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
          roles.maintainer,
          id,
          implementationCallArgs,
          {
            from: accounts[0],
          },
        ),
        'Sender must be the maintainer',
      );
    });
  });

  describe.skip('Money market manager - Polygon - MarketXyz', () => {
    let id = 'MarketXyz';
    let indexedId = web3.utils.soliditySha3(id);
    let bytesId = web3.utils.sha3(
      web3.eth.abi.encodeParameters(['string'], [id]),
    );
    let args = '0x0000';
    let jEURPol = '0x4e3decbb3645551b8a19f0ea1678079fcb33fb4c';
    let ajEURPol = '0xDc55282A0BBC4822b6E58d9c8Bfc5ff885972A82';
    let implementationCallArgs = web3.eth.abi.encodeParameters(
      ['address'],
      [ajEURPol],
    );

    let jEurInst, ajEurInst;
    let implementation;
    before(async () => {
      jEurInst = await MintableBurnableSyntheticToken.at(jEURPol);
      ajEurInst = await MockCToken.at(ajEURPol);

      jarvisBrrrrr = await JarvisBrrrrr.at(
        '0xb51c6fDbf82eA5C1c2f39e7e6a3f82586C29c81e',
      );

      // deploy money market manager
      moneyMarketManager = await MoneyMarketManager.at(
        '0x95956ae0175e6a681cf54db19c69888079b068b5',
      );

      //deploy market xyz implementation
      implementation = await CompoundImplementation.new();
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
          ev.id == indexedId &&
          ev.implementation == implementation.address &&
          ev.args == args
        );
      });

      const implementationInfo =
        await moneyMarketManager.getMoneyMarketImplementation.call(id);
      assert.equal(
        implementationInfo.implementationAddr,
        implementation.address,
      );
      assert.equal(implementationInfo.moneyMarketArgs, args);
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
      let amount = toWei('1');
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);
      let circSupplyBefore = await jarvisBrrrrr.supply.call(jEURPol);
      let jEurBalanceBefore = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let tokensOut = await moneyMarketManager.deposit.call(
        jEurPol,
        amount,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
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
          ev.moneyMarketId == indexedId
        );
      });
      let jEurBalanceAfter = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let ajEurBalanceAfter = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let circSupplyAfter = await jarvisBrrrrr.supply.call(jEURPol);
      let depositedSupplyAfter =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);

      assert.equal(
        depositedSupplyAfter.toString(),
        toBN(depositedSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        circSupplyAfter.toString(),
        toBN(circSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(jEurBalanceAfter.toString(), jEurBalanceBefore.toString());
      assert.equal(
        toBN(ajEurBalanceAfter).lte(
          toBN(ajEurBalanceBefore).add(toBN(tokensOut)),
        ),
        true,
      );

      //revert check
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

      await network.provider.send('evm_increaseTime', [30000]);
      await network.provider.send('evm_mine');
    });

    it('Only maintainer can redeem from market xyz and burn', async () => {
      let circSupplyBefore = await jarvisBrrrrr.supply.call(jEURPol);
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);

      let jEurBalanceBefore = await jEurInst.balanceOf.call(
        moneyMarketManager.address,
      );

      let ajEurBalanceBefore = await ajEurInst.balanceOf.call(
        moneyMarketManager.address,
      );
      let amount = ajEurBalanceBefore.divn(10);
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
      let depositedSupplyAfter =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);

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
          ev.moneyMarketId == indexedId &&
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
            from: accounts[3],
          },
        ),
        'Sender must be the maintainer',
      );
    });

    it('Cant redeem and burn more than what deposited', async () => {
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);

      await truffleAssert.reverts(
        moneyMarketManager.withdraw(
          jEURPol,
          depositedSupplyBefore.add(toBN(1)),
          id,
          implementationCallArgs,
          {
            from: roles.maintainer,
          },
        ),
        'Max amount limit',
      );
    });

    it('Only maintainer can withdraw revenues from deposit', async () => {
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);
      let maintainerjEurBalanceBefore = await jEurInst.balanceOf.call(
        roles.maintainer,
      );

      let ajEurBalanceBefore = await ajEurInst.balanceOfUnderlying.call(
        moneyMarketManager.address,
      );
      await moneyMarketManager.withdrawRevenue(
        jEURPol,
        roles.maintainer,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      let ajEurBalanceAfter = await ajEurInst.balanceOfUnderlying.call(
        moneyMarketManager.address,
      );

      let depositedSupplyAfter =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jEURPol);
      let maintainerjEurBalanceAfter = await jEurInst.balanceOf.call(
        roles.maintainer,
      );
      let expectedMinRevenue = toBN(ajEurBalanceBefore).sub(
        toBN(depositedSupplyBefore),
      );

      assert.equal(
        depositedSupplyBefore.toString(),
        depositedSupplyAfter.toString(),
      );

      let assertion = maintainerjEurBalanceAfter.gte(
        toBN(maintainerjEurBalanceBefore).add(toBN(expectedMinRevenue)),
      );
      assert.equal(assertion, true);

      assertion = ajEurBalanceAfter.gte(
        toBN(ajEurBalanceBefore).sub(expectedMinRevenue),
      );
      assert.equal(assertion, true);

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.withdrawRevenue(
          jEURPol,
          roles.maintainer,
          id,
          implementationCallArgs,
          {
            from: accounts[4],
          },
        ),
        'Sender must be the maintainer',
      );
    });
  });

  describe.skip('Money market manager - BSC - Midas Capital', () => {
    let id = 'Midas';
    let indexedId = web3.utils.soliditySha3(id);
    let bytesId = web3.utils.sha3(
      web3.eth.abi.encodeParameters(['string'], [id]),
    );
    let jBRL = '0x316622977073bbc3df32e7d2a9b3c77596a0a603';
    let jBRLInstance, cjBRLInstance;
    let cjBRL = '0x82A3103bc306293227B756f7554AfAeE82F8ab7a';
    let args = ZERO_ADDRESS;
    let implementationCallArgs = web3.eth.abi.encodeParameters(
      ['address'],
      [cjBRL],
    );

    before(async () => {
      jBRLInstance = await MintableBurnableSyntheticToken.at(jBRL);
      cjBRLInstance = await MockCToken.at(cjBRL);

      jarvisBrrrrr = await JarvisBrrrrr.at(
        '0xd7FC91baAd9f3E9145bA361E21c4dD256Ae8D588',
      );

      // deploy money market manager
      moneyMarketManager = await MoneyMarketManager.deployed();

      //deploy midas adapter implementation
      implementation = await CompoundImplementation.new();
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
          ev.id == indexedId &&
          ev.implementation == implementation.address &&
          ev.args == args
        );
      });
      const implementationInfo =
        await moneyMarketManager.getMoneyMarketImplementation.call(id);
      assert.equal(
        implementationInfo.implementationAddr,
        implementation.address,
      );
      assert.equal(implementationInfo.moneyMarketArgs, args);
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

    it('Only maintainer can mint and deposit into midas capital', async () => {
      let amount = toWei('1');
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jBRL);
      let circSupplyBefore = await jarvisBrrrrr.supply.call(jBRL);
      let jBRLBalanceBefore = await jBRLInstance.balanceOf.call(
        moneyMarketManager.address,
      );
      let cjBLRBalanceBefore = await cjBRLInstance.balanceOf.call(
        moneyMarketManager.address,
      );
      let tokensOut = await moneyMarketManager.deposit.call(
        jBRL,
        amount,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      let tx = await moneyMarketManager.deposit(
        jBRL,
        amount,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );

      truffleAssert.eventEmitted(tx, 'MintAndDeposit', ev => {
        return (
          ev.token.toLowerCase() == jBRL.toLowerCase() &&
          ev.moneyMarketId == indexedId
        );
      });
      let jBRLBalanceAfter = await jBRLInstance.balanceOf.call(
        moneyMarketManager.address,
      );
      let cjBLRBalanceAfter = await cjBRLInstance.balanceOf.call(
        moneyMarketManager.address,
      );
      let circSupplyAfter = await jarvisBrrrrr.supply(jBRL);
      let depositedSupplyAfter =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jBRL);

      assert.equal(
        depositedSupplyAfter.toString(),
        toBN(depositedSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(
        circSupplyAfter.toString(),
        toBN(circSupplyBefore).add(toBN(amount)).toString(),
      );
      assert.equal(jBRLBalanceAfter.toString(), jBRLBalanceBefore.toString());
      assert.equal(
        toBN(cjBLRBalanceAfter).lte(
          toBN(cjBLRBalanceBefore).add(toBN(tokensOut)),
        ),
        true,
      );

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.deposit(jBRL, amount, id, implementationCallArgs, {
          from: accounts[3],
        }),
        'Sender must be the maintainer',
      );

      await network.provider.send('evm_increaseTime', [30000]);
      await network.provider.send('evm_mine');
    });

    it('Only maintainer can redeem from midas capital and burn', async () => {
      let circSupplyBefore = await jarvisBrrrrr.supply(jBRL);
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jBRL);

      let jBRLBalanceBefore = await jBRLInstance.balanceOf.call(
        moneyMarketManager.address,
      );
      let cjBLRBalanceBefore = await cjBRLInstance.balanceOf.call(
        moneyMarketManager.address,
      );
      let amount = cjBLRBalanceBefore.divn(10);
      let tx = await moneyMarketManager.withdraw(
        jBRL,
        amount,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      let cjBRLBalanceAfter = await jBRLInstance.balanceOf.call(
        moneyMarketManager.address,
      );
      let circSupplyAfter = await jarvisBrrrrr.supply(jBRL);
      let depositedSupplyAfter =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jBRL);

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
          ev.token.toLowerCase() == jBRL.toLowerCase() &&
          ev.moneyMarketId == indexedId &&
          ev.amount.toString() == amount.toString()
        );
      });

      let jBRLBalanceAfter = await jBRLInstance.balanceOf.call(
        moneyMarketManager.address,
      );
      assert.equal(jBRLBalanceAfter.toString(), jBRLBalanceBefore.toString());

      let assertion = toBN(cjBLRBalanceBefore).gte(
        toBN(cjBRLBalanceAfter).sub(toBN(amount)),
      );
      assert.equal(assertion, true);

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.withdraw(jBRL, amount, id, implementationCallArgs, {
          from: accounts[3],
        }),
        'Sender must be the maintainer',
      );
    });

    it('Cant redeem and burn more than what deposited', async () => {
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jBRL);

      await truffleAssert.reverts(
        moneyMarketManager.withdraw(
          jBRL,
          depositedSupplyBefore.add(toBN(1)),
          id,
          implementationCallArgs,
          {
            from: roles.maintainer,
          },
        ),
        'Max amount limit',
      );
    });

    it('Only maintainer can withdraw revenues from deposit', async () => {
      let depositedSupplyBefore =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jBRL);
      let maintainerjEurBalanceBefore = await jBRLInstance.balanceOf.call(
        roles.maintainer,
      );

      let cjBLRBalanceBefore = await cjBRLInstance.balanceOfUnderlying.call(
        moneyMarketManager.address,
      );
      await moneyMarketManager.withdrawRevenue(
        jBRL,
        roles.maintainer,
        id,
        implementationCallArgs,
        {
          from: roles.maintainer,
        },
      );
      let cjBLRBalanceAfter = await cjBRLInstance.balanceOfUnderlying.call(
        moneyMarketManager.address,
      );

      let depositedSupplyAfter =
        await moneyMarketManager.getMoneyMarketDeposited.call(id, jBRL);
      let maintainerjEurBalanceAfter = await jBRLInstance.balanceOf.call(
        roles.maintainer,
      );
      let expectedMinRevenue = toBN(cjBLRBalanceBefore).sub(
        toBN(depositedSupplyBefore),
      );

      assert.equal(
        depositedSupplyBefore.toString(),
        depositedSupplyAfter.toString(),
      );

      let assertion = maintainerjEurBalanceAfter.gte(
        toBN(maintainerjEurBalanceBefore).add(toBN(expectedMinRevenue)),
      );
      assert.equal(assertion, true);

      assertion = cjBLRBalanceAfter.gte(
        toBN(cjBLRBalanceBefore).sub(expectedMinRevenue),
      );
      assert.equal(assertion, true);

      //revert check
      await truffleAssert.reverts(
        moneyMarketManager.withdrawRevenue(
          jBRL,
          roles.maintainer,
          id,
          implementationCallArgs,
          {
            from: accounts[4],
          },
        ),
        'Sender must be the maintainer',
      );
    });
  });
});
