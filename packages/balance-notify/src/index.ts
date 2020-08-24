import { Context } from '@azure/functions';
import constracts from '@jarvis/synthereum-contracts/contract-dependencies.json';
import iRTokenABI from '@jarvis/synthereum-contracts/dist/abi/IRToken.json';
import tICTokenABI from '@jarvis/synthereum-contracts/dist/abi/TICFactory.json';
import assets from '@jarvis/synthereum-contracts/synthetic-assets.json';
import axios from 'axios';
import BN from 'bn.js';
import _ from 'lodash';
import { Web3Service } from './web3';
interface Asset {
  name: string;
  balance: string;
}
interface ContractAddress {
  [key: number]: { [key: string]: string };
}
export async function timerTrigger(context: Context): Promise<void> {
  var timeStamp = new Date().toISOString();

  context.log('Checking balance', timeStamp);
  checkBalance(context);
}

const checkBalance = async (context: any) => {
  const networkId = parseInt(process.env.NETWORK_ID as string);
  const web3Service = new Web3Service(networkId);

  const tICTokenInstance = web3Service.getContract(
    (constracts as ContractAddress)[networkId].ticFactory as string,
    tICTokenABI.abi,
  );
  const iRTokenInstance = web3Service.getContract(
    (constracts as ContractAddress)[networkId].collateralAddress,
    iRTokenABI.abi,
  );
  const lowBalancesAssets = await Promise.all(
    assets.map<Asset>(async asset => {
      const assetName = asset.syntheticSymbol;
      const ticAddress = await tICTokenInstance.methods
        .symbolToTIC(assetName)
        .call();
      const collaterTicBalanceInWei = await iRTokenInstance.methods
        .balanceOf(ticAddress)
        .call();

      const collaterTicBalance = new BN(collaterTicBalanceInWei);
      if (
        collaterTicBalance.lte(
          new BN(
            web3Service.web3.utils.toWei(process.env.MINIMUM_BALANCE as string),
          ),
        )
      ) {
        return {
          name: assetName,
          balance: web3Service.web3.utils.fromWei(
            collaterTicBalance.toString(),
          ),
        } as Asset;
      }
    }),
  );
  await sendAlertOnTeams(_.compact(lowBalancesAssets));
  context.done(null, {});
};
/**
 * Sends an message using the Azure Functions binding for Microsoft Teams
 * @param {object} data data to be passed to the Microsoft Teams
 */
const sendAlertOnTeams = async (lowBalancesAssets: Asset[]) => {
  if (lowBalancesAssets.length <= 0) {
    return;
  }
  let message = 'Minimim balance is ${config.minimumBalance}. <br/>';
  lowBalancesAssets.forEach(
    asset =>
      (message += `<b>${asset.name}</b> : ${parseFloat(asset.balance).toFixed(
        4,
      )} \n`),
  );
  return axios({
    method: 'post',
    url: process.env.MS_TEAMS_CHANNEL,
    data: {
      text: `<pre>${message.toString()}</pre>`,
      title: `Keeper-boat Balance Alert`,
    },
  });
};
// export default timerTrigger;
