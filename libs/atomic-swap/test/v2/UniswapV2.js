/* eslint-disable */
const { artifacts, contract } = require('hardhat');
const web3Utils = require('web3-utils');

const truffleAssert = require('truffle-assertions');
const { assert } = require('chai');
const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

const Proxy = artifacts.require('AtomicSwapProxy');
const UniV2AtomicSwap = artifacts.require('UniV2AtomicSwap');
const IUniswapRouter = artifacts.require(
  'contracts/v2/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02',
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
      synthereumFinder: '0xD451dE78E297b496ee8a4f06dCF991C17580B452',
      nativeCryptoAddress: tokens[networkId].WETH,
    };

    encodedInfo = web3.eth.abi.encodeParameters(
      ['address', 'address', 'address'],
      [
        UniV2Info.routerAddress,
        UniV2Info.synthereumFinder,
        UniV2Info.nativeCryptoAddress,
      ],
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

      // approve proxy to pull tokens
      await WBTCInstance.approve(ProxyInstance.address, maxTokenAmountIn, {
        from: user,
      });

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

      let jSynthOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputTokens;
        return ev.outputTokens > 0;
      });

      let WBTCbalanceAfter = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      // some WBTC may have been refunded
      assert.equal(
        WBTCbalanceAfter.gt(WBTCbalanceBefore.sub(maxTokenAmountIn)),
        true,
      );
      assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore.add(jSynthOut)), true);
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

      // caalling the implementation directly to being able to read revert message
      await truffleAssert.reverts(
        AtomicSwapInstance.swapToCollateralAndMint(
          encodedInfo,
          true,
          tokenAmountIn,
          0,
          extraParams,
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

      // caalling the implementation directly to being able to read revert message
      await truffleAssert.reverts(
        AtomicSwapInstance.redeemCollateralAndSwap(
          encodedInfo,
          true,
          jEURInput.toString(),
          0,
          extraParams,
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

      // caalling the implementation directly to being able to read revert message
      await truffleAssert.reverts(
        AtomicSwapInstance.swapToCollateralAndMint(
          encodedInfo,
          true,
          tokenAmountIn,
          0,
          extraParams,
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

      // caalling the implementation directly to being able to read revert message
      await truffleAssert.reverts(
        AtomicSwapInstance.redeemCollateralAndSwap(
          encodedInfo,
          true,
          jEURInput.toString(),
          0,
          extraParams,
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

      // approve proxy to pull tokens
      await WETHInstance.approve(ProxyInstance.address, tokenAmountIn, {
        from: user,
      });

      let EthBalanceBefore = await web3.eth.getBalance(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      // tx through proxy
      const tx = await ProxyInstance.swapAndMint(
        implementationID,
        true,
        tokenAmountIn,
        0,
        extraParams,
        pool,
        mintParams,
        { from: user, value: tokenAmountIn },
      );

      const txFee = await getTxFee(tx);

      let jSynthOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputTokens;
        return ev.outputTokens > 0;
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

      // approve proxy to pull tokens
      await WETHInstance.approve(ProxyInstance.address, maxTokenAmountIn, {
        from: user,
      });

      let EthBalanceBefore = await web3.eth.getBalance(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

      // tx through proxy
      const tx = await ProxyInstance.swapAndMint(
        implementationID,
        false,
        exactTokensOut,
        maxTokenAmountIn,
        extraParams,
        pool,
        mintParams,
        { from: user, value: maxTokenAmountIn },
      );

      const txFee = await getTxFee(tx);

      let jSynthOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jSynthOut = ev.outputTokens;
        return ev.outputTokens > 0;
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
    });
  });
});