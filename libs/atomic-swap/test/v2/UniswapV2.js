/* eslint-disable */
const { artifacts, contract } = require('hardhat');
const web3Utils = require('web3-utils');

const truffleAssert = require('truffle-assertions');
const { assert } = require('chai');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

const Proxy = artifacts.require('OnChainLiquidityRouter');
const UniV2AtomicSwap = artifacts.require('OCLRUniswapV2');
const IUniswapRouter = artifacts.require(
  '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02',
);
const PoolMock = artifacts.require('PoolMock');

const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumPoolOnChainPriceFeed = artifacts.require(
  'SynthereumPoolOnChainPriceFeed',
);

const tokens = require('../../data/test/tokens.json');
const uniswap = require('../../data/test/uniswap.json');
const synthereum = require('../../data/test/synthereum.json');

contract('UniswapV2', async accounts => {
  let WBTCInstance, USDCInstance, jEURInstance, WETHInstance, uniswapInstance;
  let WBTCAddress, USDCAddress, USDTAddress, jEURAddress, WETHAddress;
  let networkId, UniV2Info, encodedInfo;

  let AtomicSwapInstance, ProxyInstance;

  let feePercentage = 2000000000000000;
  let deadline = ((Date.now() / 1000) | 0) + 7200;
  let amountETH = web3Utils.toWei('1');

  const implementationID = 'uniV2';
  const initializeTokenInstanace = async tokenAddress =>
    await TestnetERC20.at(tokenAddress);

  const initializeTokens = async networkId => {
    USDCAddress = tokens[networkId].USDC;
    WBTCAddress = tokens[networkId].WBTC;
    jEURAddress = tokens[networkId].JEUR;
    WETHAddress = tokens[networkId].WETH;
    USDTAddress = tokens[networkId].USDT;

    WETHInstance = await initializeTokenInstanace(WETHAddress);
    WBTCInstance = await initializeTokenInstanace(WBTCAddress);
    USDCInstance = await initializeTokenInstanace(USDCAddress);
    USDTInstance = await initializeTokenInstanace(USDTAddress);
    jEURInstance = await initializeTokenInstanace(jEURAddress);
  };

  const initializeUniswap = async networkId =>
    await IUniswapRouter.at(uniswap[networkId].router);

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
      deadline,
      {
        value: ethAmount,
        from: user,
      },
    );
  };

  const getTxFee = async txReceipt => {
    try {
      var txHash = txReceipt.tx;
      var tx = await web3.eth.getTransaction(txHash);
      return web3.utils
        .toBN(txReceipt.receipt.gasUsed)
        .mul(web3Utils.toBN(tx.gasPrice));
    } catch (error) {
      console.log(error);
      return web3Utils.toBN('0');
    }
  };

  before(async () => {
    admin = accounts[0];
    user = accounts[1];

    networkId = await web3.eth.net.getId();
    expiration = (await web3.eth.getBlock('latest')).timestamp + 60;
    UniV2Info = {
      routerAddress: uniswap[networkId].router,
    };

    encodedInfo = web3.eth.abi.encodeParameters(
      ['address'],
      [UniV2Info.routerAddress],
    );

    // init uniswap
    uniswapInstance = await initializeUniswap(networkId);

    // initialise tokens
    await initializeTokens(networkId);

    // initialise synthereum
    await initializeSynthereum(networkId);

    // get deployed Proxy
    ProxyInstance = await Proxy.deployed();

    // get deployed univ2 atomic swap
    AtomicSwapInstance = await UniV2AtomicSwap.deployed();
  });

  describe('From/to ERC20', () => {
    it('mint jSynth from ERC20 - exact input - multihop', async () => {
      const tokenAmountIn = 10000;
      const tokenPathSwap = [WBTCAddress, USDTAddress, USDCAddress];

      await getWBTC(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
      };

      let WBTCbalanceBefore = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      // approve proxy to pull tokens
      await WBTCInstance.approve(ProxyInstance.address, tokenAmountIn, {
        from: user,
      });

      // tx through proxy
      const tx = await ProxyInstance.swapAndMint(
        implementationID,
        inputParams,
        pool,
        mintParams,
        { from: user },
      );

      let jSynthOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          ev.inputAmount.toString() == tokenAmountIn &&
          ev.inputToken == WBTCAddress &&
          ev.outputToken == jEURAddress &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress == AtomicSwapInstance.address
        );
      });

      let WBTCbalanceAfter = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(
        WBTCbalanceAfter.eq(
          WBTCbalanceBefore.sub(web3Utils.toBN(tokenAmountIn)),
        ),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.add(jSynthOut)), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await WBTCInstance.allowance(
            ProxyInstance.address,
            UniV2Info.routerAddress,
          )
        ).toString(),
        '0',
      );
      assert.equal(
        (await USDCInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });

    it('mint jSynth from ERC20 - exact output - multihop', async () => {
      const exactTokensOut = 10;
      const tokenPathSwap = [WBTCAddress, USDTAddress, USDCAddress];

      await getWBTC(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: exactTokensOut,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      let WBTCbalanceBefore = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      const maxTokenAmountIn = WBTCbalanceBefore.div(web3Utils.toBN(10));

      const inputParams = {
        isExactInput: false,
        exactAmount: exactTokensOut,
        minOutOrMaxIn: maxTokenAmountIn.toString(),
        extraParams,
      };

      // approve proxy to pull tokens
      await WBTCInstance.approve(ProxyInstance.address, maxTokenAmountIn, {
        from: user,
      });

      // tx through proxy
      const tx = await ProxyInstance.swapAndMint(
        implementationID,
        inputParams,
        pool,
        mintParams,
        { from: user },
      );

      let jSynthOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          web3Utils
            .toBN(maxTokenAmountIn)
            .sub(ev.inputAmount)
            .gte(web3Utils.toBN(0)) &&
          ev.inputToken == WBTCAddress &&
          ev.outputToken == jEURAddress &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress == AtomicSwapInstance.address
        );
      });
      let WBTCbalanceAfter = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      // some WBTC may have been refunded
      assert.equal(
        WBTCbalanceAfter.gt(WBTCbalanceBefore.sub(maxTokenAmountIn)),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.add(jSynthOut)), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await WBTCInstance.allowance(
            ProxyInstance.address,
            UniV2Info.routerAddress,
          )
        ).toString(),
        '0',
      );
      assert.equal(
        (await USDCInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });

    it('burn jSynth and swaps for ERC20 - exact input - single-hop', async () => {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let WBTCBalanceBefore = await WBTCInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const tokenPathSwap = [USDCAddress, WBTCAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: user,
      });

      const redeemParams = {
        derivative: derivative,
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
      };

      // tx through proxy
      const tx = await ProxyInstance.redeemAndSwap(
        implementationID,
        inputParams,
        pool,
        redeemParams,
        user,
        { from: user },
      );

      let WBTCOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        WBTCOut = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken == jEURAddress &&
          ev.outputToken == WBTCAddress &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress == AtomicSwapInstance.address
        );
      });

      let WBTCBalanceAfter = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(WBTCBalanceAfter.eq(WBTCBalanceBefore.add(WBTCOut)), true);
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.sub(jEURInput)), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await USDCInstance.allowance(
            ProxyInstance.address,
            UniV2Info.routerAddress,
          )
        ).toString(),
        '0',
      );
      assert.equal(
        (await jEURInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });

    it('burn jSynth and swaps for ERC20 - exact output- single-hop', async () => {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let USDTBalanceBefore = await USDTInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const tokenPathSwap = [USDCAddress, USDTAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: user,
      });

      const expectedOutput = web3Utils.toBN(2);
      const redeemParams = {
        derivative: derivative,
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: false,
        unwrapToETH: false,
        exactAmount: expectedOutput.toString(),
        minOutOrMaxIn: 0,
        extraParams,
      };

      // tx through proxy
      const tx = await ProxyInstance.redeemAndSwap(
        implementationID,
        inputParams,
        pool,
        redeemParams,
        user,
        { from: user },
      );

      let collateralUsed;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        collateralUsed = ev.outputAmount;
        return (
          ev.outputAmount.toString() == expectedOutput.toString() &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == USDTAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.gt(web3Utils.toBN(0)) == true &&
          ev.dexImplementationAddress == AtomicSwapInstance.address
        );
      });

      let USDTBalanceAfter = await USDTInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(
        USDTBalanceAfter.eq(USDTBalanceBefore.add(expectedOutput)),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.sub(jEURInput)), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await USDCInstance.allowance(
            ProxyInstance.address,
            UniV2Info.routerAddress,
          )
        ).toString(),
        '0',
      );
      assert.equal(
        (await jEURInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });

    it('mintFromERC20 - Rejects with a not registered pool', async function () {
      const poolMockInstance = await PoolMock.new(
        4,
        USDCAddress,
        'jEUR',
        jEURAddress,
      );

      const tokenAmountIn = 10000;
      const tokenPathSwap = [WBTCAddress, USDTAddress, USDCAddress];

      await getWBTC(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
      };

      await truffleAssert.reverts(
        ProxyInstance.swapAndMint(
          implementationID,
          inputParams,
          poolMockInstance.address,
          mintParams,
          { from: user },
        ),
        'Pool not registered',
      );
    });

    it('swapToERC20 - Rejects with a not registered pool', async function () {
      const poolMockInstance = await PoolMock.new(
        4,
        USDCAddress,
        'jEUR',
        jEURAddress,
      );

      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));
      const tokenPathSwap = [USDCAddress, USDTAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const redeemParams = {
        derivative: derivative,
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: jEURInput.toString(),
        minOutOrMaxIn: 0,
        extraParams,
      };

      await truffleAssert.reverts(
        ProxyInstance.redeemAndSwap(
          implementationID,
          inputParams,
          poolMockInstance.address,
          redeemParams,
          user,
          { from: user },
        ),
        'Pool not registered',
      );
    });

    it('mintFromERC20 - Rejects if pool collateral token is missing in swap path', async function () {
      const tokenAmountIn = 10000;
      const tokenPathSwap = [WBTCAddress, USDTAddress];

      await getWBTC(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
      };

      await truffleAssert.reverts(
        ProxyInstance.swapAndMint(
          implementationID,
          inputParams,
          pool,
          mintParams,
          { from: user },
        ),
        'Wrong collateral instance',
      );
    });

    it('swapToERC20 - Rejects if pool collateral token is missing in swap path', async function () {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));
      const tokenPathSwap = [USDTAddress, WBTCAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const redeemParams = {
        derivative: derivative,
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: jEURInput.toString(),
        minOutOrMaxIn: 0,
        extraParams,
      };

      await truffleAssert.reverts(
        ProxyInstance.redeemAndSwap(
          implementationID,
          inputParams,
          pool,
          redeemParams,
          user,
          { from: user },
        ),
        'Wrong collateral instance',
      );
    });
  });

  describe('From/To ETH', () => {
    it('mint jSynth from ETH - exact input - multihop', async () => {
      const tokenAmountIn = web3Utils.toWei('1', 'ether');
      const tokenPathSwap = [WETHAddress, USDTAddress, USDCAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
      };

      // approve proxy to pull tokens
      await WETHInstance.approve(ProxyInstance.address, tokenAmountIn, {
        from: user,
      });

      let EthBalanceBefore = await web3.eth.getBalance(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      // tx through proxy
      const tx = await ProxyInstance.swapAndMint(
        implementationID,
        inputParams,
        pool,
        mintParams,
        { from: user, value: tokenAmountIn },
      );

      const txFee = await getTxFee(tx);

      let jSynthOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          ev.inputAmount.toString() == tokenAmountIn &&
          ev.inputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.outputToken == jEURAddress &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress == AtomicSwapInstance.address
        );
      });

      let EthBalanceAfter = await web3.eth.getBalance(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      const expectedEthBalance = web3Utils
        .toBN(EthBalanceBefore)
        .sub(txFee)
        .sub(web3Utils.toBN(tokenAmountIn));
      assert.equal(
        expectedEthBalance.eq(web3Utils.toBN(EthBalanceAfter)),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.add(jSynthOut)), true);
      // check allowance is set to 0 after the tx
      assert.equal(
        (await USDCInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });

    it('mint jSynth from ETH - exact output - single hop', async () => {
      const maxTokenAmountIn = web3Utils.toWei('1', 'ether');
      const exactTokensOut = 100;
      const tokenPathSwap = [WETHAddress, USDCAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: false,
        exactAmount: exactTokensOut,
        minOutOrMaxIn: maxTokenAmountIn,
        extraParams,
      };

      // approve proxy to pull tokens
      await WETHInstance.approve(ProxyInstance.address, maxTokenAmountIn, {
        from: user,
      });

      let EthBalanceBefore = await web3.eth.getBalance(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      // tx through proxy
      const tx = await ProxyInstance.swapAndMint(
        implementationID,
        inputParams,
        pool,
        mintParams,
        { from: user, value: maxTokenAmountIn },
      );

      const txFee = await getTxFee(tx);

      let jSynthOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          web3Utils
            .toBN(maxTokenAmountIn)
            .sub(ev.inputAmount)
            .gte(web3Utils.toBN(0)) &&
          ev.inputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.outputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress == AtomicSwapInstance.address
        );
      });

      let EthBalanceAfter = await web3.eth.getBalance(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      const minExpectedEthBalance = web3Utils
        .toBN(EthBalanceBefore)
        .sub(txFee)
        .sub(web3Utils.toBN(maxTokenAmountIn));
      assert.equal(
        web3Utils.toBN(EthBalanceAfter).gt(minExpectedEthBalance),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.add(jSynthOut)), true);

      assert.equal(
        (await USDCInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });
    it('burn jSynth and swaps for ETH - exact input - single-hop', async () => {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const tokenPathSwap = [USDCAddress, WETHAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: user,
      });

      const redeemParams = {
        derivative: derivative,
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: true,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
      };

      // tx through proxy
      let EthBalanceBefore = web3Utils.toBN(await web3.eth.getBalance(user));

      const tx = await ProxyInstance.redeemAndSwap(
        implementationID,
        inputParams,
        pool,
        redeemParams,
        user,
        { from: user },
      );
      const ethFee = await getTxFee(tx);

      let EthOutput;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        EthOutput = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken == jEURAddress &&
          ev.outputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress == AtomicSwapInstance.address
        );
      });

      let EthBalanceAfter = web3Utils.toBN(await web3.eth.getBalance(user));
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(
        EthBalanceAfter.eq(EthBalanceBefore.add(EthOutput).sub(ethFee)),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.sub(jEURInput)), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await USDCInstance.allowance(
            ProxyInstance.address,
            UniV2Info.routerAddress,
          )
        ).toString(),
        '0',
      );
      assert.equal(
        (await jEURInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });
    it('burn jSynth and swaps for ETH - exact output- single-hop', async () => {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const tokenPathSwap = [USDCAddress, WETHAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: user,
      });

      const expectedOutput = web3Utils.toBN(2);
      const redeemParams = {
        derivative: derivative,
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: false,
        unwrapToETH: true,
        exactAmount: expectedOutput.toString(),
        minOutOrMaxIn: 0,
        extraParams,
      };

      // tx through proxy
      let EthBalanceBefore = web3Utils.toBN(await web3.eth.getBalance(user));
      const tx = await ProxyInstance.redeemAndSwap(
        implementationID,
        inputParams,
        pool,
        redeemParams,
        user,
        { from: user },
      );
      const ethFee = await getTxFee(tx);

      let collateralUsed;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        collateralUsed = ev.outputAmount;
        return (
          ev.outputAmount.toString() == expectedOutput.toString() &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.outputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.gt(web3Utils.toBN(0)) == true &&
          ev.dexImplementationAddress == AtomicSwapInstance.address
        );
      });

      let EthBalanceAfter = web3Utils.toBN(await web3.eth.getBalance(user));
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(
        EthBalanceAfter.eq(EthBalanceBefore.add(expectedOutput).sub(ethFee)),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.sub(jEURInput)), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await USDCInstance.allowance(
            ProxyInstance.address,
            UniV2Info.routerAddress,
          )
        ).toString(),
        '0',
      );
      assert.equal(
        (await jEURInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });
  });
});
