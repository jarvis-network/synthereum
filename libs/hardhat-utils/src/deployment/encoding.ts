import web3Utils from 'web3-utils';
import Web3EthAbi from 'web3-eth-abi';
import type { AbiCoder } from 'web3-eth-abi';

interface Roles {
  admin: string;
  maintainer: string;
  liquidityProvider: string;
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
  const poolPayload = ((Web3EthAbi as unknown) as AbiCoder).encodeParameters(
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

function encodeCreditLineDerivative(
  collateralAddress: string,
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
      {
        collateralAddress,
        priceFeedIdentifier: web3Utils.padRight(
          web3Utils.toHex(priceFeedIdentifier),
          64,
        ),
        syntheticName,
        syntheticSymbol,
        syntheticToken,
        fee: {
          feePercentage: {
            rawValue: web3Utils.toWei(fee.feePercentage.toString()),
          },
          feeRecipients: fee.feeRecipients,
          feeProportions: fee.feeProportions,
          totalFeeProportions: web3Utils.toWei('0'),
        },
        liquidationPercentage,
        capMintAmount,
        overCollateralization: collateralRequirement,
        minSponsorTokens: { rawValue: minSponsorTokens },
        excessTokenBeneficiary,
        version,
      },
    ],
  );
  return CreditLineDerivativePayload;
}

module.exports = {
  encodeLiquidityPool,
  encodeCreditLineDerivative,
};
