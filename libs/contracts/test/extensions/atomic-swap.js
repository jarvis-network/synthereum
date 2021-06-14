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
  const unusedAddress = accounts[5]; //compte test
  const destinatary = accounts[6];

  let amountETH = web3Utils.toWei('1');

  let WBTCaddress = '0xd3A691C852CDB01E281545A27064741F0B7f6825';
  let USDCaddress = '0xe22da380ee6b445bb8273c81944adeb6e8450422';
  let JEURaddress = '0x85e2565D4Be13B952781317d8f62C8175E9Bdbc7';
  let uniFactory = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
  let synthereumPool = '0x9541A4A4D1082ce2f463585c1f519f955147c848';
  let derivative = '0xA332832C1321eCfBb35Cc31bCb7d68FC0dB10395';
  let feePercentage = 2000000000000000;
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

  async function initializeJEUR() {
    const JEURInstance = await TestnetERC20.at(JEURaddress);
    return JEURInstance;
  }

  //usdc-collateral kovan = 0xe22da380ee6B445bb8273C81944ADEB6E8450422;

  let WETHaddress;
  let WBTCInstance;
  let USDCInstance;
  let JEURInstance;
  let uniswapInstance;
  let uniswapV2Router02;
  let atomicSwapInstance;

  before(async () => {
    iUniswapInstance = await intializeUniswap();

    WETHaddress = await iUniswapInstance.WETH();

    WBTCInstance = await initializeWBTC();

    USDCInstance = await initializeUSDC();

    JEURInstance = await initializeJEUR();

    await transferAllJEUR(tester, unusedAddress);

    atomicSwapInstance = await AtomicSwap.deployed();

    await buyWBTC();

    await buyUSDC();
  });

  async function buyWBTC() {
    await iUniswapInstance.swapExactETHForTokens(
      0,
      [WETHaddress, WBTCaddress],
      tester,
      deadline,
      {
        value: amountETH, // Amount of Ether to send in tx,
      },
    );
    const WBTCbalance = await WBTCInstance.balanceOf.call(tester);
    console.log('WBTCbalance after swap ' + WBTCbalance);
  }

  async function buyUSDC() {
    await iUniswapInstance.swapExactETHForTokens(
      0,
      [WETHaddress, USDCaddress],
      tester,
      deadline,
      {
        value: amountETH, // Amount of Ether to send in tx,
      },
    );
    const USDCbalance = await USDCInstance.balanceOf.call(tester);
    console.log('USDCbalance after swap ' + USDCbalance);
  }

  async function transferAllJEUR(sender, receiver) {
    const totalBalance = await JEURInstance.balanceOf.call(sender);
    await JEURInstance.transfer(receiver, totalBalance, { from: sender });
  }

  describe('Should swap and mint through AtomicSwap contract', async function () {
    it('Can swap and emit event', async function () {
      //Swap and mint
      //WBTC --> USDC --> JEUR

      const tokenAmountIn = 10000;
      const tokenPathSwap = [WBTCaddress, USDCaddress];

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: destinatary,
      };

      //do approve before
      await WBTCInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
        from: tester,
      });

      const testerBalance = await WBTCInstance.balanceOf.call(tester);
      const destintaryBalance = await JEURInstance.balanceOf.call(destinatary);

      //call swapAndMint

      const receipt = await atomicSwapInstance.swapAndMint(
        tokenAmountIn,
        0,
        tokenPathSwap,
        synthereumPool,
        mintParams,
        {
          from: tester,
        },
      );

      let tokensReceived;

      truffleAssert.eventEmitted(receipt, 'Swap', ev => {
        tokensReceived = ev.outputAmount.toString();
        return (
          ev.inpuToken == WBTCaddress &&
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.outputToken == JEURaddress
        );
      });

      assert.equal(
        testerBalance.sub(web3Utils.toBN(tokenAmountIn)).toString(),
        (await WBTCInstance.balanceOf.call(tester)).toString(),
        'Wrong tester balance',
      );
      assert.equal(
        destintaryBalance.add(web3Utils.toBN(tokensReceived)).toString(),
        (await JEURInstance.balanceOf.call(destinatary)).toString(),
        'Wrong destinatary balance',
      );
    });
  });

  describe('Should redeem and swap through AtomicSwap contract', async function () {
    beforeEach(async () => {
      const tokenAmountIn = 10000;
      const tokenPathSwap = [WBTCaddress, USDCaddress];

      let mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: tester,
      };

      //do approve before
      await WBTCInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
        from: tester,
      });

      await atomicSwapInstance.swapAndMint(
        tokenAmountIn,
        0,
        tokenPathSwap,
        synthereumPool,
        mintParams,
        {
          from: tester,
        },
      );
    });
    it('Can swap and emit event', async function () {
      //Redeem and swap
      //JEUR --> USDC --> WBTC
      const testerBalance = await JEURInstance.balanceOf.call(tester);
      const tokenAmountIn = testerBalance;

      const tokenPathSwap = [USDCaddress, WBTCaddress];
      const redeemParams = {
        derivative: derivative,
        numTokens: tokenAmountIn.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: destinatary,
      };

      //do approve before
      await JEURInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
        from: tester,
      });

      const destinataryBalance = await WBTCInstance.balanceOf.call(destinatary);

      //call swapAndMint

      const receipt = await atomicSwapInstance.redeemAndSwap(
        0,
        tokenPathSwap,
        synthereumPool,
        redeemParams,
        destinatary,
        {
          from: tester,
        },
      );

      let tokensReceived;

      truffleAssert.eventEmitted(receipt, 'Swap', ev => {
        tokensReceived = ev.outputAmount.toString();
        return (
          ev.inpuToken == JEURaddress &&
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.outputToken == WBTCaddress
        );
      });

      assert.equal(
        testerBalance.sub(web3Utils.toBN(tokenAmountIn)).toString(),
        (await JEURInstance.balanceOf.call(tester)).toString(),
        'Wrong tester balance',
      );
      assert.equal(
        destinataryBalance.add(web3Utils.toBN(tokensReceived)).toString(),
        (await WBTCInstance.balanceOf.call(destinatary)).toString(),
        'Wrong destinatary balance',
      );
    });
  });
});
