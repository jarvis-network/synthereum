import web3Utils from 'web3-utils';
import Web3EthAbi from 'web3-eth-abi';
import type { AbiCoder } from 'web3-eth-abi';

interface Roles {
  admin: string;
  maintainer: string;
  liquidityProvider: string;
}

interface PoolFee {
  feePercentage: {
    rawValue: string;
  };
  feeRecipients: string[];
  feeProportions: number[];
}

interface SelfMintingFee {
  feePercentage: { rawValue: string };
  feeRecipient: string;
}

interface CreditLineRoles {
  admin: string;
  maintainers: string[];
}

interface CreditLineFees {
  feePercentage: { rawValue: string };
  feeRecipients: string[];
  feeProportions: number[];
  totalFeeProportion: number;
}

function encodeDerivative(
  collAddress: string,
  priceFeedIdentifier: string,
  syntheticName: string,
  syntheticSymbol: string,
  syntheticTokenAddress: string,
  collateralRequirement: string,
  disputeBondPct: string,
  sponsorDisputeRewardPct: string,
  disputerDisputeRewardPct: string,
  minSponsorTokens: string,
  withdrawalLiveness: string,
  liquidationLiveness: string,
  excessBeneficiary: string,
  derivativeAdmins: string[],
  derivativePools: string[],
) {
  const derivativePayload = ((Web3EthAbi as unknown) as AbiCoder).encodeParameters(
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
        syntheticName,
        syntheticSymbol,
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
        withdrawalLiveness,
        liquidationLiveness,
        excessTokenBeneficiary: excessBeneficiary,
        admins: derivativeAdmins,
        pools: derivativePools,
      },
    ],
  );
  return derivativePayload;
}

function encodePoolOnChainPriceFeed(
  derivativeAddress: string,
  synthereumFinderAddress: string,
  poolVersion: number,
  roles: Roles,
  startingCollateralization: string,
  fee: PoolFee,
) {
  const poolPayload = ((Web3EthAbi as unknown) as AbiCoder).encodeParameters(
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
  return `0x${poolPayload.substring(66)}`;
}

function encodeSelfMintingDerivative(
  collateralAddress: string,
  priceFeedIdentifier: string,
  syntheticName: string,
  syntheticSymbol: string,
  syntheticToken: string,
  collateralRequirement: string,
  disputeBondPct: string,
  sponsorDisputeRewardPct: string,
  disputerDisputeRewardPct: string,
  minSponsorTokens: string,
  withdrawalLiveness: string,
  liquidationLiveness: string,
  excessTokenBeneficiary: string,
  version: number,
  fee: SelfMintingFee,
  capMintAmount: string,
  capDepositRatio: string,
) {
  const selfMintingDerivativePayload = ((Web3EthAbi as unknown) as AbiCoder).encodeParameters(
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
          version: 'uint8',
          daoFee: {
            feePercentage: { rawValue: 'uint256' },
            feeRecipient: 'address',
          },
          capMintAmount: { rawValue: 'uint256' },
          capDepositRatio: { rawValue: 'uint256' },
        },
      },
    ],
    [
      {
        collateralAddress,
        priceFeedIdentifier: web3Utils.padRight(
          web3Utils.toHex(priceFeedIdentifier),
          64,
        ),
        syntheticName,
        syntheticSymbol,
        syntheticToken,
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
        withdrawalLiveness,
        liquidationLiveness,
        excessTokenBeneficiary,
        version,
        daoFee: {
          feePercentage: {
            rawValue: web3Utils.toWei(fee.feePercentage.toString()),
          },
          feeRecipient: fee.feeRecipient,
        },
        capMintAmount: { rawValue: capMintAmount },
        capDepositRatio: {
          rawValue: capDepositRatio,
        },
      },
    ],
  );
  return selfMintingDerivativePayload;
}

function encodeCreditLineDerivative(
  collateralAddress: string,
  priceFeedIdentifier: string,
  syntheticName: string,
  syntheticSymbol: string,
  syntheticTokenAddress: string,
  collateralRequirement: string,
  minSponsorTokens: string,
  excessTokenBeneficiary: string,
  version: number,
  fee: CreditLineFees,
  liquidationRewardPct: string,
  roles: CreditLineRoles,
  capMintAmount: string,
) {
  const CreditLineDerivativePayload = ((Web3EthAbi as unknown) as AbiCoder).encodeParameters(
    [
      {
        params: {
          collateralAddress: 'address',
          priceFeedIdentifier: 'bytes32',
          syntheticName: 'string',
          syntheticSymbol: 'string',
          syntheticToken: 'address',
          fee: {
            feePercentage: { rawValue: 'uint256' },
            feeRecipients: 'address[]',
            feeProportions: 'uint32[]',
            totalFeeProportions: 'uint256',
          },
          roles: {
            admin: 'address',
            maintainers: 'address[]',
          },
          liquidationPercentage: 'uint256',
          capMintAmount: 'uint256',
          overCollateralization: 'uint256',
          minSponsorTokens: {
            rawValue: 'uint256',
          },
          excessTokenBeneficiary: 'address',
          version: 'uint8',
        },
      },
    ],
    [
      collateralAddress,
      web3Utils.padRight(web3Utils.toHex(priceFeedIdentifier), 64),
      syntheticName,
      syntheticSymbol,
      syntheticTokenAddress,
      {
        feePercentage: fee.feePercentage,
        feeRecipients: fee.feeRecipients,
        feeProportions: fee.feeProportions,
        totalFeeProportions: fee.totalFeeProportion,
      },
      {
        admin: roles.admin,
        maintainers: roles.maintainers,
      },
      liquidationRewardPct,
      capMintAmount,
      collateralRequirement,
      { rawValue: minSponsorTokens },
      excessTokenBeneficiary,
      version,
    ],
  );
  return CreditLineDerivativePayload;
}

module.exports = {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
  encodeSelfMintingDerivative,
  encodeCreditLineDerivative,
};
