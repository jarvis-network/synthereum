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
const FixedRateRegistry = artifacts.require('SynthereumFixedRateRegistry');
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

contract('FixedRateSwap - UniswapV2', async accounts => {
  let WBTCInstance, USDCInstance, jEURInstance, WETHInstance, uniswapInstance;
  let WBTCAddress,
    USDCAddress,
    USDTAddress,
    jEURAddress,
    jGBPAddress,
    jBGNAddress,
    WETHAddress,
    synthereumFinderAddress;
  let networkId;
  let user = accounts[2];
  let implementationID = 'uniV2';
  let fixedRateSwapInstance,
    jBGNInstance,
    fixedRateWrapperInstance,
    proxyInstance,
    atomicSwapAddr,
    poolMock,
    jEURPool,
    jGBPPool;

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
  const getWBTC = async (ethAmount, recipient) => {
    await uniswapInstance.swapExactETHForTokens(
      0,
      [WETHAddress, WBTCAddress],
      recipient,
      deadline,
      {
        value: ethAmount,
        from: recipient,
      },
    );
  };
  const initializeTokens = async networkId => {
    USDCAddress = tokens[networkId].USDC;
    WBTCAddress = tokens[networkId].WBTC;
    jEURAddress = tokens[networkId].JEUR;
    jGBPAddress = tokens[networkId].JGBP;
    wjBGNAddress = tokens[networkId].WJBGN;
    jBGNAddress = tokens[networkId].JBGN;
    WETHAddress = tokens[networkId].WETH;
    USDTAddress = tokens[networkId].USDT;

    fixedRateWrapperInstance = await FixedRateWrapper.at(wjBGNAddress);
    WETHInstance = await initializeTokenInstanace(WETHAddress);
    WBTCInstance = await initializeTokenInstanace(WBTCAddress);
    USDCInstance = await initializeTokenInstanace(USDCAddress);
    USDTInstance = await initializeTokenInstanace(USDTAddress);
    jEURInstance = await initializeTokenInstanace(jEURAddress);
    jGBPInstance = await initializeTokenInstanace(jGBPAddress);
  };

  const initializeUniswap = async networkId =>
    await IUniswapRouter.at(uniswap[networkId].router);

  const initializeSynthereum = async networkId => {
    jEURPool = synthereum[networkId].jEURPool;
    jGBPPool = synthereum[networkId].jGBPPool;
    poolMock = await PoolMock.new(5, USDCAddress, 'jGBP', jGBPPool);
  };

  before(async () => {
    admin = accounts[0];
    user = accounts[1];

    networkId = await web3.eth.net.getId();
    const networkFile = require(`@jarvis-network/synthereum-contracts/networks/${networkId}.json`);
    synthereumFinderAddress = networkFile.filter(
      elem => elem.contractName === 'SynthereumFinder',
    )[0].address;

    expiration = (await web3.eth.getBlock('latest')).timestamp + 60;

    // init uniswap
    uniswapInstance = await initializeUniswap(networkId);

    // initialise tokens
    await initializeTokens(networkId);

    // initialise synthereum
    await initializeSynthereum(networkId);

    // fund the pool
    await getUSDC(web3Utils.toWei('2', 'ether'));
    let balance = await USDCInstance.balanceOf.call(user);
    await USDCInstance.transfer(jEURPool, balance.divn(2).toString(), {
      from: user,
    });
    await USDCInstance.transfer(jGBPPool, balance.divn(2).toString(), {
      from: user,
    });

    // get deployed Proxy
    proxyInstance = await Proxy.deployed();
    atomicSwapAddr = await proxyInstance.getImplementationAddress.call(
      implementationID,
    );

    // get jBGN instance
    jBGNInstance = await SyntheticToken.at(jBGNAddress);

    fixedRateSwapInstance = await FixedRateSwap.deployed();
  });

  it('Fixed Rate deployment', async () => {
    assert.equal(
      jEURAddress.toLowerCase(),
      (await fixedRateWrapperInstance.collateralToken.call()).toLowerCase(),
    );
  });

  describe('wrapFixedRateFrom - ERC20', async () => {
    it('correctly swaps ERC20 into fixed rate (swapAndMint + wrap)', async () => {
      const tokenAmountIn = web3Utils.toWei('10', 'wei');
      const tokenPathSwap = [WBTCAddress, WETHAddress, USDCAddress];

      await getWBTC(amountETH, user);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const synthereumMintParams = {
        synthereumFinder: synthereumFinderAddress,
        synthereumPool: jEURPool,
        mintParams: {
          minNumTokens: 0,
          collateralAmount: 0,
          expiration: deadline,
          recipient: user,
        },
      };

      const swapMintParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
      };

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            SwapMintPegParams: {
              swapMintParams: {
                isExactInput: 'bool',
                exactAmount: 'uint256',
                minOutOrMaxIn: 'uint256',
                extraParams: 'bytes',
                msgSender: 'address',
              },
              mintParams: {
                synthereumFinder: 'address',
                synthereumPool: 'address',
                mintParams: {
                  minNumTokens: 'uint256',
                  collateralAmount: 'uint256',
                  expiration: 'uint256',
                  recipient: 'address',
                },
              },
            },
          },
        ],
        [
          {
            swapMintParams: {
              isExactInput: swapMintParams.isExactInput,
              exactAmount: swapMintParams.exactAmount,
              minOutOrMaxIn: swapMintParams.minOutOrMaxIn,
              extraParams: swapMintParams.extraParams,
              msgSender: swapMintParams.msgSender,
            },
            mintParams: {
              synthereumFinder: synthereumMintParams.synthereumFinder,
              synthereumPool: synthereumMintParams.synthereumPool,
              mintParams: {
                minNumTokens: synthereumMintParams.mintParams.minNumTokens,
                collateralAmount:
                  synthereumMintParams.mintParams.collateralAmount,
                expiration: synthereumMintParams.mintParams.expiration,
                recipient: synthereumMintParams.mintParams.recipient,
              },
            },
          },
        ],
      );

      let WBTCbalanceBefore = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceBefore = await jBGNInstance.balanceOf.call(user);
      // approve proxy to pull tokens
      await WBTCInstance.approve(proxyInstance.address, tokenAmountIn, {
        from: user,
      });

      let tx = await proxyInstance.wrapFixedRateFrom(
        true,
        implementationID,
        WBTCAddress,
        fixedRateWrapperInstance.address,
        encodedParams,
        user,
        { from: user },
      );
      let jBGNOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jBGNOut = ev.outputAmount;
        return (
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.inputToken.toLowerCase() == WBTCAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == jBGNAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0
        );
      });
      let WBTCbalanceAfter = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceAfter = await jBGNInstance.balanceOf.call(user);

      assert.equal(
        WBTCbalanceBefore.sub(web3Utils.toBN(tokenAmountIn)).toString(),
        WBTCbalanceAfter.toString(),
      );
      assert.equal(jEURBalanceAfter.toString(), jEURBalanceBefore.toString());
      assert.equal(
        jBGNBalanceBefore.add(jBGNOut).toString(),
        jBGNBalanceAfter.toString(),
      );
    });
    it('correctly mint fixed rate from peg token collateral (mint + wrap)', async () => {
      const tokenAmountIn = web3Utils.toWei('10', 'wei');

      // the token swap path is not used in this case, might as well be set as empty bytes
      const tokenPathSwap = [USDCAddress];
      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      await getUSDC(amountETH, user);

      const synthereumMintParams = {
        synthereumFinder: synthereumFinderAddress,
        synthereumPool: jEURPool,
        mintParams: {
          minNumTokens: 0,
          collateralAmount: tokenAmountIn,
          expiration: deadline,
          recipient: user,
        },
      };

      const swapMintParams = {
        isExactInput: true,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
      };

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            SwapMintPegParams: {
              swapMintParams: {
                isExactInput: 'bool',
                exactAmount: 'uint256',
                minOutOrMaxIn: 'uint256',
                extraParams: 'bytes',
                msgSender: 'address',
              },
              mintParams: {
                synthereumFinder: 'address',
                synthereumPool: 'address',
                mintParams: {
                  minNumTokens: 'uint256',
                  collateralAmount: 'uint256',
                  expiration: 'uint256',
                  recipient: 'address',
                },
              },
            },
          },
        ],
        [
          {
            swapMintParams: {
              isExactInput: swapMintParams.isExactInput,
              exactAmount: swapMintParams.exactAmount,
              minOutOrMaxIn: swapMintParams.minOutOrMaxIn,
              extraParams: swapMintParams.extraParams,
              msgSender: swapMintParams.msgSender,
            },
            mintParams: {
              synthereumFinder: synthereumMintParams.synthereumFinder,
              synthereumPool: synthereumMintParams.synthereumPool,
              mintParams: {
                minNumTokens: synthereumMintParams.mintParams.minNumTokens,
                collateralAmount:
                  synthereumMintParams.mintParams.collateralAmount,
                expiration: synthereumMintParams.mintParams.expiration,
                recipient: synthereumMintParams.mintParams.recipient,
              },
            },
          },
        ],
      );

      let USDCBalanceBefore = await USDCInstance.balanceOf.call(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceBefore = await jBGNInstance.balanceOf.call(user);
      // approve proxy to pull tokens
      await USDCInstance.approve(proxyInstance.address, tokenAmountIn, {
        from: user,
      });

      let tx = await proxyInstance.wrapFixedRateFrom(
        true,
        implementationID,
        USDCAddress,
        fixedRateWrapperInstance.address,
        encodedParams,
        user,
        { from: user },
      );
      let jBGNOut;

      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jBGNOut = ev.outputAmount;
        return (
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.inputToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == jBGNAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0
        );
      });
      let USDCBalanceAfter = await USDCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceAfter = await jBGNInstance.balanceOf.call(user);

      assert.equal(
        USDCBalanceBefore.sub(web3Utils.toBN(tokenAmountIn)).toString(),
        USDCBalanceAfter.toString(),
      );
      assert.equal(jEURBalanceAfter.toString(), jEURBalanceBefore.toString());
      assert.equal(
        jBGNBalanceBefore.add(jBGNOut).toString(),
        jBGNBalanceAfter.toString(),
      );
    });
    it('reverts with pool and peg token mismatch', async () => {
      const tokenAmountIn = web3Utils.toWei('10', 'wei');
      const tokenPathSwap = [WBTCAddress, WETHAddress, USDCAddress];

      await getWBTC(amountETH, user);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const synthereumMintParams = {
        synthereumFinder: synthereumFinderAddress,
        synthereumPool: poolMock.address,
        mintParams: {
          minNumTokens: 0,
          collateralAmount: 0,
          expiration: deadline,
          recipient: user,
        },
      };

      const swapMintParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: user,
      };

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            SwapMintPegParams: {
              swapMintParams: {
                isExactInput: 'bool',
                exactAmount: 'uint256',
                minOutOrMaxIn: 'uint256',
                extraParams: 'bytes',
                msgSender: 'address',
              },
              mintParams: {
                synthereumFinder: 'address',
                synthereumPool: 'address',
                mintParams: {
                  minNumTokens: 'uint256',
                  collateralAmount: 'uint256',
                  expiration: 'uint256',
                  recipient: 'address',
                },
              },
            },
          },
        ],
        [
          {
            swapMintParams: {
              isExactInput: swapMintParams.isExactInput,
              exactAmount: swapMintParams.exactAmount,
              minOutOrMaxIn: swapMintParams.minOutOrMaxIn,
              extraParams: swapMintParams.extraParams,
              msgSender: swapMintParams.msgSender,
            },
            mintParams: {
              synthereumFinder: synthereumMintParams.synthereumFinder,
              synthereumPool: synthereumMintParams.synthereumPool,
              mintParams: {
                minNumTokens: synthereumMintParams.mintParams.minNumTokens,
                collateralAmount:
                  synthereumMintParams.mintParams.collateralAmount,
                expiration: synthereumMintParams.mintParams.expiration,
                recipient: synthereumMintParams.mintParams.recipient,
              },
            },
          },
        ],
      );

      // approve proxy to pull tokens
      await WBTCInstance.approve(proxyInstance.address, tokenAmountIn, {
        from: user,
      });

      await truffleAssert.reverts(
        proxyInstance.wrapFixedRateFrom(
          true,
          implementationID,
          WBTCAddress,
          fixedRateWrapperInstance.address,
          encodedParams,
          user,
          { from: user },
        ),
        'Pool and jSynth mismatch',
      );
    });
    it('reverts with bad implementationID', async () => {
      await truffleAssert.reverts(
        proxyInstance.wrapFixedRateFrom(
          true,
          'badID',
          WBTCAddress,
          fixedRateWrapperInstance.address,
          web3Utils.utf8ToHex('encodedParams'),
          user,
          { from: user },
        ),
        'Implementation id not registered',
      );
    });
  });
  describe('wrapFixedRateFrom - jSynth', async () => {
    it('correctly swaps jSynth into FixedRate via pool exchange', async () => {
      // mint jBGP
      const tokenAmountIn = web3Utils.toWei('10', 'wei');
      const tokenPathSwap = [WBTCAddress, WETHAddress, USDCAddress];

      await getWBTC(amountETH, user);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
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

      // approve proxy to pull tokens
      await WBTCInstance.approve(proxyInstance.address, tokenAmountIn, {
        from: user,
      });

      // tx through proxy
      await proxyInstance.swapAndMint(
        implementationID,
        inputParams,
        jGBPPool,
        mintParams,
        { from: user },
      );

      let jGBPBalanceBefore = await jGBPInstance.balanceOf.call(user);
      let jGBPInput = jGBPBalanceBefore.divn(2);

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            SynthereumExchangeParams: {
              synthereumFinder: 'address',
              inputSynthereumPool: 'address',
              exchangeParams: {
                destPool: 'address',
                numTokens: 'uint256',
                minDestNumTokens: 'uint256',
                expiration: 'uint256',
                recipient: 'address',
              },
            },
          },
        ],
        [
          {
            synthereumFinder: synthereumFinderAddress,
            inputSynthereumPool: jGBPPool,
            exchangeParams: {
              destPool: jEURPool,
              numTokens: jGBPInput.toString(),
              minDestNumTokens: 0,
              expiration: deadline,
              recipient: user,
            },
          },
        ],
      );

      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceBefore = await jBGNInstance.balanceOf.call(user);

      // approve proxy
      await jGBPInstance.approve(proxyInstance.address, jGBPInput, {
        from: user,
      });
      let tx = await proxyInstance.wrapFixedRateFrom(
        false,
        implementationID,
        jGBPAddress,
        fixedRateWrapperInstance.address,
        encodedParams,
        user,
        { from: user },
      );

      let jBGNOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jBGNOut = ev.outputAmount;
        return (
          ev.inputAmount.toString() == jGBPInput.toString() &&
          ev.inputToken.toLowerCase() == jGBPAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == jBGNAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0
        );
      });
      let jGBPBalanceAfter = await jGBPInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceAfter = await jBGNInstance.balanceOf.call(user);

      assert.equal(
        jGBPBalanceBefore.sub(web3Utils.toBN(jGBPInput)).toString(),
        jGBPBalanceAfter.toString(),
      );
      assert.equal(jEURBalanceAfter.toString(), jEURBalanceBefore.toString());
      assert.equal(
        jBGNBalanceBefore.add(jBGNOut).toString(),
        jBGNBalanceAfter.toString(),
      );
    });
    it('reverts with pool and peg token mismatch', async () => {
      let jGBPBalanceBefore = await jGBPInstance.balanceOf.call(user);
      let jGBPInput = jGBPBalanceBefore.divn(2);

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            SynthereumExchangeParams: {
              synthereumFinder: 'address',
              inputSynthereumPool: 'address',
              exchangeParams: {
                destPool: 'address',
                numTokens: 'uint256',
                minDestNumTokens: 'uint256',
                expiration: 'uint256',
                recipient: 'address',
              },
            },
          },
        ],
        [
          {
            synthereumFinder: synthereumFinderAddress,
            inputSynthereumPool: jGBPPool,
            exchangeParams: {
              destPool: poolMock.address,
              numTokens: jGBPInput.toString(),
              minDestNumTokens: 0,
              expiration: deadline,
              recipient: user,
            },
          },
        ],
      );

      // approve proxy
      await jGBPInstance.approve(proxyInstance.address, jGBPInput, {
        from: user,
      });
      await truffleAssert.reverts(
        proxyInstance.wrapFixedRateFrom(
          false,
          implementationID,
          jGBPAddress,
          fixedRateWrapperInstance.address,
          encodedParams,
          user,
          { from: user },
        ),
        'Pool and jSynth mismatch',
      );
    });
  });

  describe('unwrapFixedRateTo - ERC20', async () => {
    it('correctly swaps Fixed Rate into ERC20 (unwrap + redeemAndSwap', async () => {
      let tokenAmountIn = await jBGNInstance.balanceOf.call(user);
      tokenAmountIn = tokenAmountIn.divn(4);
      const tokenPathSwap = [USDCAddress, WETHAddress, WBTCAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const synthereumRedeemParams = {
        synthereumFinder: synthereumFinderAddress,
        synthereumPool: jEURPool,
        redeemParams: {
          numTokens: 0,
          minCollateral: 0,
          expiration: deadline,
          recipient: user,
        },
      };

      const redeemSwapParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: fixedRateSwapInstance.address,
      };

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            RedeemPegSwapParams: {
              recipient: 'address',
              redeemSwapParams: {
                isExactInput: 'bool',
                unwrapToETH: 'bool',
                exactAmount: 'uint256',
                minOutOrMaxIn: 'uint256',
                extraParams: 'bytes',
                msgSender: 'address',
              },
              redeemParams: {
                synthereumFinder: 'address',
                synthereumPool: 'address',
                redeemParams: {
                  numTokens: 'uint256',
                  minCollateral: 'uint256',
                  expiration: 'uint256',
                  recipient: 'address',
                },
              },
            },
          },
        ],
        [
          {
            recipient: user,
            redeemSwapParams: {
              isExactInput: redeemSwapParams.isExactInput,
              unwrapToETH: redeemSwapParams.unwrapToETH,
              exactAmount: redeemSwapParams.exactAmount,
              minOutOrMaxIn: redeemSwapParams.minOutOrMaxIn,
              extraParams: redeemSwapParams.extraParams,
              msgSender: redeemSwapParams.msgSender,
            },
            redeemParams: {
              synthereumFinder: synthereumRedeemParams.synthereumFinder,
              synthereumPool: synthereumRedeemParams.synthereumPool,
              redeemParams: {
                numTokens: synthereumRedeemParams.redeemParams.numTokens,
                minCollateral:
                  synthereumRedeemParams.redeemParams.minCollateral,
                expiration: synthereumRedeemParams.redeemParams.expiration,
                recipient: synthereumRedeemParams.redeemParams.recipient,
              },
            },
          },
        ],
      );

      let WBTCbalanceBefore = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceBefore = await jBGNInstance.balanceOf.call(user);

      // approve proxy to pull tokens
      await jBGNInstance.approve(proxyInstance.address, tokenAmountIn, {
        from: user,
      });
      let tx = await proxyInstance.unwrapFixedRateTo(
        true,
        implementationID,
        fixedRateWrapperInstance.address,
        WBTCAddress,
        tokenAmountIn,
        encodedParams,
        { from: user },
      );
      let WBTCOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        WBTCOut = ev.outputAmount;
        return (
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.inputToken.toLowerCase() == jBGNAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == WBTCAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0
        );
      });
      let WBTCbalanceAfter = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceAfter = await jBGNInstance.balanceOf.call(user);

      assert.equal(
        WBTCbalanceBefore.add(WBTCOut).toString(),
        WBTCbalanceAfter.toString(),
      );
      assert.equal(jEURBalanceAfter.toString(), jEURBalanceBefore.toString());
      assert.equal(
        jBGNBalanceBefore.sub(tokenAmountIn).toString(),
        jBGNBalanceAfter.toString(),
      );
    });
    it('correctly swaps Fixed Rate into peg token collateral (unwrap + redeem)', async () => {
      let tokenAmountIn = await jBGNInstance.balanceOf.call(user);
      tokenAmountIn = tokenAmountIn.divn(4);
      // the token swap path is not used in this case, might as well be set as empty bytes
      const tokenPathSwap = [USDCAddress];
      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const synthereumRedeemParams = {
        synthereumFinder: synthereumFinderAddress,
        synthereumPool: jEURPool,
        redeemParams: {
          numTokens: 0,
          minCollateral: 0,
          expiration: deadline,
          recipient: user,
        },
      };

      const redeemSwapParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: fixedRateSwapInstance.address,
      };

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            RedeemPegSwapParams: {
              recipient: 'address',
              redeemSwapParams: {
                isExactInput: 'bool',
                unwrapToETH: 'bool',
                exactAmount: 'uint256',
                minOutOrMaxIn: 'uint256',
                extraParams: 'bytes',
                msgSender: 'address',
              },
              redeemParams: {
                synthereumFinder: 'address',
                synthereumPool: 'address',
                redeemParams: {
                  numTokens: 'uint256',
                  minCollateral: 'uint256',
                  expiration: 'uint256',
                  recipient: 'address',
                },
              },
            },
          },
        ],
        [
          {
            recipient: user,
            redeemSwapParams: {
              isExactInput: redeemSwapParams.isExactInput,
              unwrapToETH: redeemSwapParams.unwrapToETH,
              exactAmount: redeemSwapParams.exactAmount,
              minOutOrMaxIn: redeemSwapParams.minOutOrMaxIn,
              extraParams: redeemSwapParams.extraParams,
              msgSender: redeemSwapParams.msgSender,
            },
            redeemParams: {
              synthereumFinder: synthereumRedeemParams.synthereumFinder,
              synthereumPool: synthereumRedeemParams.synthereumPool,
              redeemParams: {
                numTokens: synthereumRedeemParams.redeemParams.numTokens,
                minCollateral:
                  synthereumRedeemParams.redeemParams.minCollateral,
                expiration: synthereumRedeemParams.redeemParams.expiration,
                recipient: synthereumRedeemParams.redeemParams.recipient,
              },
            },
          },
        ],
      );

      let USDCBalanceBefore = await USDCInstance.balanceOf.call(user);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceBefore = await jBGNInstance.balanceOf.call(user);

      // approve proxy to pull tokens
      await jBGNInstance.approve(proxyInstance.address, tokenAmountIn, {
        from: user,
      });
      let tx = await proxyInstance.unwrapFixedRateTo(
        true,
        implementationID,
        fixedRateWrapperInstance.address,
        USDCAddress,
        tokenAmountIn,
        encodedParams,
        { from: user },
      );
      let USDCOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        USDCOut = ev.outputAmount;
        return (
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.inputToken.toLowerCase() == jBGNAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0
        );
      });
      let USDCBalanceAfter = await USDCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceAfter = await jBGNInstance.balanceOf.call(user);

      assert.equal(
        USDCBalanceBefore.add(USDCOut).toString(),
        USDCBalanceAfter.toString(),
      );
      assert.equal(jEURBalanceAfter.toString(), jEURBalanceBefore.toString());
      assert.equal(
        jBGNBalanceBefore.sub(tokenAmountIn).toString(),
        jBGNBalanceAfter.toString(),
      );
    });
    it('reverts with pool and peg token mismatch', async () => {
      let tokenAmountIn = await jBGNInstance.balanceOf.call(user);
      tokenAmountIn = tokenAmountIn.divn(4);
      const tokenPathSwap = [USDCAddress, WETHAddress, WBTCAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const synthereumRedeemParams = {
        synthereumFinder: synthereumFinderAddress,
        synthereumPool: jEURPool,
        redeemParams: {
          numTokens: 0,
          minCollateral: 0,
          expiration: deadline,
          recipient: user,
        },
      };

      const redeemSwapParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: fixedRateSwapInstance.address,
      };

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            RedeemPegSwapParams: {
              recipient: 'address',
              redeemSwapParams: {
                isExactInput: 'bool',
                unwrapToETH: 'bool',
                exactAmount: 'uint256',
                minOutOrMaxIn: 'uint256',
                extraParams: 'bytes',
                msgSender: 'address',
              },
              redeemParams: {
                synthereumFinder: 'address',
                synthereumPool: 'address',
                redeemParams: {
                  numTokens: 'uint256',
                  minCollateral: 'uint256',
                  expiration: 'uint256',
                  recipient: 'address',
                },
              },
            },
          },
        ],
        [
          {
            recipient: user,
            redeemSwapParams: {
              isExactInput: redeemSwapParams.isExactInput,
              unwrapToETH: redeemSwapParams.unwrapToETH,
              exactAmount: redeemSwapParams.exactAmount,
              minOutOrMaxIn: redeemSwapParams.minOutOrMaxIn,
              extraParams: redeemSwapParams.extraParams,
              msgSender: redeemSwapParams.msgSender,
            },
            redeemParams: {
              synthereumFinder: synthereumRedeemParams.synthereumFinder,
              synthereumPool: poolMock.address,
              redeemParams: {
                numTokens: synthereumRedeemParams.redeemParams.numTokens,
                minCollateral:
                  synthereumRedeemParams.redeemParams.minCollateral,
                expiration: synthereumRedeemParams.redeemParams.expiration,
                recipient: synthereumRedeemParams.redeemParams.recipient,
              },
            },
          },
        ],
      );
      // approve proxy to pull tokens
      await jBGNInstance.approve(proxyInstance.address, tokenAmountIn, {
        from: user,
      });
      await truffleAssert.reverts(
        proxyInstance.unwrapFixedRateTo(
          true,
          implementationID,
          fixedRateWrapperInstance.address,
          WBTCAddress,
          tokenAmountIn,
          encodedParams,
          { from: user },
        ),
        'Pool and jSynth mismatch',
      );
    });
    it('reverts with bad implementationID', async () => {
      await truffleAssert.reverts(
        proxyInstance.unwrapFixedRateTo(
          true,
          'badID',
          jBGNInstance.address,
          WBTCAddress,
          10,
          web3Utils.utf8ToHex('encodedParams'),
          { from: user },
        ),
        'Implementation id not registered',
      );
    });
  });
  describe('unwrapFixedRateTo - jSynth', async () => {
    it('correctly swaps Fixed Rate into any jSynth via pool exchange', async () => {
      let tokenAmountIn = await jBGNInstance.balanceOf.call(user);
      tokenAmountIn = tokenAmountIn.divn(4);

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            SynthereumExchangeParams: {
              synthereumFinder: 'address',
              inputSynthereumPool: 'address',
              exchangeParams: {
                destPool: 'address',
                numTokens: 'uint256',
                minDestNumTokens: 'uint256',
                expiration: 'uint256',
                recipient: 'address',
              },
            },
          },
        ],
        [
          {
            synthereumFinder: synthereumFinderAddress,
            inputSynthereumPool: jEURPool,
            exchangeParams: {
              destPool: jGBPPool,
              numTokens: tokenAmountIn.toString(),
              minDestNumTokens: 0,
              expiration: deadline,
              recipient: user,
            },
          },
        ],
      );

      let jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceBefore = await jBGNInstance.balanceOf.call(user);
      let jGBPBalanceBefore = await jGBPInstance.balanceOf.call(user);

      // approve proxy to pull tokens
      await jBGNInstance.approve(proxyInstance.address, tokenAmountIn, {
        from: user,
      });
      let tx = await proxyInstance.unwrapFixedRateTo(
        false,
        implementationID,
        fixedRateWrapperInstance.address,
        jGBPAddress,
        tokenAmountIn,
        encodedParams,
        { from: user },
      );
      let jGBPOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        jGBPOut = ev.outputAmount;
        return (
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.inputToken.toLowerCase() == jBGNAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == jGBPAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0
        );
      });
      let jGBPBalanceAfter = await jGBPInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);
      let jBGNBalanceAfter = await jBGNInstance.balanceOf.call(user);

      assert.equal(
        jGBPBalanceBefore.add(jGBPOut).toString(),
        jGBPBalanceAfter.toString(),
      );
      assert.equal(jEURBalanceAfter.toString(), jEURBalanceBefore.toString());
      assert.equal(
        jBGNBalanceBefore.sub(tokenAmountIn).toString(),
        jBGNBalanceAfter.toString(),
      );
    });
    it('reverts with pool and peg token mismatch', async () => {
      let tokenAmountIn = await jBGNInstance.balanceOf.call(user);
      tokenAmountIn = tokenAmountIn.divn(4);

      let encodedParams = web3.eth.abi.encodeParameters(
        [
          {
            SynthereumExchangeParams: {
              synthereumFinder: 'address',
              inputSynthereumPool: 'address',
              exchangeParams: {
                destPool: 'address',
                numTokens: 'uint256',
                minDestNumTokens: 'uint256',
                expiration: 'uint256',
                recipient: 'address',
              },
            },
          },
        ],
        [
          {
            synthereumFinder: synthereumFinderAddress,
            inputSynthereumPool: poolMock.address,
            exchangeParams: {
              destPool: jGBPAddress,
              numTokens: tokenAmountIn.toString(),
              minDestNumTokens: 0,
              expiration: deadline,
              recipient: user,
            },
          },
        ],
      );

      // approve proxy to pull tokens
      await jBGNInstance.approve(proxyInstance.address, tokenAmountIn, {
        from: user,
      });
      await truffleAssert.reverts(
        proxyInstance.unwrapFixedRateTo(
          false,
          implementationID,
          fixedRateWrapperInstance.address,
          jGBPAddress,
          tokenAmountIn,
          encodedParams,
          { from: user },
        ),
        'Pool and jSynth mismatch',
      );
    });
    it('reverts with bad implementationID', async () => {
      await truffleAssert.reverts(
        proxyInstance.unwrapFixedRateTo(
          false,
          'badID',
          jBGNInstance.address,
          jGBPAddress,
          10,
          web3Utils.utf8ToHex('encodedParams'),
          { from: user },
        ),
        'Implementation id not registered',
      );
    });
  });
});
