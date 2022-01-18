/* eslint-disable */
const { artifacts, contract } = require('hardhat');
const web3Utils = require('web3-utils');

const truffleAssert = require('truffle-assertions');
const { assert } = require('chai');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

const Proxy = artifacts.require('OnChainLiquidityRouterV2');
const FixedRateSwap = artifacts.require('FixedRateSwap');
const FixedRateWrapper = artifacts.require('SynthereumFixedRateWrapper');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const PoolMock = artifacts.require('PoolMock');
const MockContractUser = artifacts.require('MockContractUserV2');
const TestnetERC20 = artifacts.require(
  '@jarvis-network/synthereum-contracts/contracts/test/TestnetERC20.sol:TestnetERC20',
);
const SynthereumLiquidityPool = artifacts.require('SynthereumLiquidityPool');
const Forwarder = artifacts.require('SynthereumTrustedForwarder');
const IUniswapRouter = artifacts.require(
  '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02',
);
const tokens = require('../../data/test/tokens.json');
const uniswap = require('../../data/test/uniswap.json');
const synthereum = require('../../data/test/synthereum.json');
const { signMetaTxRequest } = require('../signer');

contract('FixedRateSwap - UniswapV3', async accounts => {
  let DAIInstance, USDCInstance, jEURInstance, WETHInstance, uniswapInstance;
  let DAIAddress, USDCAddress, USDTAddress, jEURAddress, WETHAddress;
  let networkId;

  let fixedRateSwapInstance,
    fixedRateTokenInstance,
    fixedRateWrapperInstance,
    proxyInstance,
    forwarderInstance,
    finderInstance;
  let deadline = ((Date.now() / 1000) | 0) + 7200;
  let amountETH = web3Utils.toWei('1', 'ether');
  const initializeTokenInstanace = async tokenAddress =>
    await TestnetERC20.at(tokenAddress);

  const getUSDC = async ethAmount => {
    let univ2Router = await IUniswapRouter.at(uniswap[networkId].router);
    await univ2Router.swapExactETHForTokens(
      0,
      [WETHAddress, USDCAddress],
      user,
      deadline,
      { from: user, value: ethAmount },
    );
  };
  const initializeTokens = async networkId => {
    USDCAddress = tokens[networkId].USDC;
    DAIAddress = tokens[networkId].DAI;
    jEURAddress = tokens[networkId].JEUR;
    WETHAddress = tokens[networkId].WETH;
    USDTAddress = tokens[networkId].USDT;

    WETHInstance = await initializeTokenInstanace(WETHAddress);
    DAIInstance = await initializeTokenInstanace(DAIAddress);
    USDCInstance = await initializeTokenInstanace(USDCAddress);
    USDTInstance = await initializeTokenInstanace(USDTAddress);
    jEURInstance = await initializeTokenInstanace(jEURAddress);
  };

  const initializeSynthereum = async networkId => {
    pool = synthereum[networkId].poolV5;
    poolInstance = await SynthereumLiquidityPool.at(pool);
  };

  before(async () => {
    admin = accounts[0];
    user = accounts[1];

    networkId = await web3.eth.net.getId();
    const networkFile = require(`@jarvis-network/synthereum-contracts/networks/${networkId}.json`);
    const synthereumFinderAddress = networkFile.filter(
      elem => elem.contractName === 'SynthereumFinder',
    )[0].address;

    expiration = (await web3.eth.getBlock('latest')).timestamp + 60;

    // init uniswap
    // uniswapInstance = await initializeUniswap(networkId);

    // initialise tokens
    await initializeTokens(networkId);

    // initialise synthereum
    await initializeSynthereum(networkId);

    // fund the pool
    await getUSDC(web3Utils.toWei('1', 'ether'));
    let balance = await USDCInstance.balanceOf.call(user);
    await USDCInstance.transfer(pool, balance.toString(), { from: user });

    // get deployed Proxy
    proxyInstance = await Proxy.deployed();

    // deploy FixedRate with jEUr as collateral
    fixedRateTokenInstance = await SyntheticToken.new(
      'Jarvis Bulgarian Lev',
      'jBGN',
      18,
      { from: accounts[0] },
    );

    let constructorParams = {
      finder: synthereumFinderAddress,
      version: 1,
      pegCollateralToken: jEURAddress,
      fixedRateToken: fixedRateTokenInstance.address,
      roles: { admin: accounts[0], maintainer: accounts[1] },
      rate: web3Utils.toWei('1.32'),
    };
    fixedRateWrapperInstance = await FixedRateWrapper.new(constructorParams, {
      from: accounts[0],
    });
    fixedRateSwapInstance = await FixedRateSwap.deployed();
  });

  it('reads', async () => {
    assert.equal(
      jEURAddress.toLowerCase(),
      (await fixedRateWrapperInstance.collateralToken.call()).toLowerCase(),
    );
  });
});
