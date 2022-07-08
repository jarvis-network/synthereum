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
const UniV2AtomicSwap = artifacts.require('OCLRV2UniswapV2');
const IUniswapRouter = artifacts.require(
  '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02',
);
const PoolMock = artifacts.require('PoolMock');
const Forwarder = artifacts.require('SynthereumTrustedForwarder');

const TestnetERC20 = artifacts.require(
  '@jarvis-network/synthereum-contracts/contracts/test/TestnetERC20.sol:TestnetERC20',
);
const SynthereumLiquidityPool = artifacts.require('SynthereumLiquidityPool');

const tokens = require('../../data/test/tokens.json');
const uniswap = require('../../data/test/uniswap.json');
const synthereum = require('../../data/test/synthereum.json');
const { signMetaTxRequest } = require('../signer');

contract('UniswapV2', async accounts => {
  let WBTCInstance, USDCInstance, jEURInstance, WETHInstance, uniswapInstance;
  let WBTCAddress, USDCAddress, USDTAddress, jEURAddress, WETHAddress;
  let networkId, UniV2Info, encodedInfo;

  let AtomicSwapInstance, ProxyInstance, forwarderInstance;

  let deadline = ((Date.now() / 1000) | 0) + 7200;
  let amountETH = web3Utils.toWei('1');

  const swapMintSig =
    'swapAndMint(string,(bool,uint256,uint256,bytes,address),address,(uint256,uint256,uint256,address))';
  const redeemSwapSig =
    'redeemAndSwap(string,(bool,bool,uint256,uint256,bytes,address),address,(uint256,uint256,uint256,address),address)';
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
    pool = synthereum[networkId].poolV5;
    poolInstance = await SynthereumLiquidityPool.at(pool);
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

  const getUSDC = async ethAmount => {
    await uniswapInstance.swapExactETHForTokens(
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

    // fund the pool
    await getUSDC(web3Utils.toWei('1', 'ether'));
    let balance = await USDCInstance.balanceOf.call(user);
    await USDCInstance.transfer(pool, balance.toString(), { from: user });

    // get deployed Proxy
    ProxyInstance = await Proxy.deployed();

    // get deployed Forwarder
    forwarderInstance = await Forwarder.at(synthereum[networkId].forwarder);

    // get deployed univ2 atomic swap
    AtomicSwapInstance = await UniV2AtomicSwap.deployed();
  });

  describe('Meta-Tx', async () => {
    let signers, metaUserAddr, userSigner;
    before(async () => {
      signers = await ethers.getSigners();
      userSigner = signers[1].provider;
      metaUserAddr = signers[1].address;
    });

    it('Succesfully mint from ERC20 via meta tx', async () => {
      const tokenAmountIn = web3Utils.toWei('10', 'wei');
      const tokenPathSwap = [WBTCAddress, WETHAddress, USDCAddress];

      await getWBTC(amountETH);

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
        msgSender: metaUserAddr,
      };

      let WBTCbalanceBefore = await WBTCInstance.balanceOf.call(metaUserAddr);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(metaUserAddr);

      // approve proxy to pull tokens
      await WBTCInstance.approve(ProxyInstance.address, tokenAmountIn, {
        from: metaUserAddr,
      });

      const functionSig = web3.utils.sha3(swapMintSig).substr(0, 10);
      const functionParam = web3.eth.abi.encodeParameters(
        [
          'string',
          {
            SwapMintParams: {
              isExactInput: 'bool',
              exactAmount: 'uint256',
              minOutOrMaxIn: 'uint256',
              extraParams: 'bytes',
              msgSender: 'address',
            },
          },
          'address',
          {
            'ISynthereumLiquidityPool.MintParams': {
              minNumTokens: 'uint256',
              collateralAmount: 'uint256',
              expiration: 'uint256',
              recipient: 'address',
            },
          },
        ],
        [
          implementationID,
          {
            isExactInput: inputParams.isExactInput,
            exactAmount: inputParams.exactAmount,
            minOutOrMaxIn: inputParams.minOutOrMaxIn,
            extraParams: inputParams.extraParams,
            msgSender: inputParams.msgSender,
          },
          pool,
          {
            minNumTokens: mintParams.minNumTokens,
            collateralAmount: mintParams.collateralAmount,
            expiration: mintParams.expiration,
            recipient: mintParams.recipient,
          },
        ],
      );
      let encodedCall = functionSig + functionParam.substr(2);

      const { request, signature } = await signMetaTxRequest(
        userSigner,
        forwarderInstance,
        {
          from: metaUserAddr,
          to: ProxyInstance.address,
          data: encodedCall,
          value: 0,
        },
        networkId,
      );

      //send metatx
      await forwarderInstance.safeExecute(request, signature);

      let WBTCbalanceAfter = await WBTCInstance.balanceOf.call(metaUserAddr);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(metaUserAddr);

      assert.equal(
        WBTCbalanceAfter.eq(
          WBTCbalanceBefore.sub(web3Utils.toBN(tokenAmountIn)),
        ),
        true,
      );
      assert.equal(jEURBalanceAfter.gt(jEURBalanceBefore), true);

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

    it('Succesfully redeem to ERC20 via meta tx', async () => {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(metaUserAddr);
      let WETHBalanceBefore = await WETHInstance.balanceOf.call(metaUserAddr);

      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const tokenPathSwap = [USDCAddress, WETHAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: metaUserAddr,
      });

      const redeemParams = {
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        expiration: deadline,
        recipient: metaUserAddr,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: false,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: metaUserAddr,
      };

      const functionSig = web3.eth.abi.encodeFunctionSignature(redeemSwapSig);
      const functionParam = web3.eth.abi.encodeParameters(
        [
          'string',
          {
            RedeemSwapParams: {
              isExactInput: 'bool',
              unwrapToETH: 'bool',
              exactAmount: 'uint256',
              minOutOrMaxIn: 'uint256',
              extraParams: 'bytes',
              msgSender: 'address',
            },
          },
          'address',
          {
            'ISynthereumLiquidityPool.RedeemParams': {
              numTokens: 'uint256',
              minCollateral: 'uint256',
              expiration: 'uint256',
              recipient: 'address',
            },
          },
          'address',
        ],
        [
          implementationID,
          {
            isExactInput: inputParams.isExactInput,
            unwrapToETH: inputParams.unwrapToETH,
            exactAmount: inputParams.exactAmount,
            minOutOrMaxIn: inputParams.minOutOrMaxIn,
            extraParams: inputParams.extraParams,
            msgSender: inputParams.msgSender,
          },
          pool,
          {
            numTokens: redeemParams.numTokens,
            minCollateral: redeemParams.minCollateral,
            expiration: redeemParams.expiration,
            recipient: redeemParams.recipient,
          },
          metaUserAddr,
        ],
      );

      let encodedCall = functionSig + functionParam.substr(2);
      const { request, signature } = await signMetaTxRequest(
        userSigner,
        forwarderInstance,
        {
          from: metaUserAddr,
          to: ProxyInstance.address,
          data: encodedCall,
        },
        networkId,
      );

      //send metatx
      await forwarderInstance.safeExecute(request, signature);

      let WETHBalanceAfter = await WETHInstance.balanceOf.call(metaUserAddr);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(metaUserAddr);

      assert.equal(WETHBalanceAfter.gt(WETHBalanceBefore), true);
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

    it('Succesfully mint from ETH via meta tx', async () => {
      const tokenAmountIn = web3Utils.toWei('1', 'ether');
      const tokenPathSwap = [WETHAddress, USDCAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const mintParams = {
        minNumTokens: 0,
        collateralAmount: 0,
        expiration: deadline,
        recipient: metaUserAddr,
      };

      const inputParams = {
        isExactInput: true,
        exactAmount: tokenAmountIn,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: metaUserAddr,
      };

      const functionSig = web3.utils.sha3(swapMintSig).substr(0, 10);
      const functionParam = web3.eth.abi.encodeParameters(
        [
          'string',
          {
            SwapMintParams: {
              isExactInput: 'bool',
              exactAmount: 'uint256',
              minOutOrMaxIn: 'uint256',
              extraParams: 'bytes',
              msgSender: 'address',
            },
          },
          'address',
          {
            'ISynthereumLiquidityPool.MintParams': {
              minNumTokens: 'uint256',
              collateralAmount: 'uint256',
              expiration: 'uint256',
              recipient: 'address',
            },
          },
        ],
        [
          implementationID,
          {
            isExactInput: inputParams.isExactInput,
            exactAmount: inputParams.exactAmount,
            minOutOrMaxIn: inputParams.minOutOrMaxIn,
            extraParams: inputParams.extraParams,
            msgSender: inputParams.msgSender,
          },
          pool,
          {
            minNumTokens: mintParams.minNumTokens,
            collateralAmount: mintParams.collateralAmount,
            expiration: mintParams.expiration,
            recipient: mintParams.recipient,
          },
        ],
      );

      let encodedCall = functionSig + functionParam.substr(2);

      const { request, signature } = await signMetaTxRequest(
        userSigner,
        forwarderInstance,
        {
          from: metaUserAddr,
          to: ProxyInstance.address,
          value: tokenAmountIn,
          data: encodedCall,
        },
        networkId,
      );

      let EthBalanceBefore = await web3.eth.getBalance(metaUserAddr);
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(metaUserAddr);

      //send metatx
      let tx = await forwarderInstance.safeExecute(request, signature, {
        value: tokenAmountIn,
        from: metaUserAddr,
      });
      let txFee = await getTxFee(tx);

      let EthBalanceAfter = await web3.eth.getBalance(metaUserAddr);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(metaUserAddr);

      const expectedEthBalance = web3Utils
        .toBN(EthBalanceBefore)
        .sub(txFee)
        .sub(web3Utils.toBN(tokenAmountIn));
      assert.equal(expectedEthBalance.toString(), EthBalanceAfter.toString());
      assert.equal(jEURBalanceAfter.gt(jEURBalanceBefore), true);

      // check allowance is set to 0 after the tx
      assert.equal(
        (await USDCInstance.allowance(ProxyInstance.address, pool)).toString(),
        '0',
      );
    });

    it('Succesfully redeem to ETH via meta tx', async () => {
      let jEURBalanceBefore = await jEURInstance.balanceOf.call(metaUserAddr);
      let jEURInput = jEURBalanceBefore.div(web3Utils.toBN(2));

      const tokenPathSwap = [USDCAddress, WETHAddress];

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );
      await jEURInstance.approve(ProxyInstance.address, jEURInput.toString(), {
        from: metaUserAddr,
      });

      const redeemParams = {
        numTokens: jEURInput.toString(),
        minCollateral: 0,
        expiration: deadline,
        recipient: metaUserAddr,
      };

      const inputParams = {
        isExactInput: true,
        unwrapToETH: true,
        exactAmount: 0,
        minOutOrMaxIn: 0,
        extraParams,
        msgSender: metaUserAddr,
      };

      // tx through proxy
      let EthBalanceBefore = web3Utils.toBN(
        await web3.eth.getBalance(metaUserAddr),
      );

      const functionSig = web3.eth.abi.encodeFunctionSignature(redeemSwapSig);
      const functionParam = web3.eth.abi.encodeParameters(
        [
          'string',
          {
            RedeemSwapParams: {
              isExactInput: 'bool',
              unwrapToETH: 'bool',
              exactAmount: 'uint256',
              minOutOrMaxIn: 'uint256',
              extraParams: 'bytes',
              msgSender: 'address',
            },
          },
          'address',
          {
            'ISynthereumLiquidityPool.RedeemParams': {
              numTokens: 'uint256',
              minCollateral: 'uint256',
              expiration: 'uint256',
              recipient: 'address',
            },
          },
          'address',
        ],
        [
          implementationID,
          {
            isExactInput: inputParams.isExactInput,
            unwrapToETH: inputParams.unwrapToETH,
            exactAmount: inputParams.exactAmount,
            minOutOrMaxIn: inputParams.minOutOrMaxIn,
            extraParams: inputParams.extraParams,
            msgSender: inputParams.msgSender,
          },
          pool,
          {
            numTokens: redeemParams.numTokens,
            minCollateral: redeemParams.minCollateral,
            expiration: redeemParams.expiration,
            recipient: redeemParams.recipient,
          },
          metaUserAddr,
        ],
      );

      let encodedCall = functionSig + functionParam.substr(2);
      const { request, signature } = await signMetaTxRequest(
        userSigner,
        forwarderInstance,
        {
          from: metaUserAddr,
          to: ProxyInstance.address,
          data: encodedCall,
        },
        networkId,
      );

      //send metatx
      await forwarderInstance.safeExecute(request, signature);

      let EthBalanceAfter = web3Utils.toBN(
        await web3.eth.getBalance(metaUserAddr),
      );
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(metaUserAddr);

      assert.equal(EthBalanceAfter.gt(EthBalanceBefore), true);
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

  describe('From/to ERC20', () => {
    it('mint jSynth from ERC20 - exact input - multihop', async () => {
      const tokenAmountIn = web3Utils.toWei('10', 'wei');
      const tokenPathSwap = [WBTCAddress, WETHAddress, USDCAddress];

      await getWBTC(amountETH);

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
      truffleAssert.eventEmitted(tx, 'SwapAndMint', ev => {
        jSynthOut = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          ev.inputAmount.toString() == tokenAmountIn &&
          ev.inputToken.toLowerCase() == WBTCAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.recipient == user
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
      const exactTokensOut = 1;
      const tokenPathSwap = [WBTCAddress, WETHAddress, USDCAddress];

      await getWBTC(amountETH);

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
      );

      const mintParams = {
        minNumTokens: 0,
        collateralAmount: exactTokensOut,
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
        msgSender: user,
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
      let inputAmount;
      truffleAssert.eventEmitted(tx, 'SwapAndMint', ev => {
        jSynthOut = ev.outputAmount;
        inputAmount = ev.inputAmount;
        return (
          ev.outputAmount > 0 &&
          web3Utils
            .toBN(maxTokenAmountIn)
            .sub(ev.inputAmount)
            .gte(web3Utils.toBN(0)) &&
          ev.inputToken.toLowerCase() == WBTCAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.recipient == user
        );
      });
      let WBTCbalanceAfter = await WBTCInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(
        WBTCbalanceAfter.eq(WBTCbalanceBefore.sub(inputAmount)),
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
      let WETHBalanceBefore = await WETHInstance.balanceOf.call(user);

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

      let WETHOut;
      truffleAssert.eventEmitted(tx, 'RedeemAndSwap', ev => {
        WETHOut = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == WETHAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.recipient == user
        );
      });

      let WETHBalanceAfter = await WETHInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

      assert.equal(WETHBalanceAfter.eq(WETHBalanceBefore.add(WETHOut)), true);
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
      let WETHBalanceBefore = await WETHInstance.balanceOf.call(user);
      let USDCBalanceBefore = await USDCInstance.balanceOf.call(user);

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
      truffleAssert.eventEmitted(tx, 'RedeemAndSwap', ev => {
        collateralRefunded = ev.collateralAmountRefunded;
        return (
          ev.outputAmount.toString() == expectedOutput.toString() &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken.toLowerCase() == jEURAddress.toLowerCase() &&
          ev.outputToken.toLowerCase() == WETHAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.gt(web3Utils.toBN(0)) == true &&
          ev.recipient == user
        );
      });

      let WETHBalanceAfter = await WETHInstance.balanceOf.call(user);
      let jEURBalanceAfter = await jEURInstance.balanceOf.call(user);
      let USDCBalanceAfter = await USDCInstance.balanceOf.call(user);

      assert.equal(
        WETHBalanceAfter.eq(WETHBalanceBefore.add(expectedOutput)),
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

      //encode in extra params
      let extraParams = web3.eth.abi.encodeParameters(
        ['address[]'],
        [tokenPathSwap],
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
      const tokenAmountIn = 10000;
      const tokenPathSwap = [WBTCAddress, USDTAddress];

      await getWBTC(amountETH);

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

  describe('From/To ETH', () => {
    it('mint jSynth from ETH - exact input', async () => {
      const tokenAmountIn = web3Utils.toWei('1', 'ether');
      const tokenPathSwap = [WETHAddress, USDCAddress];

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
      truffleAssert.eventEmitted(tx, 'SwapAndMint', ev => {
        jSynthOut = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          ev.inputAmount.toString() == tokenAmountIn &&
          ev.inputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.outputToken.toLowerCase() == jEURAddress &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.recipient == user
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
      truffleAssert.eventEmitted(tx, 'SwapAndMint', ev => {
        jSynthOut = ev.outputAmount;
        ethInput = ev.inputAmount;
        return (
          ev.outputAmount > 0 &&
          web3Utils
            .toBN(maxTokenAmountIn)
            .sub(ev.inputAmount)
            .gte(web3Utils.toBN(0)) &&
          ev.inputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.outputToken.toLowerCase().toLowerCase() ==
            jEURAddress.toLowerCase() &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.recipient == user
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
      truffleAssert.eventEmitted(tx, 'RedeemAndSwap', ev => {
        EthOutput = ev.outputAmount;
        return (
          ev.outputAmount > 0 &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken.toLowerCase() == jEURAddress &&
          ev.outputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.toString() == 0 &&
          ev.recipient == user
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
      let USDCBalanceBefore = await USDCInstance.balanceOf.call(user);

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
      truffleAssert.eventEmitted(tx, 'RedeemAndSwap', ev => {
        collateralRefunded = ev.collateralAmountRefunded;
        return (
          ev.outputAmount.toString() == expectedOutput.toString() &&
          ev.inputAmount.toString() == jEURInput.toString() &&
          ev.inputToken.toLowerCase().toLowerCase() ==
            jEURAddress.toLowerCase() &&
          ev.outputToken == '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF' &&
          ev.collateralToken.toLowerCase() == USDCAddress.toLowerCase() &&
          ev.collateralAmountRefunded.gt(web3Utils.toBN(0)) == true &&
          ev.recipient == user
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
    it('Rejects if user cant receive eth refund', async () => {
      const mockContractUser = await MockContractUser.new();
      await mockContractUser.getEth({
        value: web3Utils.toWei('1', 'ether'),
        from: user,
      });

      const tokenPathSwap = [WETHAddress, USDCAddress];
      const maxTokenAmountIn = web3Utils.toWei('0.8', 'ether');

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
