const { artifacts, contract, Web3, web3, assert } = require('hardhat');
const Web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const AtomicSwap = artifacts.require('AtomicSwap');
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02');
const FixedRateCurrency = artifacts.require('FixedRateCurrency');
const TestnetERC20 = artifacts.require('TestnetERC20');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumPoolOnChainPriceFeed = artifacts.require(
  'SynthereumPoolOnChainPriceFeed',
);
const tokens = require('../../data/test/tokens.json');
const uniswap = require('../../data/test/uniswap.json');
const synthereum = require('../../data/test/synthereum.json');

// kovan testing
contract('Fixed Rate Currency', accounts => {
  describe('OCLR Integration', async () => {
    let WBTCInstance, USDCInstance, jEURInstance, uniswapInstance;
    let WBTCAddress, USDCAddress, jEURAddress, WETHAddress;
    let AtomicSwapAddr,
      AtomicSwapInstance,
      synthereumFinderAddress = '0xBeFaa064Ad33668C97D4C8C4d0237682B7D04E34'; // from networks/42.json
    let pool, derivative, poolInstance;
    let EthAmountInput, expiration;
    let user, admin;
    let pegRate = '1.95';
    let poolStartingDeposit = Web3Utils.toWei('1000', 'mwei');
    let bnPegRate = Web3Utils.toWei(pegRate);
    let name = 'Jarvis Bulgarian Lev';
    let symbol = 'jBGN';
    let feePercentage = '0.002';
    let feePercentageWei = Web3Utils.toWei(feePercentage);

    const initializeTokenInstanace = async tokenAddress =>
      await TestnetERC20.at(tokenAddress);

    const initializeTokens = async networkId => {
      USDCAddress = tokens[networkId].USDC;
      WBTCAddress = tokens[networkId].WBTC;
      jEURAddress = tokens[networkId].JEUR;

      WBTCInstance = await initializeTokenInstanace(WBTCAddress);
      USDCInstance = await initializeTokenInstanace(USDCAddress);
      jEURInstance = await initializeTokenInstanace(jEURAddress);
    };

    const initializeUniswap = async networkId =>
      await IUniswapV2Router02.at(uniswap[networkId].router);

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
        expiration,
        { value: ethAmount, from: user },
      );

      // console.log("WBTC balance after: " + await WBTCInstance.balanceOf.call(user))
    };

    const getUSDC = async ethAmount => {
      await uniswapInstance.swapExactETHForTokens(
        0,
        [WETHAddress, USDCAddress],
        user,
        expiration,
        { value: ethAmount, from: user },
      );

      // console.log("USDC balance after: " + await USDCInstance.balanceOf.call(user))
    };

    before(async () => {
      admin = accounts[0];
      user = accounts[1];
      EthAmountInput = Web3Utils.toWei('1');

      const networkId = await web3.eth.net.getId();
      expiration = (await web3.eth.getBlock('latest')).timestamp + 60;

      // will fail if there's no code at the address
      await SynthereumFinder.at(synthereumFinderAddress);

      // init uniswap
      uniswapInstance = await initializeUniswap(networkId);
      WETHAddress = await uniswapInstance.WETH();

      // initialise tokens
      await initializeTokens(networkId);

      // initialise synthereum
      await initializeSynthereum(networkId);

      // deploy atomic swap
      AtomicSwapInstance = await AtomicSwap.new(
        synthereumFinderAddress,
        uniswapInstance.address,
      );

      fixedRateCurrencyInstance = await FixedRateCurrency.new(
        jEURAddress,
        USDCAddress,
        pool,
        synthereumFinderAddress,
        AtomicSwapInstance.address,
        admin,
        bnPegRate,
        name,
        symbol,
      );

      console.log('Deployed at', fixedRateCurrencyInstance.address);
    });

    // ERC20 -> USDC -> jEUR -> jBGN
    describe('From/to ERC20', () => {
      it('mintFromERC20', async () => {
        let MintParams = {
          derivative: derivative,
          minNumTokens: 0,
          collateralAmount: 0,
          feePercentage: feePercentageWei,
          expiration: expiration,
          recipient: user,
        };

        // get tokens
        await getWBTC(EthAmountInput);
        await getUSDC(EthAmountInput);
        //approve
        const WBTCBalanceBefore = await WBTCInstance.balanceOf.call(user);
        const WBTCIn = WBTCBalanceBefore.div(Web3Utils.toBN(1000));
        const jEURBalanceBefore = await jEURInstance.balanceOf.call(user);

        await WBTCInstance.approve(fixedRateCurrencyInstance.address, WBTCIn, {
          from: user,
        });
        await jEURInstance.approve(
          fixedRateCurrencyInstance.address,
          Web3Utils.toWei('99999999999'),
          { from: user },
        );

        const tokenSwapPath = [WBTCAddress, USDCAddress];
        const fixedRateBalanceBefore = await fixedRateCurrencyInstance.balanceOf.call(
          user,
        );

        const tx = await fixedRateCurrencyInstance.mintFromERC20(
          WBTCIn,
          0,
          tokenSwapPath,
          MintParams,
          {
            from: user,
          },
        );

        const fixedRateBalanceAfter = await fixedRateCurrencyInstance.balanceOf.call(
          user,
        );
        const WBTCBalanceAfter = await WBTCInstance.balanceOf.call(user);
        const jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

        let fixedTokenOut;
        truffleAssert.eventEmitted(tx, 'SwapWithERC20', ev => {
          fixedTokenOut = ev.numTokensOut;
          return (
            ev.account == user &&
            ev.ERC20Address == WBTCAddress &&
            ev.synthToken == jEURAddress &&
            ev.side == 'buy' &&
            ev.numTokensIn == WBTCIn.toString() &&
            ev.numTokensOut > 0
          );
        });

        assert.equal(WBTCBalanceAfter.eq(WBTCBalanceBefore.sub(WBTCIn)), true);
        assert.equal(
          fixedRateBalanceAfter.eq(fixedRateBalanceBefore.add(fixedTokenOut)),
          true,
        );
        assert.equal(jEURBalanceAfter.eq(jEURBalanceBefore), true);
      });

      it('swapToERC20', async () => {
        let MintParams = {
          derivative: derivative,
          minNumTokens: 0,
          collateralAmount: 0,
          feePercentage: feePercentageWei,
          expiration: expiration,
          recipient: user,
        };

        await getWBTC(EthAmountInput);

        // mint JEUR with atomic swap
        let WBTCBalanceBefore = await WBTCInstance.balanceOf.call(user);
        const WBTCIn = WBTCBalanceBefore.div(Web3Utils.toBN(1000));
        let tokenSwapPath = [WBTCAddress, USDCAddress];

        await WBTCInstance.approve(AtomicSwapInstance.address, WBTCIn, {
          from: user,
        });
        await AtomicSwapInstance.swapAndMint(
          WBTCIn,
          0,
          tokenSwapPath,
          pool,
          MintParams,
          { from: user },
        );

        // mint fixed rate using all minted jEUR
        const jEURBalanceBefore = await jEURInstance.balanceOf.call(user);
        await jEURInstance.approve(
          fixedRateCurrencyInstance.address,
          jEURBalanceBefore,
          { from: user },
        );
        await fixedRateCurrencyInstance.mintFromPegSynth(jEURBalanceBefore, {
          from: user,
        });

        WBTCBalanceBefore = await WBTCInstance.balanceOf.call(user);
        const fixedRateBalanceBefore = await fixedRateCurrencyInstance.balanceOf.call(
          user,
        );

        // swap all of them for ERC20 (WBTC)
        let RedeemParams = {
          derivative: derivative,
          numTokens: 0,
          minCollateral: 0,
          feePercentage: feePercentageWei,
          expiration: expiration,
          recipient: user,
        };

        // call swapToErc20
        tokenSwapPath = [USDCAddress, WBTCAddress];
        await jEURInstance.approve(
          fixedRateCurrencyInstance.address,
          fixedRateBalanceBefore,
          { from: user },
        );

        const tx = await fixedRateCurrencyInstance.swapToERC20(
          fixedRateBalanceBefore,
          0,
          tokenSwapPath,
          RedeemParams,
          { from: user },
        );

        const fixedRateBalanceAfter = await fixedRateCurrencyInstance.balanceOf.call(
          user,
        );
        const WBTCBalanceAfter = await WBTCInstance.balanceOf.call(user);
        const jEURBalanceAfter = await jEURInstance.balanceOf.call(user);

        let WBTCOut;
        truffleAssert.eventEmitted(tx, 'SwapWithERC20', ev => {
          WBTCOut = ev.numTokensOut;
          return (
            ev.account == user &&
            ev.ERC20Address == WBTCAddress &&
            ev.synthToken == jEURAddress &&
            ev.side == 'sell' &&
            ev.numTokensIn == fixedRateBalanceBefore.toString() &&
            ev.numTokensOut > 0
          );
        });

        assert.equal(WBTCBalanceAfter.eq(WBTCBalanceBefore.add(WBTCOut)), true);
        assert.equal(fixedRateBalanceAfter.eq(Web3Utils.toBN(0)), true);
        assert.equal(jEURBalanceAfter.eq(Web3Utils.toBN(0)), true);
      });
    });

    // ETH -> USDC -> jEUR -> jBGN
    describe('From/to ETH', () => {});
  });
});
