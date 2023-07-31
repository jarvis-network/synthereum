import web3Utils from 'web3-utils';
import Web3EthAbi from 'web3-eth-abi';
import type { AbiCoder } from 'web3-eth-abi';

interface Roles {
  admin: string;
  maintainer: string;
  liquidityProvider: string;
}

interface StandardRoles {
  admin: string;
  maintainer: string;
}

interface Fee {
  feePercentage: number;
  feeRecipients: string[];
  feeProportions: number[];
}

function encodeLiquidityPool(
  collateralToken: string,
  syntheticName: string,
  syntheticSymbol: string,
  syntheticToken: string,
  roles: Roles,
  overCollateralization: string,
  feeData: Fee,
  priceIdentifier: string,
  collateralRequirement: string,
  liquidationReward: string,
  version: number,
) {
  const poolPayload = (Web3EthAbi as unknown as AbiCoder).encodeParameters(
    [
      {
        params: {
          collateralToken: 'address',
          syntheticName: 'string',
          syntheticSymbol: 'string',
          syntheticToken: 'address',
          roles: {
            admin: 'address',
            maintainer: 'address',
            liquidityProvider: 'address',
          },
          overCollateralization: 'uint256',
          feeData: {
            feePercentage: {
              rawValue: 'uint256',
            },
            feeRecipients: 'address[]',
            feeProportions: 'uint32[]',
          },
          priceIdentifier: 'bytes32',
          collateralRequirement: 'uint256',
          liquidationReward: 'uint256',
          version: 'uint8',
        },
      },
    ],
    [
      {
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken,
        roles: {
          admin: roles.admin,
          maintainer: roles.maintainer,
          liquidityProvider: roles.liquidityProvider,
        },
        overCollateralization,
        feeData: {
          feePercentage: {
            rawValue: web3Utils.toWei(feeData.feePercentage.toString()),
          },
          feeRecipients: feeData.feeRecipients,
          feeProportions: feeData.feeProportions,
        },
        priceIdentifier: web3Utils.padRight(
          web3Utils.toHex(priceIdentifier),
          64,
        ),
        collateralRequirement,
        liquidationReward,
        version,
      },
    ],
  );
  return poolPayload;
}

function encodeMultiLpLiquidityPool(
  version: number,
  collateralToken: string,
  syntheticName: string,
  syntheticSymbol: string,
  syntheticToken: string,
  roles: StandardRoles,
  fee: number,
  priceIdentifier: string,
  overCollateralRequirement: string,
  liquidationReward: string,
  lendingId: string,
  interestBearingToken: string,
  daoInterestShare: string,
  jrtBuybackShare: string,
) {
  const poolPayload = (Web3EthAbi as unknown as AbiCoder).encodeParameters(
    [
      {
        params: {
          version: 'uint8',
          collateralToken: 'address',
          syntheticName: 'string',
          syntheticSymbol: 'string',
          syntheticToken: 'address',
          roles: {
            admin: 'address',
            maintainer: 'address',
          },
          fee: 'uint64',
          priceIdentifier: 'bytes32',
          overCollateralRequirement: 'uint128',
          liquidationReward: 'uint64',
          lendingManagerParams: {
            lendingId: 'string',
            interestBearingToken: 'address',
            daoInterestShare: 'uint64',
            jrtBuybackShare: 'uint64',
          },
        },
      },
    ],
    [
      {
        version,
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken,
        roles: {
          admin: roles.admin,
          maintainer: roles.maintainer,
        },
        fee: web3Utils.toWei(fee.toString()),
        priceIdentifier: web3Utils.padRight(
          web3Utils.toHex(priceIdentifier),
          64,
        ),
        overCollateralRequirement,
        liquidationReward,
        lendingManagerParams: {
          lendingId,
          interestBearingToken,
          daoInterestShare,
          jrtBuybackShare,
        },
      },
    ],
  );
  return poolPayload;
}

function encodeCreditLineDerivative(
  collateralToken: string,
  priceFeedIdentifier: string,
  syntheticName: string,
  syntheticSymbol: string,
  syntheticToken: string,
  collateralRequirement: string,
  minSponsorTokens: string,
  excessTokenBeneficiary: string,
  version: number,
  fee: Fee,
  liquidationPercentage: string,
  capMintAmount: string,
) {
  const CreditLineDerivativePayload = (
    Web3EthAbi as unknown as AbiCoder
  ).encodeParameters(
    [
      {
        params: {
          collateralToken: 'address',
          priceFeedIdentifier: 'bytes32',
          syntheticName: 'string',
          syntheticSymbol: 'string',
          syntheticToken: 'address',
          fee: {
            feePercentage: 'uint256',
            feeRecipients: 'address[]',
            feeProportions: 'uint32[]',
            totalFeeProportions: 'uint256',
          },
          liquidationPercentage: 'uint256',
          capMintAmount: 'uint256',
          collateralRequirement: 'uint256',
          minSponsorTokens: {
            rawValue: 'uint256',
          },
          excessTokenBeneficiary: 'address',
          version: 'uint8',
        },
      },
    ],
    [
      {
        collateralToken,
        priceFeedIdentifier: web3Utils.padRight(
          web3Utils.toHex(priceFeedIdentifier),
          64,
        ),
        syntheticName,
        syntheticSymbol,
        syntheticToken,
        fee: {
          feePercentage: web3Utils.toWei(fee.feePercentage.toString()),
          feeRecipients: fee.feeRecipients,
          feeProportions: fee.feeProportions,
          totalFeeProportions: web3Utils.toWei('0'),
        },
        liquidationPercentage,
        capMintAmount,
        collateralRequirement,
        minSponsorTokens: { rawValue: minSponsorTokens },
        excessTokenBeneficiary,
        version,
      },
    ],
  );
  return CreditLineDerivativePayload;
}

function encodeFixedRate(
  collateralToken: string,
  syntheticName: string,
  syntheticSymbol: string,
  syntheticToken: string,
  roles: Roles,
  version: number,
  rate: number,
) {
  const fixedRatePayload = (Web3EthAbi as unknown as AbiCoder).encodeParameters(
    [
      {
        params: {
          collateralToken: 'address',
          syntheticName: 'string',
          syntheticSymbol: 'string',
          syntheticToken: 'address',
          roles: {
            admin: 'address',
            maintainer: 'address',
          },
          version: 'uint8',
          rate: 'uint256',
        },
      },
    ],
    [
      {
        collateralToken,
        syntheticName,
        syntheticSymbol,
        syntheticToken,
        roles: {
          admin: roles.admin,
          maintainer: roles.maintainer,
        },
        version,
        rate,
      },
    ],
  );
  return fixedRatePayload;
}

function encodeMultiLpLiquidityPoolMigration(
  migrationPool: string,
  version: number,
  extraInputParams: string,
) {
  const migrationPayload = (Web3EthAbi as unknown as AbiCoder).encodeParameters(
    ['address', 'uint8', 'bytes'],
    [migrationPool, version, extraInputParams],
  );
  return migrationPayload;
}

module.exports = {
  encodeLiquidityPool,
  encodeMultiLpLiquidityPool,
  encodeCreditLineDerivative,
  encodeFixedRate,
  encodeMultiLpLiquidityPoolMigration,
};
