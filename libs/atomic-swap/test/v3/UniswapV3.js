/* eslint-disable */
const { artifacts, contract } = require('hardhat');
const web3Utils = require('web3-utils');

const truffleAssert = require('truffle-assertions');
const { assert } = require('chai');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

const MockContractUser = artifacts.require('MockContractUserV2');
const Proxy = artifacts.require('OnChainLiquidityRouterV2');
const UniV3AtomicSwap = artifacts.require('OCLRV2UniswapV3');
const ISwapRouter = artifacts.require('ISwapRouter');
const IUniswapRouter = artifacts.require(
  '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02',
);

const PoolMock = artifacts.require('PoolMock');

const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumLiquidityPool = artifacts.require('SynthereumLiquidityPool');

const tokens = require('../../data/test/tokens.json');
const uniswap = require('../../data/test/uniswap.json');
const synthereum = require('../../data/test/synthereum.json');

contract('AtomicSwapv2 - UniswapV3', async accounts => {
  let DAIInstance, USDCInstance, jEURInstance, WETHInstance, uniswapInstance;
  let DAIAddress, USDCAddress, USDTAddress, jEURAddress, WETHAddress;
  let networkId;

  let AtomicSwapInstance, ProxyInstance;

  let deadline = ((Date.now() / 1000) | 0) + 7200;
  let amountETH = web3Utils.toWei('1', 'ether');

  const implementationID = 'uniV3';
  const initializeTokenInstanace = async tokenAddress =>
    await TestnetERC20.at(tokenAddress);

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

  const initializeUniswap = async networkId =>
    await ISwapRouter.at(uniswap[networkId].routerV3);

  const initializeSynthereum = async networkId => {
    pool = synthereum[networkId].poolV5;
    poolInstance = await SynthereumLiquidityPool.at(pool);
  };

  const getDAI = async ethAmount => {
    let univ2Router = await IUniswapRouter.at(uniswap[networkId].router);
    await univ2Router.swapExactETHForTokens(
      0,
      [WETHAddress, DAIAddress],
      user,
      deadline,
      { from: user, value: ethAmount },
    );
  };

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
    UniV3Info = {
      routerAddress: uniswap[networkId].routerV3,
    };

    encodedInfo = web3.eth.abi.encodeParameters(
      ['address'],
      [UniV3Info.routerAddress],
    );

    // init uniswap
    uniswapInstance = await initializeUniswap(networkId);

    // initialise tokens
    await initializeTokens(networkId);

    // initialise synthereum
    await initializeSynthereum(networkId);

    // fund the pool
    await getUSDC(web3Utils.toWei('1', 'ether'));
    let balance = await USDCInstance.balanceOf.call(user);
    await USDCInstance.transfer(pool, balance.toString(), { from: user });

    // get deployed Proxy
    ProxyInstance = await Proxy.deployed();

    // get deployed univ3 atomic swap
    AtomicSwapInstance = await UniV3AtomicSwap.deployed();
  });

  describe('From/to ERC20', () => {
    it('mint jSynth from ERC20 - exact input - multihop', async () => {
      const tokenAmountIn = web3Utils.toWei('100000000000', 'wei');
      const tokenPathSwap = [DAIAddress, WETHAddress, USDCAddress];
      const fees = [3000, 3000];

      await getDAI(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const mintParams = {
        minNumTokens: 0,
        collateralAmount: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
      };

      let DAIbalanceBefore = await DAIInstance.balanceOf.call(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      // approve proxy to pull tokens
      await DAIInstance.approve(ProxyInstance.address, tokenAmountIn, {
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
          ev.inputToken.toLowerCase() == DAIAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress.toLowerCase() ==
            AtomicSwapInstance.address.toLowerCase()
        );
      });

      let DAIbalanceAfter = await DAIInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(
        DAIbalanceAfter.eq(DAIbalanceBefore.sub(web3Utils.toBN(tokenAmountIn))),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.add(jSynthOut)), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await DAIInstance.allowance(
            ProxyInstance.address,
            UniV3Info.routerAddress,
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
      const tokenPathSwap = [DAIAddress, WETHAddress, USDCAddress];
      const fees = [3000, 3000];

      await getDAI(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const mintParams = {
        minNumTokens: 0,
        collateralAmount: exactTokensOut,
        expiration: deadline,
        recipient: user,
      };

      let DAIbalanceBefore = await DAIInstance.balanceOf.call(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      const maxTokenAmountIn = DAIbalanceBefore.div(web3Utils.toBN(10));

      // approve proxy to pull tokens
      await DAIInstance.approve(ProxyInstance.address, maxTokenAmountIn, {
        from: user,
      });

      const inputParams = {
        isExactInput: false,
        exactAmount: exactTokensOut,
        minOutOrMaxIn: maxTokenAmountIn.toString(),
        extraParams,
        msgSender: user,
      };

      // tx through proxy
      const tx = await ProxyInstance.swapAndMint(
        implementationID,
        inputParams,
        pool,
        mintParams,
        { from: user },
      );

      let jSynthOut;
      let inputAmount;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputAmount;
        inputAmount = ev.inputAmount;
        return (
          ev.outputAmount > 0 &&
          web3Utils
            .toBN(maxTokenAmountIn)
            .sub(ev.inputAmount)
            .gte(web3Utils.toBN(0)) &&
          ev.inputToken.toLowerCase() == DAIAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress.toLowerCase() ==
            AtomicSwapInstance.address.toLowerCase()
        );
      });

      let DAIbalanceAfter = await DAIInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(DAIbalanceAfter.eq(DAIbalanceBefore.sub(inputAmount)), true);
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.add(jSynthOut)), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await DAIInstance.allowance(
            ProxyInstance.address,
            UniV3Info.routerAddress,
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
      let DAIBalanceBefore = await DAIInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const tokenPathSwap = [USDCAddress, WETHAddress, DAIAddress];
      const fees = [3000, 3000];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: user,
      });

      const redeemParams = {
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
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

      let DAIOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        DAIOut = ev.outputAmount;
        return (
          ev.outputAmount > web3Utils.toBN(0) &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == DAIAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress.toLowerCase() ==
            AtomicSwapInstance.address.toLowerCase()
        );
      });

      let DAIBalanceAfter = await DAIInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(DAIBalanceAfter.eq(DAIBalanceBefore.add(DAIOut)), true);
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.sub(jEURInput)), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await USDCInstance.allowance(
            ProxyInstance.address,
            UniV3Info.routerAddress,
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
      let DAIBalanceBefore = await DAIInstance.balanceOf.call(user);
      let USDCBalanceBefore = await USDCInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore;
      const tokenPathSwap = [USDCAddress, WETHAddress, DAIAddress];
      const fees = [3000, 3000];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: user,
      });

      const expectedOutput = web3Utils.toBN(2);
      const redeemParams = {
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: false,
        unwrapToETH: false,
        exactAmount: expectedOutput.toString(),
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
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

      let collateralRefunded;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        collateralRefunded = ev.collateralAmountRefunded;
        return (
          ev.outputAmount.toString() == expectedOutput.toString() &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == DAIAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.gt(web3Utils.toBN(0)) == true &&
          ev.dexImplementationAddress.toLowerCase() ==
            AtomicSwapInstance.address.toLowerCase()
        );
      });

      let DAIBalanceAfter = await DAIInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);
      let USDCBalanceAfter = await USDCInstance.balanceOf.call(user);

      assert.equal(
        DAIBalanceAfter.eq(DAIBalanceBefore.add(expectedOutput)),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.sub(jEURInput)), true);
      assert.equal(
        USDCBalanceAfter.eq(USDCBalanceBefore.add(collateralRefunded)),
        true,
      );

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await USDCInstance.allowance(
            ProxyInstance.address,
            UniV3Info.routerAddress,
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

      const tokenAmountIn = web3Utils.toWei('10', 'wei');
      const tokenPathSwap = [DAIAddress, WETHAddress, USDCAddress];
      const fees = [3000, 3000];

      await getDAI(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const mintParams = {
        minNumTokens: 0,
        collateralAmount: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
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
      const fees = [3000];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const redeemParams = {
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: jEURInput.toString(),
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
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
      const tokenAmountIn = web3Utils.toWei('10', 'wei');
      const tokenPathSwap = [DAIAddress, USDTAddress];
      const fees = [3000];

      await getDAI(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const mintParams = {
        minNumTokens: 0,
        collateralAmount: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
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
      const tokenPathSwap = [USDTAddress, DAIAddress];
      const fees = [3000];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const redeemParams = {
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: jEURInput.toString(),
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
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

  describe('From ETH', () => {
    it('mint jSynth from ETH - exact input - multihop', async () => {
      const tokenAmountIn = web3Utils.toWei('1', 'gwei');
      const tokenPathSwap = [WETHAddress, USDCAddress];
      const fees = [3000];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const mintParams = {
        minNumTokens: 0,
        collateralAmount: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
      };

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
          ev.outputToken.toLowerCase() ==
            jEURAddress.toLowerCase().toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress.toLowerCase() ==
            AtomicSwapInstance.address.toLowerCase()
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
      const fees = [3000];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const mintParams = {
        minNumTokens: 0,
        collateralAmount: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: false,
        exactAmount: exactTokensOut,
        minOutOrMaxIn: maxTokenAmountIn,
        extraParams,
        msgSender: user,
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

      let jSynthOut, ethInput;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputAmount;
        ethInput = ev.inputAmount;
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
          ev.dexImplementationAddress.toLowerCase() ==
            AtomicSwapInstance.address.toLowerCase()
        );
      });
      let EthBalanceAfter = await web3.eth.getBalance(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      const expectedEthBalance = web3Utils
        .toBN(EthBalanceBefore)
        .sub(txFee)
        .sub(web3Utils.toBN(ethInput));
      assert.equal(
        web3Utils.toBN(EthBalanceAfter).eq(expectedEthBalance),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.add(jSynthOut)), true);
      // assert allowance is 0
      assert.equal(
        (await USDCInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });
    it('burn jSynth and swaps for ETH - exact input - single-hop', async () => {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));
      const fees = [3000];

      const tokenPathSwap = [USDCAddress, WETHAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: user,
      });

      const redeemParams = {
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: true,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
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
          ev.inputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.outputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress.toLowerCase() ==
            AtomicSwapInstance.address.toLowerCase()
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
            UniV3Info.routerAddress,
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
      let USDCBalanceBefore = await USDCInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const fees = [3000];

      const tokenPathSwap = [USDCAddress, WETHAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: user,
      });

      const expectedOutput = web3Utils.toBN(web3Utils.toWei('1', 'gwei'));
      const redeemParams = {
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: false,
        unwrapToETH: true,
        exactAmount: expectedOutput.toString(),
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
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

      let collateralRefunded;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        collateralRefunded = ev.collateralAmountRefunded;
        return (
          ev.outputAmount.toString() == expectedOutput.toString() &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.outputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.gt(web3Utils.toBN(0)) == true &&
          ev.dexImplementationAddress.toLowerCase() ==
            AtomicSwapInstance.address.toLowerCase()
        );
      });

      let EthBalanceAfter = web3Utils.toBN(await web3.eth.getBalance(user));
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);
      let USDCBalanceAfter = await USDCInstance.balanceOf.call(user);

      assert.equal(
        EthBalanceAfter.eq(EthBalanceBefore.add(expectedOutput).sub(ethFee)),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.sub(jEURInput)), true);
      assert.equal(
        USDCBalanceAfter.eq(USDCBalanceBefore.add(collateralRefunded)),
        true,
      );

      // check allowance is set to 0 after the tx
      assert.equal(
        (
          await USDCInstance.allowance(
            ProxyInstance.address,
            UniV3Info.routerAddress,
          )
        ).toString(),
        '0',
      );
      assert.equal(
        (await jEURInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });
    it('Rejects if user cant receive eth refund', async () => {
      const mockContractUser = await MockContractUser.new();
      await mockContractUser.getEth({
        value: web3Utils.toWei('1', 'ether'),
        from: user,
      });

      const tokenPathSwap = [WETHAddress, USDCAddress];
      const fees = [3000];
      const maxTokenAmountIn = web3Utils.toWei('0.8', 'ether');

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const mintParams = {
        minNumTokens: 0,
        collateralAmount: 0,
        expiration: deadline,
        recipient: user,
      };

      const inputParams = {
        isExactInput: false,
        exactAmount: 100,
        minOutOrMaxIn: maxTokenAmountIn,
        extraParams,
        msgSender: user,
      };

      // tx through proxy
      await truffleAssert.reverts(
        mockContractUser.swapAndMint(
          ProxyInstance.address,
          implementationID,
          inputParams,
          pool,
          mintParams,
          { from: user, value: maxTokenAmountIn },
        ),
        'Failed eth refund',
      );
    });
  });
});
