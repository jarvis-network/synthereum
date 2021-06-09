const AtomicSwap = artifacts.require('AtomicSwap');
//const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

const TestnetERC20 = artifacts.require('TestnetERC20');
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02');
const IUniswapV2Router01 = artifacts.require('IUniswapV2Router01');
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory');
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');

const { deploy } = require('@jarvis-network/uma-common');

//pour start kovan local fork
//yarn start:local-fork kovan
//ou bien : ./local-fork.sh kovan
//commande clean + kovan fork : git checkout HEAD -- ./networks/ && yarn start:local-fork kovan

//lancer le test
//yarn test test/atomic-swap.js --network kovan_fork
//buy wbtc or usdc from eth (eth are already on the account which is calling the test)

contract('AtomicSwap', function (accounts) {
  const tester = accounts[0]; //compte test
  const sender = accounts[5]; //compte test
  const destinatary = accounts[6];

  let amountETH = web3Utils.toWei('1');

  let WBTCaddress = '0xd3A691C852CDB01E281545A27064741F0B7f6825';
  let USDCaddress = '0xe22da380ee6b445bb8273c81944adeb6e8450422';
  let derivativeParam = '0xA332832C1321eCfBb35Cc31bCb7d68FC0dB10395';
  let uniFactory = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
  let deadline = ((Date.now() / 1000) | 0) + 7200;

  async function intializeUniswap() {
    const iUniswapV2Router02 = await IUniswapV2Router02.at(
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    );

    return iUniswapV2Router02;
  }

  async function initializeWBTC() {
    let WBTCInstance = await TestnetERC20.at(WBTCaddress);
    return WBTCInstance;
  }

  async function initializeUSDC() {
    const USDCInstance = await TestnetERC20.at(USDCaddress);
    return USDCInstance;
  }

  //usdc-collateral kovan = 0xe22da380ee6B445bb8273C81944ADEB6E8450422;

  let WETHaddress;
  let uniswapInstance;
  let uniswapV2Router02;

  beforeEach(async () => {
    iUniswapInstance = await intializeUniswap();

    WETHaddress = await iUniswapInstance.WETH();

    WBTCInstance = await initializeWBTC();

    USDCInstance = await initializeUSDC();

    //uniswapV2Router02 = await UniswapV2Router02.new(uniFactory, WETHaddress);
  });

  it('should swap ETH to WBTC', async function () {
    let WBTCbalance = await WBTCInstance.balanceOf.call(tester);
    await iUniswapInstance.swapExactETHForTokens(
      0,
      [WETHaddress, WBTCaddress],
      tester,
      deadline,
      {
        value: amountETH, // Amount of Ether to send in tx,
      },
    );
    WBTCbalance = await WBTCInstance.balanceOf.call(tester);
    console.log('WBTCbalance after swap ' + WBTCbalance);
  });

  it('should swap ETH to USDC', async function () {
    let USDCbalance = await USDCInstance.balanceOf.call(tester);
    await iUniswapInstance.swapExactETHForTokens(
      0,
      [WETHaddress, USDCaddress],
      tester,
      deadline,
      {
        value: amountETH, // Amount of Ether to send in tx,
      },
    );
    USDCbalance = await USDCInstance.balanceOf.call(tester);
    console.log('USDCbalance after swap ' + USDCbalance);
  });

  it('Should swap and mint through AtomicSwap contract', async function () {
    //Swap and mint
    //WBTC --> USDC --> JEUR

    const atomicSwapInstance = await AtomicSwap.deployed();

    let tokenAmountIn = 10000;
    let collateralAmountOutMin = 0;
    let feePercentage = 2000000000000000;
    let tokenPathSwap = [WBTCaddress, USDCaddress];
    let synthereumPool = '0x9541A4A4D1082ce2f463585c1f519f955147c848';
    let mintParams = {
      derivative: '0xA332832C1321eCfBb35Cc31bCb7d68FC0dB10395',
      minNumTokens: 0,
      collateralAmount: collateralAmountOutMin,
      feePercentage: feePercentage,
      expiration: deadline,
      recipient: destinatary,
    };

    console.log('atomicSwapInstance ' + atomicSwapInstance.address);

    const perpetualPoolParty = await PerpetualPoolParty.at(
      '0xA332832C1321eCfBb35Cc31bCb7d68FC0dB10395',
    );

    //do approve before
    await WBTCInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
      from: tester,
    });

    //console.log("allowance WBTC " + allowanceWBTC);

    await USDCInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
      from: tester,
    });

    //console.log("allowance USDC " + allowanceUSDC);

    //call swapAndMint
    const result = await atomicSwapInstance.swapAndMint(
      tokenAmountIn,
      collateralAmountOutMin,
      tokenPathSwap,
      synthereumPool,
      mintParams,
      {
        from: tester,
      },
    );
    console.log(result);
  });
});
