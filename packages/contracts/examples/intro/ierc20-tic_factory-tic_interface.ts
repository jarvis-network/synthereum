import BN from 'bn.js';
import { formatBN } from '@jarvis-network/web3-utils/base/big-number';
import {
  Address,
  assertIsAddress,
} from '@jarvis-network/web3-utils/eth/address';
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { getContract } from '@jarvis-network/web3-utils/eth/contracts/get-contract';
import {
  IERC20_Abi,
  TICFactory_Abi,
  TICInterface_Abi,
} from '../../src/contracts/abi';
import { IERC20 } from '../../src/contracts/typechain';

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
  const usdcInstance = getContract(web3, IERC20_Abi, '0x1'); // TODO: Use the correct address
  const jEURInstance = getContract(web3, IERC20_Abi, '0x2');

  // 2. Use this to get the balance of the user
  const usersUsdcBalance = await getErc20Balance(
    usdcInstance,
    assertIsAddress('0x123123'),
  );
  console.log(`USDC balance: ${formatBN(usersUsdcBalance)}`);

  // 3. Use this to get his transactions of the same asset type: USDC <-> USDC
  // Get past ERC20 transfer events for USDC:
  // const allTransferEvents = getAllTransferEvents(usdcInstance, '0x23234');

  // TICFactory produces TIC instances with the symbolToTIC(string)
  const ticFactory = getContract(web3, TICFactory_Abi, '0x12213123' as Address); // TODO: Use the correct address
  const jEurTicInstanceAddress = await ticFactory.methods
    .symbolToTIC('jEUR')
    .call();
  const jEurTicInstance = getContract(
    web3,
    TICInterface_Abi,
    jEurTicInstanceAddress,
  );

  const jChfTicInstanceAddress = await ticFactory.methods
    .symbolToTIC('jEUR')
    .call();
  const jChfTicInstance = getContract(
    web3,
    TICInterface_Abi,
    jChfTicInstanceAddress,
  );

  // In the UI we have 3 basic operation in Synthereum:
  //   * mint()     convert stable coin into j Asset: USDC -> jEUR | USDC -> jGBP
  //   * exchange() exchange between 2 j Assets: jEUR <-> jGBP
  //   * redeem()   convert back to stable coin a jAsset: jCHF -> USDC

  /* --------------------------------- Minting -------------------------------- */
  const userCollateralInUsdc = 123; // TODO: Use BN
  const jEurTokensToMint = 567;
  await jEurTicInstance.methods.mintRequest(
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
  return uiText;
}

export async function getErc20Balance(
  contract: IERC20,
  address: Address,
): Promise<BN> {
  const balance = await contract.methods.balanceOf(address).call();
  return new BN(balance);
}
