const web3Utils = require('web3-utils');
const Web3EthAbi = require('web3-eth-abi');

function encodeDerivative(
  collAddress,
  priceFeedIdentifier,
  syntheticName,
  syntheticSymbol,
  syntheticTokenAddress,
  collateralRequirement,
  disputeBondPct,
  sponsorDisputeRewardPct,
  disputerDisputeRewardPct,
  minSponsorTokens,
  withdrawalLiveness,
  liquidationLiveness,
  excessBeneficiary,
  derivativeAdmins,
  derivativePools,
) {
  derivativePayload = Web3EthAbi.encodeParameters(
    [
      {
        params: {
          collateralAddress: 'address',
          priceFeedIdentifier: 'bytes32',
          syntheticName: 'string',
          syntheticSymbol: 'string',
          syntheticToken: 'address',
          collateralRequirement: {
            rawValue: 'uint256',
          },
          disputeBondPct: {
            rawValue: 'uint256',
          },
          sponsorDisputeRewardPct: {
            ravValue: 'uint256',
          },
          disputerDisputeRewardPct: {
            rawValue: 'uint256',
          },
          minSponsorTokens: {
            rawValue: 'uint256',
          },
          withdrawalLiveness: 'uint256',
          liquidationLiveness: 'uint256',
          excessTokenBeneficiary: 'address',
          admins: 'address[]',
          pools: 'address[]',
        },
      },
    ],
    [
      {
        collateralAddress: collAddress,
        priceFeedIdentifier: web3Utils.padRight(
          web3Utils.toHex(priceFeedIdentifier),
          64,
        ),
        syntheticName: syntheticName,
        syntheticSymbol: syntheticSymbol,
        syntheticToken: syntheticTokenAddress,
        collateralRequirement: {
          rawValue: collateralRequirement,
        },
        disputeBondPct: {
          rawValue: disputeBondPct,
        },
        sponsorDisputeRewardPct: {
          ravValue: sponsorDisputeRewardPct,
        },
        disputerDisputeRewardPct: {
          rawValue: disputerDisputeRewardPct,
        },
        minSponsorTokens: {
          rawValue: minSponsorTokens,
        },
        withdrawalLiveness: withdrawalLiveness,
        liquidationLiveness: liquidationLiveness,
        excessTokenBeneficiary: excessBeneficiary,
        admins: derivativeAdmins,
        pools: derivativePools,
      },
    ],
  );
  return derivativePayload;
}

function encodeTIC(
  derivativeAddress,
  synthereumFinderAddress,
  poolVersion,
  roles,
  startingCollateralization,
  fee,
) {
  ticPayload = Web3EthAbi.encodeParameters(
    [
      'address',
      'address',
      'uint8',
      {
        roles: {
          admin: 'address',
          maintainer: 'address',
          liquidityProvider: 'address',
          validator: 'address',
        },
      },
      'uint256',
      {
        fee: {
          feePercentage: {
            rawValue: 'uint256',
          },
          feeRecipients: 'address[]',
          feeProportions: 'uint32[]',
        },
      },
    ],
    [
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      {
        admin: roles.admin,
        maintainer: roles.maintainer,
        liquidityProvider: roles.liquidityProvider,
        validator: roles.validator,
      },
      startingCollateralization,
      {
        feePercentage: {
          rawValue: web3Utils.toWei(fee.feePercentage.toString()),
        },
        feeRecipients: fee.feeRecipients,
        feeProportions: fee.feeProportions,
      },
    ],
  );
  return '0x' + ticPayload.substring(66);
}

function encodePool(
  derivativeAddress,
  synthereumFinderAddress,
  poolVersion,
  roles,
  isContractAllowed,
  startingCollateralization,
  fee,
) {
  poolPayload = Web3EthAbi.encodeParameters(
    [
      'address',
      'address',
      'uint8',
      {
        roles: {
          admin: 'address',
          maintainer: 'address',
          liquidityProvider: 'address',
          validator: 'address',
        },
      },
      'bool',
      'uint256',
      {
        fee: {
          feePercentage: {
            rawValue: 'uint256',
          },
          feeRecipients: 'address[]',
          feeProportions: 'uint32[]',
        },
      },
    ],
    [
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      {
        admin: roles.admin,
        maintainer: roles.maintainer,
        liquidityProvider: roles.liquidityProvider,
        validator: roles.validator,
      },
      isContractAllowed,
      startingCollateralization,
      {
        feePercentage: {
          rawValue: web3Utils.toWei(fee.feePercentage.toString()),
        },
        feeRecipients: fee.feeRecipients,
        feeProportions: fee.feeProportions,
      },
    ],
  );
  return '0x' + poolPayload.substring(66);
}

function encodePoolOnChainPriceFeed(
  derivativeAddress,
  synthereumFinderAddress,
  poolVersion,
  roles,
  isContractAllowed,
  startingCollateralization,
  fee,
) {
  poolPayload = Web3EthAbi.encodeParameters(
    [
      'address',
      'address',
      'uint8',
      {
        roles: {
          admin: 'address',
          maintainer: 'address',
          liquidityProvider: 'address',
        },
      },
      'bool',
      'uint256',
      {
        fee: {
          feePercentage: {
            rawValue: 'uint256',
          },
          feeRecipients: 'address[]',
          feeProportions: 'uint32[]',
        },
      },
    ],
    [
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      {
        admin: roles.admin,
        maintainer: roles.maintainer,
        liquidityProvider: roles.liquidityProvider,
      },
      isContractAllowed,
      startingCollateralization,
      {
        feePercentage: {
          rawValue: web3Utils.toWei(fee.feePercentage.toString()),
        },
        feeRecipients: fee.feeRecipients,
        feeProportions: fee.feeProportions,
      },
    ],
  );
  return '0x' + poolPayload.substring(66);
}

module.exports = {
  encodeDerivative,
  encodeTIC,
  encodePool,
  encodePoolOnChainPriceFeed,
};
