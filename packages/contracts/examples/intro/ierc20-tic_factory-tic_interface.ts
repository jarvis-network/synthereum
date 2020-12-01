import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { Tagged, TagOf } from '@jarvis-network/web3-utils/base/tagged-type';
import {
  Address,
  assertIsAddress,
} from '@jarvis-network/web3-utils/eth/address';
import BN from 'bn.js';
import { IERC20, TIC, TICFactory } from '../../src/contracts/abi';
import {
  IERC20 as IERC20_Type,
  TIC as TIC_Type,
  TICFactory as TICFactory_Type,
} from '../../src/contracts/typechain';

import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import { formatBN, toBN } from '@jarvis-network/web3-utils/base/big-number';
import {
  NetworkName,
  TaggedWeb3,
} from '@jarvis-network/web3-utils/eth/web3-instance';
import { BaseContract } from '../../src/contracts/typechain/types';
import type { AbiItem } from 'web3-utils';

/**
 * Frontend needs to work with 3 contracts:
 * * IERC20
 * * TICFactory
 * * TICInstance
 */
export async function example() {
  // Get Web3 instance:
  const web3 = getInfuraWeb3(42);

  // Example: IERC20
  // 1. Get Contract instances:
  const usdcInstance = getContract(web3, IERC20, '0x1'); // TODO: Use the correct address
  const jEURInstance = getContract(web3, IERC20, '0x2');

  // 2. Use this to get the balance of the user
  const usersUsdcBalance = await getErc20Balance(
    usdcInstance,
    assertIsAddress('0x123123'),
  );

  // 3. Use this to get his transactions of the same asset type: USDC <-> USDC
  // Get past ERC20 transfer events for USDC:
  // const allTransferEvents = getAllTransferEvents(usdcInstance, '0x23234');

  // TICFactory produces TIC instances with the symbolToTIC(string)
  const ticFactory = makeTicFactory(web3, TICFactory);
  const factory = ticFactory(assertIsAddress('0x12213123')); // TODO: Use the correct address
  const jEurTicInstance = ((await factory.methods.symbolToTIC(
    'jEUR',
  )) as unknown) as TIC_Type; // TODO: fix wrapper to have better return type

  const jChfTicInstance = ((await factory.methods.symbolToTIC(
    'jCHF',
  )) as unknown) as TIC_Type;

  // In the UI we have 3 basic operation in Synthereum:
  //   * mint()     convert stable coin into j Asset: USDC -> jEUR | USDC -> jGBP
  //   * exchange() exchange between 2 j Assets: jEUR <-> jGBP
  //   * redeem()   convert back to stable coin a jAsset: jCHF -> USDC

  /* --------------------------------- Minting -------------------------------- */
  const userCollateralInUsdc = 123; // TODO: Use BN
  const jEurTokensToMint = 567;
  const mintRequestTxResult = await jEurTicInstance.methods.mintRequest(
    userCollateralInUsdc,
    jEurTokensToMint,
  );

  // /* ------------------------------- Exchanging ------------------------------- */
  const jChfToEarnFromExchange = 678;
  jEurTicInstance.methods.exchangeRequest(
    (jChfTicInstance as any)['address'](),
    jEurTokensToMint / 2,
    userCollateralInUsdc,
    jChfToEarnFromExchange,
  );

  /* -------------------------------- Redeeming ------------------------------- */
  const howMuchUsdcToRedeem = 234;

  jEurTicInstance.methods.redeemRequest(
    howMuchUsdcToRedeem,
    jChfToEarnFromExchange / 3,
  );

  // Wait for approval...
  // Update the user's balance:

  const usersjEURBalance = await getErc20Balance(
    jEURInstance,
    assertIsAddress('0x123123'),
  );

  const uiText = `The user's USDC balance is ${formatBN(usersjEURBalance)}`;
}

function makeTicFactory<Net extends NetworkName, C extends BaseContract>(
  web3: TaggedWeb3<Net>,
  abi: Tagged<AbiItem[], C>,
) {
  return (address: Address) => getContract(web3, abi, address);
}

export async function getErc20Balance(
  contract: TagOf<typeof IERC20>,
  address: Address,
): Promise<BN> {
  const balance = await contract.methods.balanceOf(address).call();
  return new BN(balance);
}
