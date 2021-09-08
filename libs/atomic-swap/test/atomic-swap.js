const AtomicSwap = artifacts.require('AtomicSwap');
//const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

const TestnetERC20 = artifacts.require('TestnetERC20');
const IUniswapV2Router02 = artifacts.require(
  'contracts/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02',
);
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory');
const web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');
const PoolMock = artifacts.require('PoolMock');

const {
  deploy,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

const tokens = require('../data/test/tokens.json');
const uniswap = require('../data/test/uniswap.json');
const synthereum = require('../data/test/synthereum.json');

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

  let WBTCaddress;
  let USDCaddress;
  let JEURaddress;
  let USDTaddress;
  let JEURInstance;
  let WETHaddress;
  let WBTCInstance;
  let USDCInstance;
  let synthereumPool;
  let derivative;
  let uniswapInstance;
  let atomicSwapInstance;
  let feePercentage = 2000000000000000;
  let deadline = ((Date.now() / 1000) | 0) + 7200;

  async function initializeTokens(networkId) {
    WBTCaddress = tokens[networkId].WBTC;
    USDCaddress = tokens[networkId].USDC;
    JEURaddress = tokens[networkId].JEUR;
    USDTaddress = tokens[networkId].USDT;
    return { WBTCaddress, USDCaddress, JEURaddress, USDTaddress };
  }

  async function intializeUniswap(networkId) {
    const iUniswapV2Router02 = await IUniswapV2Router02.at(
      uniswap[networkId].router,
    );
    return iUniswapV2Router02;
  }

  async function initializeTokenInstance(tokenAddress) {
    let tokenInstance = await TestnetERC20.at(tokenAddress);
    return tokenInstance;
  }

  async function initializeSynthereum(networkId) {
    pool = synthereum[networkId].pool;
    derivative = synthereum[networkId].derivative;
    return { pool, derivative };
  }

  before(async () => {
    const networkId = await web3.eth.net.getId();

    const tokens = await initializeTokens(networkId);

    WBTCaddress = tokens.WBTCaddress;
    USDCaddress = tokens.USDCaddress;
    JEURaddress = tokens.JEURaddress;
    USDTaddress = tokens.USDTaddress;

    uniswapInstance = await intializeUniswap(networkId);

    WETHaddress = await uniswapInstance.WETH();

    WBTCInstance = await initializeTokenInstance(WBTCaddress);

    USDCInstance = await initializeTokenInstance(USDCaddress);

    JEURInstance = await initializeTokenInstance(JEURaddress);

    const synthereumAddresses = await initializeSynthereum(networkId);

    synthereumPool = synthereumAddresses.pool;
    derivative = synthereumAddresses.derivative;

    atomicSwapInstance = await AtomicSwap.deployed();

    await transferAllJEUR(tester, unusedAddress);

    await buyWBTC();

    await buyUSDC();
  });

  async function buyWBTC() {
    await uniswapInstance.swapExactETHForTokens(
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
    await uniswapInstance.swapExactETHForTokens(
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

  async function calculateTransactionFee(txnReceipt) {
    try {
      var transactionHash = txnReceipt.transactionHash;
      var transaction = await web3.eth.getTransaction(transactionHash);
      var cost = web3.utils
        .toBN(txnReceipt.gasUsed)
        .mul(web3.utils.toBN(transaction.gasPrice));
      return cost.toString();
    } catch (error) {
      return '0';
    }
  }

  describe('Should swap ERC20 and mint through AtomicSwap contract', async function () {
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

      //call swapExactTokensAndMint

      const txOutput = await atomicSwapInstance.swapExactTokensAndMint(
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

      truffleAssert.eventEmitted(txOutput, 'Swap', ev => {
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
    it('Can not use a not registred pool', async function () {
      const poolMockInstance = await PoolMock.new(
        4,
        USDCaddress,
        'jEUR',
        JEURaddress,
      );

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

      //revert swapExactTokensAndMint

      await truffleAssert.reverts(
        atomicSwapInstance.swapExactTokensAndMint(
          tokenAmountIn,
          0,
          tokenPathSwap,
          poolMockInstance.address,
          mintParams,
          {
            from: tester,
          },
        ),
        'Pool not registred',
      );
    });
    it('Can not use a pivot token different from the collateral of the pool', async function () {
      const tokenAmountIn = 10000;
      const tokenPathSwap = [WBTCaddress, USDTaddress];

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

      //revert swapExactTokensAndMint

      await truffleAssert.reverts(
        atomicSwapInstance.swapExactTokensAndMint(
          tokenAmountIn,
          0,
          tokenPathSwap,
          synthereumPool,
          mintParams,
          {
            from: tester,
          },
        ),
        'Wrong collateral instance',
      );
    });
  });

  describe('Should redeem and swap ERC20 through AtomicSwap contract', async function () {
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

      await atomicSwapInstance.swapExactTokensAndMint(
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
        recipient: ZERO_ADDRESS,
      };

      //do approve before
      await JEURInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
        from: tester,
      });

      const destinataryBalance = await WBTCInstance.balanceOf.call(destinatary);

      //call redeemAndSwapExactTokens

      const txOutput = await atomicSwapInstance.redeemAndSwapExactTokens(
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

      truffleAssert.eventEmitted(txOutput, 'Swap', ev => {
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
    it('Can not use a not registred pool', async function () {
      const poolMockInstance = await PoolMock.new(
        4,
        USDCaddress,
        'jEUR',
        JEURaddress,
      );

      const testerBalance = await JEURInstance.balanceOf.call(tester);
      const tokenAmountIn = testerBalance;

      const tokenPathSwap = [USDCaddress, WBTCaddress];
      const redeemParams = {
        derivative: derivative,
        numTokens: tokenAmountIn.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: ZERO_ADDRESS,
      };

      //do approve before
      await JEURInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
        from: tester,
      });

      //revert redeemAndSwapExactTokens

      await truffleAssert.reverts(
        atomicSwapInstance.redeemAndSwapExactTokens(
          0,
          tokenPathSwap,
          poolMockInstance.address,
          redeemParams,
          destinatary,
          {
            from: tester,
          },
        ),
        'Pool not registred',
      );
    });
    it('Can not use a pivot token different from the collateral of the pool', async function () {
      const testerBalance = await JEURInstance.balanceOf.call(tester);
      const tokenAmountIn = testerBalance;

      const tokenPathSwap = [USDTaddress, WBTCaddress];
      const redeemParams = {
        derivative: derivative,
        numTokens: tokenAmountIn.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: ZERO_ADDRESS,
      };

      //do approve before
      await JEURInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
        from: tester,
      });

      //revert redeemAndSwapExactTokens

      await truffleAssert.reverts(
        atomicSwapInstance.redeemAndSwapExactTokens(
          0,
          tokenPathSwap,
          synthereumPool,
          redeemParams,
          destinatary,
          {
            from: tester,
          },
        ),
        'Wrong collateral instance',
      );
    });
  });

  describe('Should swap ETH and mint through AtomicSwap contract', async function () {
    it('Can swap and emit event', async function () {
      //Swap and mint
      //WBTC --> USDC --> JEUR

      const EthAmountIn = web3Utils.toWei('1');
      const tokenPathSwap = [WETHaddress, USDCaddress];

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: destinatary,
      };

      const testerBalance = await web3.eth.getBalance(tester);
      const destintaryBalance = await JEURInstance.balanceOf.call(destinatary);

      //call swapExactETHAndMint

      const txOutput = await atomicSwapInstance.swapExactETHAndMint(
        0,
        tokenPathSwap,
        synthereumPool,
        mintParams,
        {
          from: tester,
          value: EthAmountIn,
        },
      );

      let tokensReceived;

      truffleAssert.eventEmitted(txOutput, 'Swap', ev => {
        tokensReceived = ev.outputAmount.toString();
        return (
          ev.inpuToken == ZERO_ADDRESS &&
          ev.inputAmount.toString() == EthAmountIn.toString() &&
          ev.outputToken == JEURaddress
        );
      });
      const feePaid = await calculateTransactionFee(txOutput.receipt);
      assert.equal(
        web3Utils
          .toBN(testerBalance)
          .sub(web3Utils.toBN(EthAmountIn))
          .sub(web3Utils.toBN(feePaid))
          .toString(),
        (await web3.eth.getBalance(tester)).toString(),
        'Wrong tester balance',
      );
      assert.equal(
        destintaryBalance.add(web3Utils.toBN(tokensReceived)).toString(),
        (await JEURInstance.balanceOf.call(destinatary)).toString(),
        'Wrong destinatary balance',
      );
    });
    it('Can not use a not registred pool', async function () {
      const poolMockInstance = await PoolMock.new(
        4,
        USDCaddress,
        'jEUR',
        JEURaddress,
      );

      const EthAmountIn = web3Utils.toWei('1');
      const tokenPathSwap = [WETHaddress, USDCaddress];

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: destinatary,
      };

      //revert swapExactETHAndMint

      await truffleAssert.reverts(
        atomicSwapInstance.swapExactETHAndMint(
          0,
          tokenPathSwap,
          poolMockInstance.address,
          mintParams,
          {
            from: tester,
            value: EthAmountIn,
          },
        ),
        'Pool not registred',
      );
    });
    it('Can not use a pivot token different from the collateral of the pool', async function () {
      const EthAmountIn = web3Utils.toWei('1');
      const tokenPathSwap = [WETHaddress, USDTaddress];

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: destinatary,
      };

      //revert swapExactETHAndMint

      await truffleAssert.reverts(
        atomicSwapInstance.swapExactETHAndMint(
          0,
          tokenPathSwap,
          synthereumPool,
          mintParams,
          {
            from: tester,
            value: EthAmountIn,
          },
        ),
        'Wrong collateral instance',
      );
    });
  });

  describe('Should redeem and swap ETH through AtomicSwap contract', async function () {
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

      await atomicSwapInstance.swapExactTokensAndMint(
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
      //Redeem and swap ETH
      //JEUR --> USDC --> ETH
      const testerBalance = await JEURInstance.balanceOf.call(tester);
      const tokenAmountIn = testerBalance;

      const tokenPathSwap = [USDCaddress, WETHaddress];
      const redeemParams = {
        derivative: derivative,
        numTokens: tokenAmountIn.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: ZERO_ADDRESS,
      };

      //do approve before
      await JEURInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
        from: tester,
      });

      const destinataryBalance = await web3.eth.getBalance(destinatary);

      //call redeemAndSwapExactTokensForETH

      const txOutput = await atomicSwapInstance.redeemAndSwapExactTokensForETH(
        0,
        tokenPathSwap,
        synthereumPool,
        redeemParams,
        destinatary,
        {
          from: tester,
        },
      );

      let ethReceived;

      truffleAssert.eventEmitted(txOutput, 'Swap', ev => {
        ethReceived = ev.outputAmount.toString();
        return (
          ev.inpuToken == JEURaddress &&
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.outputToken == ZERO_ADDRESS
        );
      });

      assert.equal(
        testerBalance.sub(web3Utils.toBN(tokenAmountIn)).toString(),
        (await JEURInstance.balanceOf.call(tester)).toString(),
        'Wrong tester balance',
      );
      assert.equal(
        web3Utils
          .toBN(destinataryBalance)
          .add(web3Utils.toBN(ethReceived))
          .toString(),
        (await web3.eth.getBalance(destinatary)).toString(),
        'Wrong destinatary balance',
      );
    });
    it('Can not use a not registred pool', async function () {
      const poolMockInstance = await PoolMock.new(
        4,
        USDCaddress,
        'jEUR',
        JEURaddress,
      );

      const testerBalance = await JEURInstance.balanceOf.call(tester);
      const tokenAmountIn = testerBalance;

      const tokenPathSwap = [USDCaddress, WETHaddress];
      const redeemParams = {
        derivative: derivative,
        numTokens: tokenAmountIn.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: ZERO_ADDRESS,
      };

      //do approve before
      await JEURInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
        from: tester,
      });

      //revert redeemAndSwapExactTokensForETH
      await truffleAssert.reverts(
        atomicSwapInstance.redeemAndSwapExactTokensForETH(
          0,
          tokenPathSwap,
          poolMockInstance.address,
          redeemParams,
          destinatary,
          {
            from: tester,
          },
        ),
        'Pool not registred',
      );
    });
    it('Can not use a pivot token different from the collateral of the pool', async function () {
      const testerBalance = await JEURInstance.balanceOf.call(tester);
      const tokenAmountIn = testerBalance;

      const tokenPathSwap = [USDTaddress, WETHaddress];
      const redeemParams = {
        derivative: derivative,
        numTokens: tokenAmountIn.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: ZERO_ADDRESS,
      };

      //do approve before
      await JEURInstance.approve(atomicSwapInstance.address, tokenAmountIn, {
        from: tester,
      });

      //revert redeemAndSwapExactTokensForETH
      await truffleAssert.reverts(
        atomicSwapInstance.redeemAndSwapExactTokensForETH(
          0,
          tokenPathSwap,
          synthereumPool,
          redeemParams,
          destinatary,
          {
            from: tester,
          },
        ),
        'Wrong collateral instance',
      );
    });
  });
});
