/* eslint-disable */
const { artifacts, contract } = require('hardhat');
const web3Utils = require('web3-utils');

const truffleAssert = require('truffle-assertions');
const { assert } = require('chai');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

const Proxy = artifacts.require('AtomicSwapProxy');
const UniV3AtomicSwap = artifacts.require('UniV3AtomicSwap');
const ISwapRouter = artifacts.require('ISwapRouter');

const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumPoolOnChainPriceFeed = artifacts.require(
  'SynthereumPoolOnChainPriceFeed',
);

const tokens = require('../../data/test/tokens.json');
const uniswap = require('../../data/test/uniswap.json');
const synthereum = require('../../data/test/synthereum.json');

contract('AtomicSwapv2 - UniswapV3', async accounts => {
  let WBTCInstance, USDCInstance, jEURInstance, uniswapInstance;
  let WBTCAddress, USDCAddress, USDTAddress, jEURAddress, WETHAddress;

  let AtomicSwapAddr,
    ProxyAddress,
    AtomicSwapInstance,
    ProxyInstance,
    synthereumFinderAddress = '0xBeFaa064Ad33668C97D4C8C4d0237682B7D04E34'; // from networks/42.json

  let feePercentage = 2000000000000000;
  let deadline = ((Date.now() / 1000) | 0) + 7200;
  let amountETH = web3Utils.toWei('1');

  const implementationID = 'UniV3';
  const initializeTokenInstanace = async tokenAddress =>
    await TestnetERC20.at(tokenAddress);

  const initializeTokens = async networkId => {
    USDCAddress = tokens[networkId].USDC;
    WBTCAddress = tokens[networkId].WBTC;
    jEURAddress = tokens[networkId].JEUR;
    WETHAddress = tokens[networkId].WETH;
    USDTAddress = tokens[networkId].USDT;

    WBTCInstance = await initializeTokenInstanace(WBTCAddress);
    USDCInstance = await initializeTokenInstanace(USDCAddress);
    USDTInstance = await initializeTokenInstanace(USDTAddress);
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
    let params = {
      tokenIn: WETHAddress,
      tokenOut: WBTCAddress,
      fee: 3000,
      recipient: user,
      deadline,
      amountIn: ethAmount,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    await uniswapInstance.exactInputSingle(params, {
      value: ethAmount,
      from: user,
    });
  };

  const getUSDC = async ethAmount => {
    let params = {
      tokenIn: WETHAddress,
      tokenOut: USDCAddress,
      fee: 3000,
      recipient: user,
      deadline,
      amountIn: ethAmount,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    await uniswapInstance.exactInputSingle(params, {
      value: ethAmount,
      from: user,
    });
  };

  const getUSDT = async ethAmount => {
    let params = {
      tokenIn: WETHAddress,
      tokenOut: USDTAddress,
      fee: 3000,
      recipient: user,
      deadline,
      amountIn: ethAmount,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    await uniswapInstance.exactInputSingle(params, {
      value: ethAmount,
      from: user,
    });
  };

  before(async () => {
    admin = accounts[0];
    user = accounts[1];

    const networkId = await web3.eth.net.getId();
    expiration = (await web3.eth.getBlock('latest')).timestamp + 60;

    // init uniswap
    uniswapInstance = await initializeUniswap(networkId);

    // initialise tokens
    await initializeTokens(networkId);

    // initialise synthereum
    await initializeSynthereum(networkId);

    // get deployed Proxy
    ProxyInstance = await Proxy.deployed();

    // get deployed univ3 atomic swap
    AtomicSwapInstance = await UniV3AtomicSwap.deployed();
  });

  describe('From/to ERC20', () => {
    it('mint jSynth from ERC20 - exact input', async () => {
      const tokenAmountIn = 10000;
      const tokenPathSwap = [WBTCAddress, USDCAddress];
      const fees = [3000];

      await getWBTC(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const mintParams = {
        derivative: derivative,
        minNumTokens: 0,
        collateralAmount: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
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
        true,
        tokenAmountIn,
        0,
        extraParams,
        pool,
        mintParams,
        { from: user },
      );

      let jSynthOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputTokens;
        return ev.outputTokens > 0;
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
    });
    // TODO FAILS FOR SLIPPAGE STF error
    it.skip('mint jSynth from ERC20 - exact output', async () => {
      const exactTokensOut = web3Utils.toWei('10');
      const tokenPathSwap = [WBTCAddress, USDCAddress];
      const fees = [3000];

      await getWBTC(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
      );

      const mintParams = {
        derivative: derivative,
        minNumTokens: 1,
        collateralAmount: exactTokensOut,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      let WBTCbalanceBefore = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      const maxTokenAmountIn = WBTCbalanceBefore.div(web3Utils.toBN(100));

      // approve proxy to pull tokens
      await WBTCInstance.approve(ProxyInstance.address, maxTokenAmountIn, {
        from: user,
      });

      // let UniV3Info = {
      //   routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      //   synthereumFinder: "0xD451dE78E297b496ee8a4f06dCF991C17580B452",
      //   nativeCryptoAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      // };

      // const tx = await AtomicSwapInstance.swapToCollateralAndMint(
      //   UniV3Info,
      //   false,
      //   exactTokensOut,
      //   maxTokenAmountIn,
      //   extraParams,
      //   pool,
      //   mintParams,
      //   {from:user}
      // );

      // tx through proxy
      const tx = await ProxyInstance.swapAndMint(
        implementationID,
        false,
        exactTokensOut,
        maxTokenAmountIn,
        extraParams,
        pool,
        mintParams,
        { from: user },
      );

      // TODO
    });

    it('burn jSynth and swaps for ERC20 - exact input', async () => {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let WBTCBalanceBefore = await WBTCInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const tokenPathSwap = [USDCAddress, WBTCAddress];
      const fees = [3000];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['uint24[]', 'address[]'],
        [fees, tokenPathSwap],
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

      // tx through proxy
      const tx = await ProxyInstance.redeemCollateralAndSwap(
        implementationID,
        true,
        0,
        0,
        extraParams,
        pool,
        redeemParams,
        user,
        { from: user },
      );

      let WBTCOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        WBTCOut = ev.outputTokens;
        return ev.outputTokens > 0;
      });

      let WBTCBalanceAfter = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(WBTCBalanceAfter.eq(WBTCBalanceBefore.add(WBTCOut)), true);
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.sub(jEURInput)), true);
    });

    it('burn jSynth and swaps for ERC20 - exact output', async () => {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let USDTBalanceBefore = await USDTInstance.balanceOf.call(user);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const tokenPathSwap = [USDTAddress, USDCAddress];
      const fees = [3000];

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
        derivative: derivative,
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        feePercentage: feePercentage,
        expiration: deadline,
        recipient: user,
      };

      // tx through proxy
      const tx = await ProxyInstance.redeemCollateralAndSwap(
        implementationID,
        false,
        expectedOutput,
        0,
        extraParams,
        pool,
        redeemParams,
        user,
        { from: user },
      );

      let collateralUsed;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        collateralUsed = ev.outputTokens;
        return ev.outputTokens > 0;
      });

      let USDTBalanceAfter = await USDTInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(
        USDTBalanceAfter.eq(USDTBalanceBefore.add(expectedOutput)),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.sub(jEURInput)), true);
    });
  });

  describe('From/to ETH', () => {
    it('mint jSynth from ETH', async () => {});
    it('mint jSynth from ETH - exact input', async () => {});
    it('burn jSynth and swaps for ETH - exact output', async () => {});
  });
});
