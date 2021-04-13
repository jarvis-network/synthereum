import { getInfuraWeb3 } from '@jarvis-network/core-utils/dist/apis/infura';
import { assert } from '@jarvis-network/core-utils/dist/base/asserts';
import {
  formatAmount,
  mapSumBN,
  wei,
} from '@jarvis-network/core-utils/dist/base/big-number';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { AddressOn } from '@jarvis-network/core-utils/dist/eth/address';
import { SupportedNetworkId } from '../../src/config';
import { parseSupportedNetworkId } from '../../src/config/supported-networks';
import { loadRealm } from '../../src/core/load-realm';
import { RealmAgent } from '../../src/core/realm-agent';

/**
 * Apps building on top of Synthereum need to work with a single class - the
 * Synthereum Realm Agent.
 *
 * It implements the following functionality:
 * - collateralBalance() - get the agent's number of collateral tokens
 * - syntheticTokenBalanceOf(syntheticToken) - get the agent's number of
 *   synthetic tokens
 * - mint(mintWhat, stableCoinCollateral, outputSyntheticTokens) - mint
 *   sythetic tokens, by providing collateral tokens
 * - exchange(from, to, stableCoinCollateral, inputSyntheticTokens,
 *   outputSyntheticTokens) - exchange one type of synthetic token for another
 * - redeem(redeemWhat, stableCoinCollateral, inputSyntheticTokens) - convert
 * synthetic tokens back to collateral tokens
 */
export async function example() {
  // Use `parseSupportedNetworkId` to validate that a network id from the
  // outside environment is indeed supported. This function will throw an
  // exception if it isn't:
  const id: string = '42'; // a number would also work fine
  const netId: SupportedNetworkId = parseSupportedNetworkId(id);

  // Get a Web3 instance. We use Infura here for simplicity:
  const web3 = getInfuraWeb3(netId);
  const realm = await loadRealm(web3, netId);
  const myAddress = web3.defaultAccount as AddressOn<typeof netId>;
  const realmAgent: RealmAgent = new RealmAgent(realm, myAddress, 'v1');

  // Example: IERC20 Balances:
  console.log(
    `USDC balance: ${formatAmount(await realmAgent.collateralBalance())}`,
  );
  console.log(
    `jEUR balance: ${formatAmount(
      await realmAgent.syntheticTokenBalanceOf('jEUR'),
    )}`,
  );

  /// Get all balances in one promise:
  const balances = await realmAgent.getAllBalances();
  // TODO: multiply each balance by its price:
  const totalBalance = mapSumBN(balances, x => x[1]);
  console.log(`total balance: ${formatAmount(totalBalance)}`);

  // TODO: Get past ERC20 transfer events:
  // const allTransferEvents = getAllTransferEvents(usdcInstance, '0x23234');

  /* ------------------------- Synthereum Realm Agent ------------------------- */
  /*                                                                            */
  /* An agent in a Synthereum realm can perform 3 kinds of operations:          */
  /*  * mint()     convert stable coint to jAsset : USDC -> jEUR | USDC -> jGBP */
  /*  * exchange() exchange between 2 j Assets: jEUR <-> jGBP                   */
  /*  * redeem()   convert back to stable coin a jAsset: jCHF -> USDC           */
  /* -------------------------------------------------------------------------- */

  /* --------------------------------- Minting -------------------------------- */
  const tx = await realmAgent.mint({
    outputSynth: 'jEUR',
    // Mint 1000 wei of jEUR for 1100 wei of USDC | Assuming EUR/USD @ 1.10
    // Read more about calculating values: /docs/fee-calculations.md
    collateral: wei(1100),
    outputAmount: wei(1000),
  }).txPromise;
  console.log(tx.transactionHash);
  console.log(tx.events);
  console.log(tx.blockNumber);

  const {
    address: jEurAddress,
    instance: jEur,
  } = realmAgent.activePools.jEUR!.syntheticToken;

  const jEurBalance1 = FPN.fromWei(
    await jEur.methods.balanceOf(realmAgent.agentAddress).call(),
  );
  const jEurBalance2 = await realmAgent.syntheticTokenBalanceOf('jEUR');
  assert(jEurBalance1.bn.eq(jEurBalance2));

  console.log(
    `jEUR ERC20 Token Address: ${jEurAddress} | myBalance jEUR Balance:`,
    jEurBalance2,
  );

  /**************************************************************************
   *  Exchanging                                                            *
   *                                                                        *
   * Exchange combines redeem and mint in a single transaction.             *
   * The `collateral` is the amount of USDC which will be redeemed (for the *
   * input tokens) and then used to mint the output tokens.                 *
   **************************************************************************/
  realmAgent.exchange({
    // Redeem jEUR for USDC | Assuming EUR/USD is 1.10
    // Read more about calculating values: /docs/fee-calculations.md
    inputSynth: 'jEUR',
    inputAmount: wei(100),
    collateral: wei(110),

    // Mint jGBP with USDC  | Assuming GBP/USD is 1.35
    // Read more about calculating values: /docs/fee-calculations.md
    outputAmount: wei(148),
    outputSynth: 'jGBP',
  });

  /* -------------------------------- Redeeming ------------------------------- */
  realmAgent.redeem({
    inputSynth: 'jGBP',
    // Redeem USDC from jGBP  | Assuming GBP/USD is 1.35
    // Read more about calculating values: /docs/fee-calculations.md
    collateral: wei(135),
    inputAmount: wei(100),
  });

  // Wait for approval...
  // TODO: check if validator approved the request (if meta-sigs are not used)

  // Update the user's balance:
  const usersjEURBalance = await realmAgent.syntheticTokenBalanceOf('jEUR');
  return `The user's USDC balance is ${formatAmount(usersjEURBalance)}`;
}
