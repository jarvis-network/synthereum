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
  let WBTCInstance, USDCInstance, jEURInstance, WETHInstance, uniswapInstance;
  let WBTCAddress,
    USDCAddress,
    USDTAddress,
    jEURAddress,
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
    pool = synthereum[networkId].poolV5;
    poolInstance = await SynthereumLiquidityPool.at(pool);
    let jGBPToken = await SyntheticToken.new(
      'Jarvis British Pound',
      'jGBP',
      18,
      { from: accounts[0] },
    );
    poolMock = await PoolMock.new(5, USDCAddress, 'jGBP', jGBPToken.address);
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
    await getUSDC(web3Utils.toWei('1', 'ether'));
    let balance = await USDCInstance.balanceOf.call(user);
    await USDCInstance.transfer(pool, balance.toString(), { from: user });

    // get deployed Proxy
    proxyInstance = await Proxy.deployed();
    atomicSwapAddr = await proxyInstance.getImplementationAddress.call(
      implementationID,
    );

    // deploy FixedRate with jEUr as collateral
    jBGNInstance = await SyntheticToken.new(
      'Jarvis Bulgarian Lev',
      'jBGN',
      18,
      { from: accounts[0] },
    );

    let constructorParams = {
      finder: synthereumFinderAddress,
      version: 1,
      pegCollateralToken: jEURAddress,
      fixedRateToken: jBGNInstance.address,
      roles: { admin: accounts[0], maintainer: accounts[1] },
      rate: web3Utils.toWei('1.32'),
    };
    fixedRateWrapperInstance = await FixedRateWrapper.new(constructorParams, {
      from: accounts[0],
    });
    fixedRateSwapInstance = await FixedRateSwap.deployed();
    await jBGNInstance.addMinter(fixedRateWrapperInstance.address, {
      from: admin,
    });
    await jBGNInstance.addBurner(fixedRateWrapperInstance.address, {
      from: admin,
    });
  });

  it('Fixed Rate deployment', async () => {
    assert.equal(
      jEURAddress.toLowerCase(),
      (await fixedRateWrapperInstance.collateralToken.call()).toLowerCase(),
    );
  });

  describe('wrapFixedRateFrom - ERC20', async () => {
    it('correctly swaps ERC20 into fixed rate', async () => {
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
        synthereumPool: pool,
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
          ev.outputToken.toLowerCase() == jBGNInstance.address.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress.toLowerCase() ==
            atomicSwapAddr.toLowerCase()
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
          fixedRateWrapperInstance.address,
          web3Utils.utf8ToHex('encodedParams'),
          user,
          { from: user },
        ),
        'Implementation id not registered',
      );
    });
  });

  describe('unwrapFixedRateTo - ERC20', async () => {
    it('correctly swaps Fixed Rate into ERC20', async () => {
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
        synthereumPool: pool,
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
        tokenAmountIn,
        encodedParams,
        { from: user },
      );
      let WBTCOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        WBTCOut = ev.outputAmount;
        return (
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.inputToken.toLowerCase() == jBGNInstance.address.toLowerCase() &&
          ev.outputToken.toLowerCase() == WBTCAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress.toLowerCase() ==
            atomicSwapAddr.toLowerCase()
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
    it('correctly swaps Fixed Rate into ERC20', async () => {
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
        synthereumPool: pool,
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
        tokenAmountIn,
        encodedParams,
        { from: user },
      );
      let WBTCOut;
      truffleAssert.eventEmitted(tx, 'Swap', ev => {
        WBTCOut = ev.outputAmount;
        return (
          ev.inputAmount.toString() == tokenAmountIn.toString() &&
          ev.inputToken.toLowerCase() == jBGNInstance.address.toLowerCase() &&
          ev.outputToken.toLowerCase() == WBTCAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.dexImplementationAddress.toLowerCase() ==
            atomicSwapAddr.toLowerCase()
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
    it('reverts with bad implementationID', async () => {
      await truffleAssert.reverts(
        proxyInstance.unwrapFixedRateTo(
          true,
          'badID',
          jBGNInstance.address,
          10,
          web3Utils.utf8ToHex('encodedParams'),
          { from: user },
        ),
        'Implementation id not registered',
      );
    });
  });
});
