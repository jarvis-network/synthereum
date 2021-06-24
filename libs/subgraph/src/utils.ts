import { Address, Bytes, log, BigInt } from '@graphprotocol/graph-ts';

import {
  Pool,
  Derivative,
  User,
  Transaction,
  ERC20,
} from '../generated/schema';

import { IERC20Contract } from '../generated/OldSynthereumDerivativeFactory/IERC20Contract';

let LAST_TRANSACTION_COUNT = 30;

export function addLastTransaction(user: User, trx: Transaction): void {
  let lastTransactions = user.lastTransactions;
  lastTransactions.unshift(trx.id);
  lastTransactions.splice(LAST_TRANSACTION_COUNT);
  user.lastTransactions = lastTransactions;
}

export function getOrCreateUserEntity(userAddress: Bytes): User {
  let addr = userAddress.toHexString();
  let preExistingUser = User.load(addr);
  if (preExistingUser != null) return preExistingUser as User;

  let user = new User(addr);
  user.lastTransactions = new Array<string>(LAST_TRANSACTION_COUNT);
  user.save();

  return user;
}

class PoolAndDerivative {
  constructor(readonly pool: Pool, readonly derivative: Derivative) {}
}

export function getPoolAndDerivative(
  poolAddress: string,
): PoolAndDerivative | null {
  log.debug('pool address = {}', [poolAddress]);
  let pool = Pool.load(poolAddress);

  if (pool != null) {
    log.debug('pool derivative = {}', [pool.derivative]);
    let derivative = Derivative.load(pool.derivative);
    return new PoolAndDerivative(
      pool as Pool,
      derivative as Derivative,
    ) as PoolAndDerivative;
  }
  return null;
}

export function getOrCreateERC20(tokenCurrencyAddress: Address): ERC20 {
  let alreadyExisting = ERC20.load(tokenCurrencyAddress.toHexString());
  if (alreadyExisting != null) {
    return alreadyExisting as ERC20;
  }
  let ERC20Entity = new ERC20(tokenCurrencyAddress.toHexString());
  let ERC20Contract = IERC20Contract.bind(tokenCurrencyAddress);
  ERC20Entity.symbol = ERC20Contract.symbol();
  ERC20Entity.decimals = BigInt.fromI32(ERC20Contract.decimals());
  ERC20Entity.save();
  return ERC20Entity as ERC20;
}
