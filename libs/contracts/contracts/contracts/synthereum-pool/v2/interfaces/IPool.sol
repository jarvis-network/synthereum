// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {
  FixedPoint
} from '../../../../@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';
import {
  IERC20
} from '../../../../@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  IExtendedDerivative
} from '../../../derivative/common/interfaces/IExtendedDerivative.sol';
import {ISynthereumDeployer} from '../../../core/interfaces/IDeployer.sol';
import {ISynthereumFinder} from '../../../core/interfaces/IFinder.sol';
import {
  ISynthereumPoolDeployment
} from '../../common/interfaces/IPoolDeployment.sol';

interface ISynthereumPool is ISynthereumPoolDeployment {
  struct Fee {
    FixedPoint.Unsigned feePercentage;
    address[] feeRecipients;
    uint32[] feeProportions;
  }

  struct Roles {
    address admin;
    address maintainer;
    address liquidityProvider;
    address validator;
  }

  struct MintParameters {
    address sender;
    address derivativeAddr;
    uint256 collateralAmount;
    uint256 numTokens;
    uint256 feePercentage;
    uint256 nonce;
    uint256 expiration;
  }

  struct RedeemParameters {
    address sender;
    address derivativeAddr;
    uint256 collateralAmount;
    uint256 numTokens;
    uint256 feePercentage;
    uint256 nonce;
    uint256 expiration;
  }

  struct ExchangeParameters {
    address sender;
    address derivativeAddr;
    address destPoolAddr;
    address destDerivativeAddr;
    uint256 numTokens;
    uint256 collateralAmount;
    uint256 destNumTokens;
    uint256 feePercentage;
    uint256 nonce;
    uint256 expiration;
  }

  struct Signature {
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  struct SignatureVerificationParams {
    bytes32 domain_separator;
    bytes32 typeHash;
    ISynthereumPool.Signature signature;
    bytes32 validator_role;
  }

  enum DerivativeRoles {ADMIN, POOL, ADMIN_AND_POOL}

  enum SynthTokenRoles {ADMIN, MINTER, BURNER, ADMIN_AND_MINTER_AND_BURNER}

  function addDerivative(IExtendedDerivative derivative) external;

  function removeDerivative(IExtendedDerivative derivative) external;

  function mint(MintParameters memory mintMetaTx, Signature memory signature)
    external
    returns (uint256 feePaid);

  function redeem(
    RedeemParameters memory redeemMetaTx,
    Signature memory signature
  ) external returns (uint256 feePaid);

  function exchange(
    ExchangeParameters memory exchangeMetaTx,
    Signature memory signature
  ) external returns (uint256 feePaid);

  function exchangeMint(
    IExtendedDerivative srcDerivative,
    IExtendedDerivative derivative,
    uint256 collateralAmount,
    uint256 numTokens
  ) external;

  function withdrawFromPool(uint256 collateralAmount) external;

  function depositIntoDerivative(
    IExtendedDerivative derivative,
    uint256 collateralAmount
  ) external;

  function slowWithdrawRequest(
    IExtendedDerivative derivative,
    uint256 collateralAmount
  ) external;

  function slowWithdrawPassedRequest(IExtendedDerivative derivative)
    external
    returns (uint256 amountWithdrawn);

  function fastWithdraw(
    IExtendedDerivative derivative,
    uint256 collateralAmount
  ) external returns (uint256 amountWithdrawn);

  function emergencyShutdown(IExtendedDerivative derivative) external;

  function settleEmergencyShutdown(IExtendedDerivative derivative)
    external
    returns (uint256 amountSettled);

  function setFee(Fee memory _fee) external;

  function setFeePercentage(uint256 _feePercentage) external;

  function setFeeRecipients(
    address[] memory _feeRecipients,
    uint32[] memory _feeProportions
  ) external;

  function setStartingCollateralization(uint256 startingCollateralRatio)
    external;

  function addRoleInDerivative(
    IExtendedDerivative derivative,
    DerivativeRoles derivativeRole,
    address addressToAdd
  ) external;

  function renounceRoleInDerivative(
    IExtendedDerivative derivative,
    DerivativeRoles derivativeRole
  ) external;

  function addRoleInSynthToken(
    IExtendedDerivative derivative,
    SynthTokenRoles synthTokenRole,
    address addressToAdd
  ) external;

  function renounceRoleInSynthToken(
    IExtendedDerivative derivative,
    SynthTokenRoles synthTokenRole
  ) external;

  function setIsContractAllowed(bool isContractAllowed) external;

  function getAllDerivatives()
    external
    view
    returns (IExtendedDerivative[] memory);

  function getStartingCollateralization()
    external
    view
    returns (uint256 startingCollateralRatio);

  function isContractAllowed() external view returns (bool isAllowed);

  function getFeeInfo() external view returns (Fee memory fee);

  function getUserNonce(address user) external view returns (uint256 nonce);

  function calculateFee(uint256 collateralAmount)
    external
    view
    returns (uint256 fee);
}
