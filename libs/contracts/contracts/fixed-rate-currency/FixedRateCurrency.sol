// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import './FixedRateWrapper.sol';
import '../extensions/atomic-swap/interfaces/IAtomicSwap.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {ISynthereumRegistry} from '../core/registries/interfaces/IRegistry.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';

import {
  ISynthereumPoolOnChainPriceFeed
} from '../synthereum-pool/v4/interfaces/IPoolOnChainPriceFeed.sol';

contract FixedRateCurrency is FixedRateWrapper {
  bool public paused; // Prevents minting when true

  ISynthereumFinder public synthereumFinder;
  ISynthereumPoolOnChainPriceFeed public synthereumPool; // pegSynth-USDC pool
  IERC20 public collateralInstance; // synthereum pool collateral (USDC)
  IAtomicSwap public atomicSwap;

  address public admin;
  //----------------------------------------
  // Events
  //----------------------------------------
  event Mint(
    address indexed account,
    address indexed tokenCollateral,
    address indexed tokenAddress,
    uint256 numTokens
  );

  event Redeem(
    address indexed account,
    address indexed tokenBurned,
    address indexed tokenRedeemed,
    uint256 numTokensRedeemed
  );

  event SwapWithSynth(
    address indexed account,
    address indexed synth,
    address indexed tokenAddress,
    uint256 numTokens,
    string side
  );

  event SwapWithERC20(
    address indexed account,
    address indexed ERC20Address,
    address indexed synthToken,
    string side,
    uint256 numTokensIn,
    uint256 numTokensOut
  );

  event SwapWithETH(
    address indexed account,
    string side,
    uint256 numTokensIn,
    uint256 numTokensOut
  );

  event ContractPaused();
  event ContractResumed();

  event RateChange(uint256 oldRate, uint256 newRate);
  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier isActive() {
    require(!paused, 'Contract has been paused');
    _;
  }

  modifier onlyAdmin() {
    require(msg.sender == admin, 'Only contract admin can call this function');
    _;
  }

  constructor(
    IERC20 _pegToken,
    IERC20 _collateralToken,
    ISynthereumPoolOnChainPriceFeed _synthereumPoolAddress,
    ISynthereumFinder _synthereumFinder,
    IAtomicSwap _atomicSwapAddr,
    address _admin,
    uint256 _rate,
    string memory _name,
    string memory _symbol
  ) public FixedRateWrapper(_pegToken, _rate, _name, _symbol) {
    paused = false;
    synthereumFinder = _synthereumFinder;
    synthereumPool = _synthereumPoolAddress;
    collateralInstance = _collateralToken;
    admin = _admin;
    atomicSwap = _atomicSwapAddr;
    // address synthAddress;
    // address collateralAddress;
    // // check the appropriate pool is passed
    // (collateralAddress, synthAddress) = checkPoolRegistration();

    // collateralInstance = IERC20(collateralAddress);

    // require(
    //   address(_pegToken) == synthAddress,
    //   "The synth pool passed doesn't hold the peg token"
    // );
  }

  /** @notice - Mints fixed rate synths against the deposited peg synth (jEUR)
   */
  function mintFromPegSynth(uint256 _pegTokenAmount, address recipient)
    public
    isActive()
    returns (uint256 numTokensMinted)
  {
    // deposit peg tokens and mint this token according to rate
    numTokensMinted = super.wrap(_pegTokenAmount, recipient);

    emit Mint(msg.sender, address(synth), address(this), numTokensMinted);
  }

  /** @notice - Burns fixed rate synths and unlocks the deposited peg synth (jEUR)
   */
  function redeemToPegSynth(uint256 _fixedSynthAmount, address recipient)
    public
    returns (uint256 tokensRedeemed)
  {
    tokensRedeemed = super.unwrap(_fixedSynthAmount, recipient);
    emit Redeem(msg.sender, address(this), address(synth), tokensRedeemed);
  }

  /** @notice - Mints fixed rate synths from USDC.
        Mints _pegToken from USDC using the appropriate synthereum pool.
     */
  function mintFromUSDC(
    ISynthereumPoolOnChainPriceFeed.MintParams memory _mintParams
  ) public isActive() {
    // pull USDC from user's wallet
    collateralInstance.safeTransferFrom(
      msg.sender,
      address(this),
      _mintParams.collateralAmount
    );

    // approves the pool to transfer collateral from this contract wallet
    collateralInstance.safeIncreaseAllowance(
      address(synthereumPool),
      _mintParams.collateralAmount
    );

    // mint jEUR (peg token) with USDC - to user's wallet (recipient in mintParams)
    (uint256 pegTokensMinted, ) = synthereumPool.mint(_mintParams);

    // wrap the jEUR to obtain this fixed rate currency
    uint256 numTokensMinted = super.wrap(pegTokensMinted, msg.sender);

    emit Mint(msg.sender, address(synth), address(this), numTokensMinted);
  }

  /** @notice - Redeem USDC by burning peg synth (from synthereum pool)
        Unlocked by burning fixed rate synths (unwrap).
    */
  function redeemUSDC(
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory _redeemParams
  ) public {
    // burn _synthAmount to get peg tokens jEur into this wallet
    uint256 pegTokensUnlocked =
      super.unwrap(_redeemParams.numTokens, address(this));

    // approves the synthereum pool to pull peg tokens tokens from this contract
    synth.safeIncreaseAllowance(address(synthereumPool), pegTokensUnlocked);

    // redeem USDC by burning jEur in broker contract and send them to user (recipient in redeemParamss)
    _redeemParams.numTokens = pegTokensUnlocked;
    (uint256 collateralRedeemed, ) = synthereumPool.redeem(_redeemParams);

    emit Redeem(
      msg.sender,
      address(synth),
      address(collateralInstance),
      collateralRedeemed
    );
  }

  /**
    @notice Mints fixed rate currency from a synthereum synthetic asset 
   */
  function mintFromSynth(
    IERC20 inputSynthAddress,
    ISynthereumPoolOnChainPriceFeed inputSynthPool,
    ISynthereumPoolOnChainPriceFeed.ExchangeParams memory _exchangeParams
  ) public isActive {
    //TODO can we know the synth token address from exchange params?
    //TODO if not we should check the input address is correct (although if not the tx should fail)

    // pull synth to be exchanged from user wallet into this contract wallet
    inputSynthAddress.safeTransferFrom(
      msg.sender,
      address(this),
      _exchangeParams.numTokens
    );

    // allow the synthereum pool to transfer input synth
    inputSynthAddress.safeIncreaseAllowance(
      address(inputSynthPool),
      _exchangeParams.numTokens
    );

    // exchange function in broker to get jEur from synth into user's wallet (recipient in exchaangeParams)
    (uint256 pegTokenAmount, ) = inputSynthPool.exchange(_exchangeParams);

    // deposit peg tokens and mint this token according to rate
    uint256 numTokensMinted = super.wrap(pegTokenAmount, msg.sender);

    emit SwapWithSynth(
      msg.sender,
      address(inputSynthAddress),
      address(this),
      numTokensMinted,
      'buy'
    );
  }

  /**
    @notice Burns fixed rate currency and swap the peg synth with any other synthereum asset 
   */
  function swapForSynth(
    uint256 _fixedSynthAmount,
    ISynthereumPoolOnChainPriceFeed.ExchangeParams memory _exchangeParams
  ) public {
    // burn _synthAmount to get peg tokens jEur into this wallet
    uint256 pegTokensUnlocked = super.unwrap(_fixedSynthAmount, address(this));

    // allow the synthereum pool to transfer jEur
    synth.safeIncreaseAllowance(address(synthereumPool), pegTokensUnlocked);

    // exchange function in broker to get final asset
    _exchangeParams.numTokens = pegTokensUnlocked;
    (uint256 numTokensMinted, ) = synthereumPool.exchange(_exchangeParams);
    emit SwapWithSynth(
      msg.sender,
      address(_exchangeParams.destPool.syntheticToken()),
      address(this),
      numTokensMinted,
      'sell'
    );
  }

  /**
    @notice Leverages the OCLR to do ERC20 -> USDC -> jEUR -> fixedSynth 
   */
  function mintFromERC20(
    uint256 amountTokensIn,
    uint256 collateralAmountOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) public isActive {
    // deposit erc20 into this contract
    IERC20(tokenSwapPath[0]).safeTransferFrom(
      msg.sender,
      address(this),
      amountTokensIn
    );

    // allowance
    IERC20(tokenSwapPath[0]).safeIncreaseAllowance(
      address(atomicSwap),
      amountTokensIn
    );

    //erc20 -> USDC -> jEur to user wallet
    (, , uint256 synthMinted) =
      atomicSwap.swapExactTokensAndMint(
        amountTokensIn,
        collateralAmountOutMin,
        tokenSwapPath,
        synthereumPool,
        mintParams
      );

    // jEur -> jBGN
    uint256 numTokensMinted = mintFromPegSynth(synthMinted, msg.sender);

    emit SwapWithERC20(
      msg.sender,
      tokenSwapPath[0],
      address(synth),
      'buy',
      amountTokensIn,
      numTokensMinted
    );
  }

  /**
    @notice Leverages the OCLR to do ETH -> USDC -> jEUR -> fixedSynth 
   */
  function mintFromETH(
    uint256 collateralAmountOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed.MintParams memory mintParams
  ) public payable isActive {
    // ETH -> USDC -> jEUR
    (, , uint256 pegSynthMinted) =
      atomicSwap.swapExactETHAndMint{value: msg.value}(
        collateralAmountOutMin,
        tokenSwapPath,
        synthereumPool,
        mintParams
      );

    // jEUR -> jBGN
    uint256 numTokensMinted = mintFromPegSynth(pegSynthMinted, msg.sender);

    emit SwapWithETH(msg.sender, 'buy', msg.value, numTokensMinted);
  }

  /**
    @notice Leverages the OCLR to do fixedSynth -> jEur (peg) -> USDC -> ERC20 
   */
  function swapToERC20(
    uint256 fixedSynthAmountIn,
    uint256 amountTokenOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams
  ) public {
    // jBGN -> jEUR into this waallet
    uint256 pegSynthRedeemed =
      redeemToPegSynth(fixedSynthAmountIn, address(this));

    // allow AtomicSwap to pull jEUR
    synth.safeIncreaseAllowance(address(atomicSwap), pegSynthRedeemed);

    // jEUr -> USDC -> ERC20 through AtomicSwap contract
    redeemParams.numTokens = pegSynthRedeemed;
    (, , uint256 outputAmount) =
      atomicSwap.redeemAndSwapExactTokens(
        amountTokenOutMin,
        tokenSwapPath,
        synthereumPool,
        redeemParams,
        msg.sender
      );

    emit SwapWithERC20(
      msg.sender,
      address(tokenSwapPath[1]),
      address(synth),
      'sell',
      fixedSynthAmountIn,
      outputAmount
    );
  }

  /**
    @notice Leverages the OCLR to do fixedSynth -> jEur (peg) -> USDC -> ETH 
   */
  function swapToETH(
    uint256 fixedSynthAmountIn,
    uint256 amountTokenOutMin,
    address[] calldata tokenSwapPath,
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory redeemParams
  ) public {
    // jBGN -> jEUR into this wallet
    uint256 pegSynthRedeemed =
      redeemToPegSynth(fixedSynthAmountIn, address(this));

    // allow AtomicSwap to pull jEUR
    synth.safeIncreaseAllowance(address(atomicSwap), pegSynthRedeemed);

    // jEUr -> USDC -> ERC20 through AtomicSwap contract
    redeemParams.numTokens = pegSynthRedeemed;
    (, , uint256 outputAmount) =
      atomicSwap.redeemAndSwapExactTokensForETH(
        amountTokenOutMin,
        tokenSwapPath,
        synthereumPool,
        redeemParams,
        msg.sender
      );

    emit SwapWithETH(msg.sender, 'sell', fixedSynthAmountIn, outputAmount);
  }

  // only synthereum manager can pause new mintings
  // code an admin
  function pauseContract() public onlyAdmin {
    paused = true;
    emit ContractPaused();
  }

  function resumeContract() public onlyAdmin {
    paused = false;
    emit ContractResumed();
  }

  function changeRate(uint256 newRate) public onlyAdmin {
    emit RateChange(rate, newRate);
    rate = newRate;
  }

  function getRate() public view returns (uint256) {
    return rate;
  }

  // function checkPoolRegistration()
  //     internal
  //     view
  //     returns (address collateralAddress, address synthAddress)
  // {
  //     ISynthereumRegistry poolRegistry =
  //         ISynthereumRegistry(
  //             synthereumFinder.getImplementationAddress(
  //                 SynthereumInterfaces.PoolRegistry
  //             )
  //         );

  //     string memory synthTokenSymbol = synthereumPool.syntheticTokenSymbol();
  //     collateralInstance = IERC20(synthereumPool.collateralToken());
  //     uint8 version = synthereumPool.version();
  //     require(
  //     poolRegistry.isDeployed(
  //         synthTokenSymbol,
  //         collateralInstance,
  //         version,
  //         address(synthereumPool)
  //     ),
  //     'Pool not registred'
  //     );

  //     collateralAddress = address(collateralInstance);
  //     synthAddress = address(synthereumPool.syntheticToken());
  // }
}
