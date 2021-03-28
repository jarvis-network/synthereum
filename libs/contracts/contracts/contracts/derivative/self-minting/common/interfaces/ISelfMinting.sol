// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {
  ISelfMintingDerivativeDeployment
} from './ISelfMintingDerivativeDeployment.sol';
import {
  FixedPoint
} from '../../../../../@jarvis-network/uma-core/contracts/common/implementation/FixedPoint.sol';

interface ISelfMinting is ISelfMintingDerivativeDeployment {
  struct DaoFee {
    FixedPoint.Unsigned feePercentage;
    address feeRecipient;
  }

  function setCapMintAmount(FixedPoint.Unsigned memory capMintAmount) external;

  function setCapDepositRatio(FixedPoint.Unsigned memory capDepositRatio)
    external;

  function setDaoFee(DaoFee memory daoFee) external;

  function setDaoFeePercentage(FixedPoint.Unsigned memory daoFeePercentage)
    external;

  function setDaoFeeRecipient(address daoFeeRecipient) external;
}
