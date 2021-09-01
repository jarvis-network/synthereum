/* eslint-disable */
const { artifacts, contract } = require('hardhat');
const Web3Utils = require('web3-utils');

const truffleAssert = require('truffle-assertions');
const { assert } = require('chai');
const { ZERO_ADDRESS } = require('@jarvis-network/uma-common');

const Proxy = artifacts.require('AtomicSwapProxy');
const UniV3AtomicSwap = artifacts.require('UniV3AtomicSwap');
const IAtomicSwap = artifacts.require('IAtomicSwapv2');
const ISwapRouter = artifacts.require('ISwapRouter');

const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumPoolOnChainPriceFeed = artifacts.require(
  'SynthereumPoolOnChainPriceFeed',
);

const MintableBurnableERC20 = artifacts.require('MintableBurnableERC20');
const MockV3Aggregator = artifacts.require('MockV3Aggregator');
const ChainlinkPriceFeed = artifacts.require('SynthereumChainlinkPriceFeed');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');

contract('AtomicSwapv2 - UniswapV3', async accounts => {
  let WBTCInstance, USDCInstance, jEURInstance, uniswapInstance;
  let WBTCAddress, USDCAddress, jEURAddress, WETHAddress;

  let AtomicSwapAddr,
    ProxyAddress,
    AtomicSwapInstance,
    ProxyInstance,
    synthereumFinderAddress = '0xBeFaa064Ad33668C97D4C8C4d0237682B7D04E34'; // from networks/42.json

  const initializeTokenInstanace = async tokenAddress =>
    await TestnetERC20.at(tokenAddress);

  const initializeTokens = async networkId => {
    USDCAddress = tokens[networkId].USDC;
    WBTCAddress = tokens[networkId].WBTC;
    jEURAddress = tokens[networkId].JEUR;

    WBTCInstance = await initializeTokenInstanace(WBTCAddress);
    USDCInstance = await initializeTokenInstanace(USDCAddress);
    jEURInstance = await initializeTokenInstanace(jEURAddress);
  };

  const initializeUniswap = async networkId =>
    await ISwapRouter.at(uniswap[networkId].routerV3);

  const initializeSynthereum = async networkId => {
    pool = synthereum[networkId].pool;
    derivative = synthereum[networkId].derivative;
    poolInstance = await SynthereumPoolOnChainPriceFeed.at(pool);
  };

  const getWBTC = async ethAmount => {
    await uniswapInstance.swapExactETHForTokens(
      0,
      [WETHAddress, WBTCAddress],
      user,
      expiration,
      { value: ethAmount, from: user },
    );

    // console.log("WBTC balance after: " + await WBTCInstance.balanceOf.call(user))
  };

  const getUSDC = async ethAmount => {
    await uniswapInstance.swapExactETHForTokens(
      0,
      [WETHAddress, USDCAddress],
      user,
      expiration,
      { value: ethAmount, from: user },
    );

    // console.log("USDC balance after: " + await USDCInstance.balanceOf.call(user))
  };

  admin = accounts[0];
  user = accounts[1];

  const networkId = 42;
  expiration = (await web3.eth.getBlock('latest')).timestamp + 60;

  // will fail if there's no code at the address
  await SynthereumFinder.at(synthereumFinderAddress);

  // init uniswap
  uniswapInstance = await initializeUniswap(networkId);
  WETHAddress = await uniswapInstance.WETH();

  // initialise tokens
  await initializeTokens(networkId);

  // initialise synthereum
  await initializeSynthereum(networkId);

  // deploy Proxy
  ProxyInstance = await Proxy.new(admin);

  // deploy atomic swap
  AtomicSwapInstance = await UniV3AtomicSwap.new(
    synthereumFinderAddress,
    uniswapInstance.address,
    WETHAddress,
  );

  describe('From/to ERC20', () => {
    it('mint jSynth from ERC20 - exact input', async () => {});
    it('mint jSynth from ERC20 - exact output', async () => {});
    it('burn jSynth and swaps for ERC20 - exact input', async () => {});
    it('burn jSynth and swaps for ERC20 - exact output', async () => {});
  });

  describe('From/to ETH', () => {
    it('mint jSynth from ETH', async () => {});
    it('mint jSynth from ETH - exact input', async () => {});
    it('burn jSynth and swaps for ETH - exact output', async () => {});
  });
});
