import BN from 'bn.js';
import { formatBN } from '@jarvis-network/web3-utils/base/big-number';
import {
  Address,
  assertIsAddress,
} from '@jarvis-network/web3-utils/eth/address';
import { getInfuraWeb3 } from '@jarvis-network/web3-utils/apis/infura';
import { IERC20 } from '../../src/contracts/typechain';
import { loadRealm } from '../../src/core/load-realm';
import { SupportedNetworkId } from '../../src/config/types';

/**
 * Frontend needs to work with 3 contracts:
 * * IERC20
 * * TICFactory
 * * TICInstance
 */
export async function example() {
  // Get Web3 instance (but make sure you're connecting to a supported network):
  const netId: SupportedNetworkId = 42;
  const web3 = getInfuraWeb3(netId);
  const realm = await loadRealm(web3, netId);

  // Example: IERC20
  // 1. Get Contract instances from the Synthereum Realm loaded above:
  const usdcInstance = realm.collateralToken.instance;
  const jEURInstance = realm.ticInstances.jEUR.syntheticToken.instance;

  // 2. Use this to get the balance of the user
  const usersUsdcBalance = await getErc20Balance(
    usdcInstance,
    assertIsAddress('0x123123'), // TODO use correct address
  );
  console.log(`USDC balance: ${formatBN(usersUsdcBalance)}`);

  // 3. Use this to get his transactions of the same asset type: USDC <-> USDC
  // Get past ERC20 transfer events for USDC:
  // const allTransferEvents = getAllTransferEvents(usdcInstance, '0x23234');

  // However we don't need to load them manually, as this is handled for us:
  const jEurTicInstance = realm.ticInstances.jEUR.instance;
  const jChfTicInstance = realm.ticInstances.jCHF.instance;

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
    jChfTicInstance.options.address,
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
