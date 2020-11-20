import Web3 from "web3";
import { Network } from "./networks";
import { getInfuraWeb3 } from "../apis/infura";

export type Web3Source = Web3 | Network;

export function getWeb3(web3OrNetwork: Web3Source): Web3 {
  return web3OrNetwork instanceof Web3
    ? web3OrNetwork
    : getInfuraWeb3(web3OrNetwork);
}
