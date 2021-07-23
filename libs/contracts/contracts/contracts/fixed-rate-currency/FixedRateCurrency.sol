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
    IERC20 _collateralToken,
    ISynthereumPoolOnChainPriceFeed _synthereumPoolAddress,
    ISynthereumFinder _synthereumFinder,
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
  function mintFromPegSynth(uint256 _pegTokenAmount) public isActive() {
    // deposit peg tokens and mint this token according to rate
    uint256 numTokensMinted = super.wrap(_pegTokenAmount);

    emit Mint(msg.sender, address(synth), address(this), numTokensMinted);
  }

  /** @notice - Burns fixed rate synths and unlocks the deposited peg synth (jEUR)
   */
  function redeemToPegSynth(uint256 _fixedSynthAmount) public {
    uint256 tokenRedeemed = super.unwrap(_fixedSynthAmount);
    emit Redeem(msg.sender, address(this), address(synth), tokenRedeemed);
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
    uint256 numTokensMinted = super.wrap(pegTokensMinted);

    emit Mint(msg.sender, address(synth), address(this), numTokensMinted);
  }

  /** @notice - Redeem USDC by burning peg synth (from synthereum pool)
        Unlocked by burning fixed rate synths (unwrap).
    */
  function redeemUSDC(
    ISynthereumPoolOnChainPriceFeed.RedeemParams memory _redeemParams
  ) public {
    // burn _synthAmount to get peg tokens jEur
    uint256 pegTokensUnlocked = super.unwrap(_redeemParams.numTokens);

    // pull peg synth from user wallet into this contract wallet
    synth.safeTransferFrom(msg.sender, address(this), pegTokensUnlocked);

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
    ISynthereumPoolOnChainPriceFeed.ExchangeParams memory _exchangeParams
  ) public {
    //TODO can we know the synth token address from exchange params?
    //TODO if not we should check the input address is correct (although if not the tx should fail)

    // pull synth to be exchanged from user wallet into this contract wallet
    inputSynthAddress.safeTransferFrom(
      msg.sender,
      address(this),
      _exchangeParams.numTokens
    );

    // exchange function in broker to get jEur from synth into user's wallet (recipient in exchaangeParams)
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
  // code an admin
  function pauseContract() public {
    require(msg.sender == admin, 'Only contract admin can call this function');
    paused = true;
    emit ContractPaused();
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
