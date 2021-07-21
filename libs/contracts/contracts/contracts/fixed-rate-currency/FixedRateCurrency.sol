// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import './FixedRateWrapper.sol';
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
    address indexed pool,
    address indexed tokenRedeemed,
    uint256 numTokensRedeemed
  );

  event ContractPaused();
  //----------------------------------------
  // Modifiers
  //----------------------------------------

  modifier isActive() {
    require(!paused, 'Contract has been paused');
    _;
  }

  constructor(
    IERC20 _pegToken,
    ISynthereumPoolOnChainPriceFeed _synthereumPoolAddress,
    ISynthereumFinder _synthereumFinder,
    uint256 _rate,
    string memory _name,
    string memory _symbol
  ) public FixedRateWrapper(_pegToken, _rate, _name, _symbol) {
    paused = false;
    synthereumFinder = _synthereumFinder;
    synthereumPool = _synthereumPoolAddress;

    // address synthInstance;

    // // check the appropriate pool is passed
    // (, synthInstance) = checkPoolRegistration();

    // require(address(_pegToken) == synthInstance, "The synth pool passed doesn't hold the peg token");
  }

  /** @notice - Mints fixed rate synths against the deposited peg synth (jEUR)
   */
  function mintFromPegSynth(uint256 _pegTokenAmount) public isActive() {
    // approves this contract to pull peg tokens from user wallet
    synth.safeApprove(address(this), _pegTokenAmount);

    // deposit peg tokens and mint this token according to rate
    uint256 numTokensMinted = super.wrap(_pegTokenAmount);

    emit Mint(msg.sender, address(synth), address(this), numTokensMinted);
  }

  /** @notice - Burns fixed rate synths and unlocks the deposited peg synth (jEUR)
   */
  function redeemToPegSynth(uint256 _fixedSynthAmount) public {
    uint256 tokenRedeemed = super.unwrap(_fixedSynthAmount);
    emit Redeem(
      msg.sender,
      address(synthereumPool),
      address(synth),
      tokenRedeemed
    );
  }

  /** @notice - Mints fixed rate synths from USDC.
        Mints _pegToken from USDC using the appropriate synthereum pool.
     */
  function mintFromUSDC(
    ISynthereumPoolOnChainPriceFeed.MintParams memory _mintParams
  ) public isActive() {
    // approves the pool to transfer collateral from user wallet
    collateralInstance.safeApprove(
      address(synthereumPool),
      _mintParams.collateralAmount
    );

    // mint jEUR (peg token) with USDC - to user's wallet
    (uint256 pegTokensMinted, ) = synthereumPool.mint(_mintParams);

    // approves this contract to pull peg tokens from user wallet
    synth.safeApprove(address(this), pegTokensMinted);

    // wrap the jEUR to obtain this fixed rate currency
    uint256 numTokensMinted = super.wrap(pegTokensMinted);

    emit Mint(
      msg.sender,
      address(_mintParams.collateralAmount),
      address(this),
      numTokensMinted
    );
  }

  /** @notice - Redeem USDC by burning peg synth (from synthereum pool)
        Unlocked by burning fixed rate synths (unwrap).
    */
  function redeemUSDC(
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory _redeemParams
  ) public {
    // burn _synthAmount to get peg tokens jEur
    uint256 pegTokensUnlocked = super.unwrap(_redeemParams.numTokens);

    // approves the synthereum pool to pull peg tokens tokens from user wallet
    synth.safeApprove(address(synthereumPool), pegTokensUnlocked);

    // redeem USDC by burning jEur in broker contract
    _redeemParams.recipient = msg.sender;
    (uint256 collateralRedeemed, ) = synthereumPool.redeem(_redeemParams);

    emit Redeem(
      msg.sender,
      address(synthereumPool),
      address(collateralInstance),
      collateralRedeemed
    );
  }

  /**
    @notice Mints fixed rate currency from a synthereum synthetic asset 
   */
  function mintFromSynth(
    ISynthereumPoolOnChainPriceFeed.ExchangeParams memory _exchangeParams
  ) public {
    // exchange function in broker to get jEur from synth
    (uint256 pegTokenAmount, ) = synthereumPool.exchange(_exchangeParams);

    // deposit peg tokens and mint this token according to rate
    uint256 numTokensMinted = super.wrap(pegTokenAmount);

    emit Mint(msg.sender, address(synth), address(this), numTokensMinted);
  }

  /**
    @notice Burns fixed rate currency and swap the peg synth with any other synthereum asset 
   */
  function swapForSynth(
    uint256 _fixedSynthAmount,
    ISynthereumPoolOnChainPriceFeed.ExchangeParams memory _exchangeParams
  ) public {
    // burn _synthAmount to get peg tokens jEur
    uint256 pegTokensUnlocked = super.unwrap(_fixedSynthAmount);

    // exchange function in broker to get final asset
    _exchangeParams.numTokens = pegTokensUnlocked;
    (uint256 numTokensMinted, ) = synthereumPool.exchange(_exchangeParams);
  }

  // only synthereum manager can pause new mintings
  function pauseContract() public {
    address manager =
      synthereumFinder.getImplementationAddress(SynthereumInterfaces.Manager);
    require(
      msg.sender == manager,
      'Only synthereum manager can call this function'
    );
    paused = true;
    emit ContractPaused();
  }

  // function checkPoolRegistration()
  //     internal
  //     view
  //     returns (address collateralAddress, address synthInstance)
  // {
  //     ISynthereumRegistry poolRegistry =
  //         ISynthereumRegistry(
  //             synthereumFinder.getImplementationAddress(
  //                 SynthereumInterfaces.PoolRegistry
  //             )
  //         );

  //     string memory synthTokenSymbol = synthereumPool.syntheticTokenSymbol();
  //     collateralInstance = synthereumPool.collateralToken();
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

  //     synthInstance = address(synthereumPool.syntheticToken());
  //     collateralAddress = address(collateralInstance);
  // }
}
