const IERC20 = artifacts.require("IERC20");

const { expectRevert } = require("@openzeppelin/test-helpers");
const timeMachine = require("ganache-time-traveler");
const {
  createOracle,
  createFinder,
  createDerivative,
  createTIC,
  depositLPCollateral,
  createMintRequest,
  approveMintRequests,
  rejectMintRequests,
  expireAtPrice,
  settleExpired,
  calculateTokenValue
} = require("../utils/ticTestHelpers");

contract("TIC", accounts => {
  let networkId;
  let tic;
  let mockOracle;
  let finder;
  let derivative;
  let collateralToken;
  let syntheticToken;

  before(async () => {
    networkId = await web3.eth.net.getId();
  });

  beforeEach(async () => {
    mockOracle = await createOracle(networkId);
    finder = await createFinder(networkId, mockOracle.address);
    const blocktime = (await web3.eth.getBlock("latest"))["timestamp"];
    derivative = await createDerivative(networkId, finder.address, blocktime);
    tic = await createTIC(derivative.address, accounts[0], accounts[0]);

    const collateralTokenAddr = await tic.collateralToken();
    collateralToken = await IERC20.at(collateralTokenAddr);

    const syntheticTokenAddr = await tic.syntheticToken();
    syntheticToken = await IERC20.at(syntheticTokenAddr);
  });

  it("should mint tokens when enough collateral is supplied.", async () => {
    const numTokens = "0.001";

    const balance = await syntheticToken.balanceOf(accounts[0]);
    await depositLPCollateral(tic, collateralToken, accounts[0], "0.0003");
    await createMintRequest(tic, collateralToken, accounts[0], "0.001", numTokens);
    await approveMintRequests(tic, accounts[0]);
    const newBalance = await syntheticToken.balanceOf(accounts[0]);

    assert.equal(newBalance - balance, web3.utils.toWei(numTokens));
  });

  it("should not mint tokens when there is insufficient collateral.", async () => {
    const numTokens = "0.003";

    const balance = await syntheticToken.balanceOf(accounts[0]);
    await depositLPCollateral(tic, collateralToken, accounts[0], "0.0001");
    await createMintRequest(tic, collateralToken, accounts[0], "0.001", numTokens);
    await expectRevert.unspecified(
      approveMintRequests(tic, accounts[0])
    );
    const newBalance = await syntheticToken.balanceOf(accounts[0]);

    assert.equal(newBalance - balance, 0);
  });

  it("should not mint tokens if a mint request has been rejected.", async () => {
    const numTokens = "0.001";

    const balance = await syntheticToken.balanceOf(accounts[0]);
    await depositLPCollateral(tic, collateralToken, accounts[0], "0.0003");
    await createMintRequest(tic, collateralToken, accounts[0], "0.001", numTokens);
    await rejectMintRequests(tic, accounts[0]);
    const newBalance = await syntheticToken.balanceOf(accounts[0]);

    assert.equal(newBalance - balance, 0);
  });

  it("should not mint tokens if a mint request has already been approved.", async () => {
    const numTokens = "0.001";

    await depositLPCollateral(tic, collateralToken, accounts[0], "0.0003");
    await createMintRequest(tic, collateralToken, accounts[0], "0.001", numTokens);
    await approveMintRequests(tic, accounts[0]);
    const balance = await syntheticToken.balanceOf(accounts[0]);

    await approveMintRequests(tic, accounts[0]);
    const newBalance = await syntheticToken.balanceOf(accounts[0]);

    assert.equal(newBalance - balance, 0);
  });

  it("should mint tokens for multiple users when enough collateral is supplied.", async () => {
    const numTokens = "0.001";

    const balance1 = await syntheticToken.balanceOf(accounts[0]);
    await depositLPCollateral(tic, collateralToken, accounts[0], "0.0006");
    await createMintRequest(tic, collateralToken, accounts[0], "0.001", numTokens);
    await approveMintRequests(tic, accounts[0]);
    const newBalance1 = await syntheticToken.balanceOf(accounts[0]);

    assert.equal(newBalance1 - balance1, web3.utils.toWei(numTokens));

    const balance2 = await syntheticToken.balanceOf(accounts[1]);
    await createMintRequest(tic, collateralToken, accounts[1], "0.001", numTokens);
    await approveMintRequests(tic, accounts[0]);
    const newBalance2 = await syntheticToken.balanceOf(accounts[1]);

    assert.equal(newBalance2 - balance2, web3.utils.toWei(numTokens));
  });

  it("should let a user redeem tokens after contract expires.", async () => {
    const expiration = await derivative.expirationTimestamp();

    const numTokens = "0.001";
    await depositLPCollateral(tic, collateralToken, accounts[0], "0.0003");
    await createMintRequest(tic, collateralToken, accounts[1], "0.001", numTokens);
    await approveMintRequests(tic, accounts[0]);

    const syntheticBalance = await syntheticToken.balanceOf(accounts[1]);
    const collateralBalance = await collateralToken.balanceOf(accounts[1]);

    timeMachine.advanceBlockAndSetTime(expiration.toNumber());

    const price = "1";
    await expireAtPrice(derivative, mockOracle, price);
    await settleExpired(tic, syntheticToken, accounts[1], syntheticBalance);

    const newSyntheticBalance = await syntheticToken.balanceOf(accounts[1]);
    const newCollateralBalance = await collateralToken.balanceOf(accounts[1]);

    const tokenValue = calculateTokenValue(syntheticBalance, price);

    assert.equal(newSyntheticBalance, 0);
    assert.equal(newCollateralBalance - collateralBalance, tokenValue);
  });

  it("should let the LP recover collateral after contract expires.", async () => {
    const expiration = await derivative.expirationTimestamp();

    const lpCollateral = "0.0003";
    const numTokens = "0.001";
    await depositLPCollateral(tic, collateralToken, accounts[0], lpCollateral);
    await createMintRequest(tic, collateralToken, accounts[0], "0.001", numTokens);
    await approveMintRequests(tic, accounts[0]);

    const syntheticBalance = await syntheticToken.balanceOf(accounts[0]);
    const collateralBalance = await collateralToken.balanceOf(accounts[0]);

    timeMachine.advanceBlockAndSetTime(expiration.toNumber());

    const price = "1";
    await expireAtPrice(derivative, mockOracle, price);
    await settleExpired(tic, syntheticToken, accounts[0], syntheticBalance);

    const newSyntheticBalance = await syntheticToken.balanceOf(accounts[0]);
    const newCollateralBalance = await collateralToken.balanceOf(accounts[0]);

    const tokenValue = calculateTokenValue(syntheticBalance, price);
    const totalCollateral = tokenValue.add(web3.utils.toBN(web3.utils.toWei(lpCollateral)));

    assert.equal(newSyntheticBalance, 0);
    assert.equal(newCollateralBalance - collateralBalance, totalCollateral);
  });

  it("should let a user exchange one synthetic token for another", async () => {
    const numTokens = "0.001";

    await depositLPCollateral(tic, collateralToken, accounts[0], "0.0003");
    await createMintRequest(tic, collateralToken, accounts[0], "0.001", numTokens);
    await approveMintRequests(tic, accounts[0]);
    const balance = await syntheticToken.balanceOf(accounts[0]);

    const blocktime = (await web3.eth.getBlock("latest"))["timestamp"];
    const otherDerivative = await createDerivative(networkId, finder.address, blocktime);
    const otherTIC = await createTIC(otherDerivative.address, accounts[0], accounts[0]);
    const syntheticTokenAddr = await otherTIC.syntheticToken();
    const otherSyntheticToken = await IERC20.at(syntheticTokenAddr);
    const otherBalance = await otherSyntheticToken.balanceOf(accounts[0]);

    const numTokensWei = web3.utils.toWei(numTokens);
    await syntheticToken.approve(tic.address, numTokensWei, { from: accounts[0] });
    await tic.exchange(otherTIC.address, numTokensWei, numTokensWei);

    const newBalance = await syntheticToken.balanceOf(accounts[0]);
    const newOtherBalance = await otherSyntheticToken.balanceOf(accounts[0]);

    assert.equal(balance - newBalance, numTokensWei);
    assert.equal(newOtherBalance - otherBalance, numTokensWei);
  });
});
