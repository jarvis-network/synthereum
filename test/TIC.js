const TICFactory = artifacts.require("TICFactory");
const TIC = artifacts.require("TIC");
const IERC20 = artifacts.require("IERC20");
const ExpiringMultiParty = artifacts.require("ExpiringMultiParty");
const Finder = artifacts.require("Finder");
const MockOracle = artifacts.require("MockOracle");

const { constants, expectRevert } = require("@openzeppelin/test-helpers");

const contracts = require("../contract-dependencies.json");
const assets = require("../synthetic-assets.json");
const ticConfig = require("../tic-config.json");

const timeMachine = require("ganache-time-traveler");

contract("TIC", accounts => {
  let tic;
  let mockOracle;
  let derivative;
  let collateralToken;
  let syntheticToken;

  before(async () => {
    await timeMachine.advanceBlockAndSetTime(1588291200);

    const isTest = false;
    const withdrawalLiveness = 3600;
    const liquidationLiveness = 3600;

    const networkId = await web3.eth.net.getId();
    const {
      collateralAddress,
      tokenFactoryAddress,
      identifierWhitelist,
      storeAddress
    } = contracts[networkId];

    const finder = await Finder.new();
    const finderAddress = finder.address;

    const {
      priceFeedIdentifier,
      syntheticName,
      syntheticSymbol,
      collateralRequirement,
      startingCollateralization
    } = assets[0];

    const priceFeedIdentifierHex = web3.utils.toHex(priceFeedIdentifier);

    const params = {
      isTest,
      finderAddress,
      tokenFactoryAddress,
      withdrawalLiveness,
      liquidationLiveness,
      collateralAddress,
      priceFeedIdentifier: priceFeedIdentifierHex,
      syntheticName,
      syntheticSymbol,
      collateralRequirement,
      ...ticConfig,
    };

    mockOracle = await MockOracle.new(identifierWhitelist);
    const mockOracleInterfaceName = web3.utils.toHex("Oracle");
    await finder.changeImplementationAddress(mockOracleInterfaceName, mockOracle.address);

    const identifierWhitelistInterfaceName = web3.utils.toHex("IdentifierWhitelist");
    await finder.changeImplementationAddress(
      identifierWhitelistInterfaceName,
      identifierWhitelist
    );

    const storeInterfaceName = web3.utils.toHex("Store");
    await finder.changeImplementationAddress(storeInterfaceName, storeAddress);

    derivative = await ExpiringMultiParty.new(params);

    const protocolOwner = accounts[0]; // Account to pay protocol fees to
    const liquidityProvider = accounts[0]; // Whoever the liquidity provider should be

    const fee = {
      "mintFee": { "rawValue": web3.utils.toWei("0.001") },
      "mintFeeRecipients": [protocolOwner, liquidityProvider],
      "mintFeeProportions": [50, 50],
      "interestFeeRecipients": [protocolOwner, liquidityProvider],
      "interestFeeProportions": [10, 90]
    };

    tic = await TIC.new(derivative.address, liquidityProvider, startingCollateralization, fee);
    const test = await tic.derivative();

    const collateralTokenAddr = await tic.collateralToken();
    collateralToken = await IERC20.at(collateralTokenAddr);

    const syntheticTokenAddr = await tic.syntheticToken();
    syntheticToken = await IERC20.at(syntheticTokenAddr);
  });

  it("should mint tokens when enough collateral is supplied.", async () => {
    const balance = await syntheticToken.balanceOf(accounts[0]);

    const lpCollateral = web3.utils.toWei("0.0003", "ether");
    await collateralToken.approve(tic.address, lpCollateral, { from: accounts[0] });
    await tic.deposit(lpCollateral, { from: accounts[0] });

    const userCollateral = web3.utils.toWei("0.001");
    const mintFee = web3.utils.toBN(await tic.calculateMintFee(userCollateral));

    const totalCollateral = web3.utils.toBN(userCollateral).add(mintFee).toString();
    await collateralToken.approve(tic.address, totalCollateral, { from: accounts[0] });

    const numTokens = web3.utils.toWei("0.001");
    await tic.mint(userCollateral, numTokens, { from: accounts[0] });

    const newBalance = await syntheticToken.balanceOf(accounts[0]);

    assert.isAbove(newBalance - balance, 0);
  });

  it("should not mint tokens when there is insufficient collateral.", async () => {
    const balance = await syntheticToken.balanceOf(accounts[0]);

    const lpCollateral = web3.utils.toWei("0.0001", "ether");
    await collateralToken.approve(tic.address, lpCollateral, { from: accounts[0] });
    await tic.deposit(lpCollateral, { from: accounts[0] });

    const userCollateral = web3.utils.toWei("0.001");
    const mintFee = web3.utils.toBN(await tic.calculateMintFee(userCollateral));

    const totalCollateral = web3.utils.toBN(userCollateral).add(mintFee).toString();
    await collateralToken.approve(tic.address, totalCollateral, { from: accounts[0] });

    const numTokens = web3.utils.toWei("0.001");
    await expectRevert.unspecified(tic.mint(userCollateral, numTokens, { from: accounts[0] }));

    const newBalance = await syntheticToken.balanceOf(accounts[0]);

    assert.equal(newBalance - balance, 0);
  });

  it("should mint tokens for multiple users when enough collateral is supplied.", async () => {
    const balance1 = await syntheticToken.balanceOf(accounts[0]);

    const lpCollateral = web3.utils.toWei("0.0006", "ether");
    await collateralToken.approve(tic.address, lpCollateral, { from: accounts[0] });
    await tic.deposit(lpCollateral, { from: accounts[0] });

    const userCollateral = web3.utils.toWei("0.001");
    const mintFee = web3.utils.toBN(await tic.calculateMintFee(userCollateral));

    const totalCollateral = web3.utils.toBN(userCollateral).add(mintFee).toString();
    await collateralToken.approve(tic.address, totalCollateral, { from: accounts[0] });

    const numTokens = web3.utils.toWei("0.001");
    await tic.mint(userCollateral, numTokens, { from: accounts[0] });

    const newBalance1 = await syntheticToken.balanceOf(accounts[0]);

    assert.isAbove(newBalance1 - balance1, 0);

    const balance2 = await syntheticToken.balanceOf(accounts[1]);

    await collateralToken.approve(tic.address, totalCollateral, { from: accounts[1] });
    await tic.mint(userCollateral, numTokens, { from: accounts[1] });

    const newBalance2 = await syntheticToken.balanceOf(accounts[1]);

    assert.equal(newBalance2 - balance2, numTokens);
  });

  it("should let a user redeem tokens after contract expires.", async () => {
    const expiration = ticConfig["expirationTimestamp"];

    const lpCollateral = web3.utils.toWei("0.0003", "ether");
    await collateralToken.approve(tic.address, lpCollateral, { from: accounts[0] });
    await tic.deposit(lpCollateral, { from: accounts[0] });

    const userCollateral = web3.utils.toWei("0.001");
    const mintFee = web3.utils.toBN(await tic.calculateMintFee(userCollateral));

    const totalCollateral = web3.utils.toBN(userCollateral).add(mintFee).toString();
    await collateralToken.approve(tic.address, totalCollateral, { from: accounts[1] });

    const numTokens = web3.utils.toWei("0.001");
    await tic.mint(userCollateral, numTokens, { from: accounts[1] });

    const syntheticBalance = await syntheticToken.balanceOf(accounts[1]);
    const collateralBalance = await collateralToken.balanceOf(accounts[1]);

    timeMachine.advanceBlockAndSetTime(expiration);

    await derivative.expire();

    const queries = await mockOracle.getPendingQueries();
    const price = web3.utils.toWei("1");
    await mockOracle.pushPrice(queries[0]["identifier"], queries[0]["time"], price);

    await syntheticToken.approve(tic.address, syntheticBalance, { from: accounts[1] });
    await tic.settleExpired({ from: accounts[1] });

    const newSyntheticBalance = await syntheticToken.balanceOf(accounts[1]);
    const newCollateralBalance = await collateralToken.balanceOf(accounts[1]);

    const tokenValue = web3.utils.toBN(syntheticBalance)
      .mul(web3.utils.toBN(price))
      .div(web3.utils.toBN(web3.utils.toWei("1")));

    assert.equal(newSyntheticBalance, 0);
    assert.equal(newCollateralBalance - collateralBalance, tokenValue);
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
