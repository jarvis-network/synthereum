const IERC20 = artifacts.require('IERC20');
const rDAI = artifacts.require('IRToken');
const TIC = artifacts.require('TIC');
const TICFactory = artifacts.require('TICFactory');

const { expectRevert } = require('@openzeppelin/test-helpers');
const contracts = require('../contract-dependencies.json');
const assets = require('../synthetic-assets.json');
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert');

contract('WITHDRAW FUNCTION TEST', accounts => {
  before(async () => {
    const networkId = await web3.eth.net.getId();
    this.LP = accounts[0];
    this.TICFactoryInstance = await TICFactory.deployed();
    const TICaddress = await this.TICFactoryInstance.symbolToTIC.call(
      assets[0].syntheticSymbol,
    );
    this.TICInstance = await TIC.at(TICaddress);
    const tokenAddress = await this.TICInstance.collateralToken.call();
    this.rDAIInstance = await rDAI.at(contracts[networkId].collateralAddress);
    this.collateralTokenInstance = await IERC20.at(tokenAddress);
    this.depositedAmount = web3.utils.toBN(web3.utils.toWei('1'));
    this.withdrawAmount = web3.utils.toBN(web3.utils.toWei('0.4'));
    await this.collateralTokenInstance.approve(
      this.TICInstance.address,
      this.depositedAmount,
      { from: this.LP },
    );
    await this.TICInstance.deposit(this.depositedAmount, { from: this.LP });
  });

  it('should withdraw LP collateral from TIC pool', async () => {
    let rDaiTICbalance = web3.utils.toBN(
      await this.rDAIInstance.balanceOf.call(this.TICInstance.address),
    );
    assert.equal(
      rDaiTICbalance.eq(this.depositedAmount),
      true,
      'Wrong rDai deposited amount',
    );
    const prevLPBalance = web3.utils.toBN(
      await this.collateralTokenInstance.balanceOf.call(this.LP),
    );
    await this.TICInstance.withdraw(this.withdrawAmount, { from: this.LP });
    rDaiTICbalance = web3.utils.toBN(
      await this.rDAIInstance.balanceOf.call(this.TICInstance.address),
    );
    assert.equal(
      rDaiTICbalance.eq(this.depositedAmount.sub(this.withdrawAmount)),
      true,
      'Wrong rDai balance after withdraw',
    );
    const actualLPBalance = web3.utils.toBN(
      await this.collateralTokenInstance.balanceOf.call(this.LP),
    );
    assert.equal(
      actualLPBalance.eq(prevLPBalance.add(this.withdrawAmount)),
      true,
      'Wrong collateral balance after withdraw',
    );
  });

  it('should revert if withdraw bigger than deposited amount', async () => {
    const exceedWithdrawAmount = this.depositedAmount
      .sub(this.withdrawAmount)
      .add(web3.utils.toBN(web3.utils.toWei('0.01')));
    await expectRevert.unspecified(
      this.TICInstance.withdraw(exceedWithdrawAmount, { from: this.LP }),
    );
  });
});
