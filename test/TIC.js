const TICFactory = artifacts.require("TICFactory");
const TIC = artifacts.require("TIC");
const IERC20 = artifacts.require("IERC20");
const { constants, expectRevert } = require("@openzeppelin/test-helpers");

contract("TIC", accounts => {
  let dai;
  let tic;
  let derivative;

  beforeEach(async () => {
    const factory = await TICFactory.deployed();
    const ticAddr = await factory.symbolToTIC("jEUR");
    tic = await TIC.at(ticAddr);

    const daiAddr = await tic.token();
    dai = new web3.eth.Contract(IERC20.abi, daiAddr);

    const derivativeAddr = await tic.derivative();
    derivative = new web3.eth.Contract(IERC20.abi, derivativeAddr);
  });

  it("should mint tokens when enough collateral is supplied.", async () => {
    await dai.methods.approve(tic.address, 12).send({
      from: accounts[0]
    });

    const balance = await derivative.methods.balanceOf(accounts[0]).call();

    await tic.deposit(2, { from: accounts[0] });
    await tic.mint(10, { from: accounts[0] });

    const newBalance = await derivative.methods.balanceOf(accounts[0]).call();

    assert.isAbove(newBalance - balance, 0);
  });

  it("should not mint tokens when there is insufficient collateral.", async () => {
    await dai.methods.approve(tic.address, 1).send({
      from: accounts[0]
    });

    const balance = await derivative.methods.balanceOf(accounts[0]).call();

    await tic.deposit(1, { from: accounts[0] });

    await expectRevert.unspecified(tic.mint(10, { from: accounts[0] }));

    const newBalance = await derivative.methods.balanceOf(accounts[0]).call();

    assert.equal(newBalance - balance, 0);
  });

  it("should mint tokens for multiple users when enough collateral is supplied.", async () => {
    await dai.methods.approve(tic.address, 14).send({
      from: accounts[0]
    });

    const balance1 = await derivative.methods.balanceOf(accounts[0]).call();

    await tic.deposit(2, { from: accounts[0] });
    await tic.mint(10, { from: accounts[0] });

    const newBalance1 = await derivative.methods.balanceOf(accounts[0]).call();

    assert.isAbove(newBalance1 - balance1, 0);

    const balance2 = await derivative.methods.balanceOf(accounts[1]).call();

    await dai.methods.approve(tic.address, 10).send({
      from: accounts[1]
    });

    await tic.deposit(2, { from: accounts[0] });
    await tic.mint(10, { from: accounts[1] });

    const newBalance2 = await derivative.methods.balanceOf(accounts[1]).call();

    assert.isAbove(newBalance2 - balance2, 0);
  });

  it("should let a user redeem tokens after minting them.", async () => {
    const marginToApprove = web3.utils.toWei("0.12", "ether");
    await dai.methods.approve(tic.address, marginToApprove).send({
      from: accounts[0]
    });

    const balance = await derivative.methods.balanceOf(accounts[0]).call();

    const amountOfMargin = web3.utils.toWei("0.02", "ether");
    const amountOfUserMargin = web3.utils.toWei("0.1", "ether");
    await tic.deposit(amountOfMargin, { from: accounts[0] });
    await tic.mint(amountOfUserMargin, { from: accounts[0] });

    const newBalance = await derivative.methods.balanceOf(accounts[0]).call();
    const daiBalance = await dai.methods.balanceOf(accounts[0]).call();

    assert.isAbove(newBalance - balance, 0);

    await derivative.methods.approve(tic.address, newBalance).send({
      from: accounts[0]
    });
    await tic.redeemTokens(newBalance, { from: accounts[0] });

    const afterRedeemBalance = await derivative.methods.balanceOf(accounts[0]).call();
    const newDaiBalance = await dai.methods.balanceOf(accounts[0]).call();

    assert.equal(afterRedeemBalance, 0);
    assert.equal(newDaiBalance - daiBalance, amountOfUserMargin);
  });

  it("should let a provider withdraw margin after a user redeems their tokens.", async () => {
    const marginToApprove = web3.utils.toWei("0.12", "ether");
    await dai.methods.approve(tic.address, marginToApprove).send({
      from: accounts[0]
    });

    const balance = await derivative.methods.balanceOf(accounts[0]).call();

    const amountOfMargin = web3.utils.toWei("0.02", "ether");
    const amountOfUserMargin = web3.utils.toWei("0.1", "ether");
    await tic.deposit(amountOfMargin, { from: accounts[0] });
    await tic.mint(amountOfUserMargin, { from: accounts[0] });

    const newBalance = await derivative.methods.balanceOf(accounts[0]).call();
    const daiBalance = await dai.methods.balanceOf(accounts[0]).call();

    assert.isAbove(newBalance - balance, 0);

    await derivative.methods.approve(tic.address, newBalance).send({
      from: accounts[0]
    });
    await tic.redeemTokens(newBalance, { from: accounts[0] });

    const afterRedeemBalance = await derivative.methods.balanceOf(accounts[0]).call();
    const newDaiBalance = await dai.methods.balanceOf(accounts[0]).call();

    assert.equal(afterRedeemBalance, 0);
    assert.equal(newDaiBalance - daiBalance, amountOfUserMargin);

    await tic.withdraw(amountOfMargin, { from: accounts[0] });

    const afterWithdrawBalance = await dai.methods.balanceOf(accounts[0]).call();

    assert.equal(afterWithdrawBalance - newDaiBalance, amountOfMargin);
  });
});
