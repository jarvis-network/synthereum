import {
  Address,
  Bytes,
  dataSource,
  DataSourceContext,
  log,
  BigInt,
} from '@graphprotocol/graph-ts';

import {
  OldSynthereumPool as SynthereumPoolContractTemplate,
  OldPerpetualPoolParty as PerpetualPoolPartyContractTemplate,
} from '../generated/templates';

import { CreatePerpetualCall } from '../generated/OldSynthereumDerivativeFactory/OldSynthereumDerivativeFactory';

import {
  RoleGranted as RoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent,
  OldPerpetualPoolParty as PerpetualPoolPartyContract,
} from '../generated/templates/OldPerpetualPoolParty/OldPerpetualPoolParty';

import {
  Mint as MintEvent,
  Redeem as RedeemEvent,
  Exchange as ExchangeEvent,
  OldSynthereumPool as SynthereumPoolContract,
} from '../generated/templates/OldSynthereumPool/OldSynthereumPool';

import { Pool, Derivative, Transaction } from '../generated/schema';

import {
  getOrCreateUserEntity,
  addLastTransaction,
  getPoolAndDerivative,
  getOrCreateERC20,
} from './utils';

//                            //
// ======== UTILS ==========  //
//                            //

export function createOrGetSynthereumPool(
  address: Address,
  blockNumber: BigInt,
): Pool {
  let pool = Pool.load(address.toHexString());

  if (pool == null) {
    //
    log.warning('createSynthereumPool()\n', []);
    let ctx = new DataSourceContext();
    ctx.setBigInt('startBlock', blockNumber);

    // add the pool as a data source
    SynthereumPoolContractTemplate.createWithContext(address, ctx);
    //

    pool = new Pool(address.toHexString());

    let poolContract = SynthereumPoolContract.bind(address);
    pool.version = BigInt.fromI32(poolContract.version());

    // let collateralCurrency = getOrCreateERC20(poolContract.collateralToken());
    // pool.collateralCurrency = collateralCurrency.id;

    pool.save();
  }

  return pool as Pool;
}

function getPoolRole(): Bytes {
  let perpetualPoolPartyContract = PerpetualPoolPartyContract.bind(
    dataSource.address(),
  );
  return perpetualPoolPartyContract.POOL_ROLE();
}

//                                 //
// ========== HANDLERS ==========  //
//                                 //

// ==== HANDLERS FOR SYNTHEREUM DERIVATIVE FACTORY ====

export function handleCreatePerpetual(call: CreatePerpetualCall): void {
  let derivativeAddress = call.outputs.derivative;
  let blockNumber = call.block.number;

  log.warning('handleCreatePerpetual() derivativeAddress = \n', [
    derivativeAddress.toHexString(),
  ]);

  let derivative = new Derivative(derivativeAddress.toHex());
  derivative.pools = new Array<string>(0);

  let perpetualPoolPartyContract = PerpetualPoolPartyContract.bind(
    derivativeAddress,
  );
  let tokenCurrencyAddress = perpetualPoolPartyContract.tokenCurrency();
  let tokenERC20Entity = getOrCreateERC20(tokenCurrencyAddress);

  let collateralCurrencyAddress = perpetualPoolPartyContract.collateralCurrency();
  let collateralERC20Entity = getOrCreateERC20(collateralCurrencyAddress);

  derivative.tokenCurrency = tokenERC20Entity.id;
  derivative.collateralCurrency = collateralERC20Entity.id;
  derivative.save();

  // add the perpetual pool party as a data source
  let ctx = new DataSourceContext();
  ctx.setBigInt('startBlock', blockNumber);
  PerpetualPoolPartyContractTemplate.createWithContext(derivativeAddress, ctx);
}

// ==== HANDLERS FOR SYNTHEREUM DERIVATIVE (Perpetual pool party) ====

export function handleRoleGranted(event: RoleGrantedEvent): void {
  let perpetualPoolPartyAddress = dataSource.address();

  log.warning('handleRoleGranted() [pool party = {}, account = {}]\n', [
    perpetualPoolPartyAddress.toHexString(),
    event.params.account.toHexString(),
  ]);

  if (event.params.role.equals(getPoolRole())) {
    let poolEntity = createOrGetSynthereumPool(
      event.params.account,
      event.block.number,
    );
    poolEntity.derivative = dataSource.address().toHexString();
    poolEntity.save();

    let derivative = Derivative.load(
      perpetualPoolPartyAddress.toHexString(),
    ) as Derivative;
    let pools = derivative.pools;
    if (!pools.includes(poolEntity.id)) {
      pools.push(poolEntity.id);
    }
    derivative.pools = pools;
    derivative.save();

    log.warning('add pool role [pool party = {}, pool = {}]\n', [
      perpetualPoolPartyAddress.toHexString(),
      poolEntity.id,
    ]);
  }
}

export function handleRoleRevoked(event: RoleRevokedEvent): void {
  let perpetualPoolPartyAddress = dataSource.address();

  log.warning('handleRoleRevoked() [pool party = {}, account = {}]\n', [
    perpetualPoolPartyAddress.toHexString(),
    event.params.account.toHexString(),
  ]);

  if (event.params.role.equals(getPoolRole())) {
    let poolEntity = createOrGetSynthereumPool(
      event.params.account,
      event.block.number,
    );
    poolEntity.derivative = null;
    poolEntity.save();

    let derivative = Derivative.load(
      perpetualPoolPartyAddress.toHexString(),
    ) as Derivative;
    let pools = derivative.pools;
    log.warning('remove pool role [pool party = {}, pool = {}]\n', [
      perpetualPoolPartyAddress.toHexString(),
      poolEntity.id,
    ]);

    let remainingPools = new Array<string>(0);
    // TODO: refactor with .filter when arrow functions are fully implemented in Assemblyscript
    for (let i = 0; i < pools.length; i++) {
      // eslint-disable-next-line eqeqeq
      if (pools[i] != poolEntity.id) {
        remainingPools.push(pools[i]);
      }
    }
    derivative.pools = remainingPools;
    derivative.save();
  }
}

// ==== HANDLERS FOR SYNTHEREUM POOL ====

export function handleMint(event: MintEvent): void {
  log.debug('handleMint()\n', []);

  let poolAndDerivative = getPoolAndDerivative(event.params.pool.toHex());
  let pool = poolAndDerivative.pool;
  let derivative = poolAndDerivative.derivative;

  let user = getOrCreateUserEntity(event.params.account);

  let trx = new Transaction(event.transaction.hash.toHex());
  trx.type = 'mint';
  trx.poolVersion = pool.version;
  trx.userAddress = event.params.account;
  trx.timestamp = event.block.timestamp;
  trx.block = event.block.number;
  //
  trx.inputTokenAmount = event.params.collateralSent;
  trx.inputTokenAddress = Bytes.fromHexString(
    derivative.collateralCurrency,
  ) as Bytes;
  //
  trx.outputTokenAmount = event.params.numTokensReceived;
  trx.outputTokenAddress = Bytes.fromHexString(
    derivative.tokenCurrency,
  ) as Bytes;
  //
  trx.recipient = event.params.account;

  trx.save();
  addLastTransaction(user, trx);
  user.save();
}

export function handleRedeem(event: RedeemEvent): void {
  log.debug('handleRedeem()\n', []);

  let poolAndDerivative = getPoolAndDerivative(event.params.pool.toHex());
  let pool = poolAndDerivative.pool;
  let derivative = poolAndDerivative.derivative;
  let user = getOrCreateUserEntity(event.params.account);

  let trx = new Transaction(event.transaction.hash.toHex());
  trx.type = 'redeem';
  trx.poolVersion = pool.version;
  trx.userAddress = event.params.account;
  trx.timestamp = event.block.timestamp;
  trx.block = event.block.number;

  trx.inputTokenAmount = event.params.numTokensSent;
  trx.inputTokenAddress = Bytes.fromHexString(
    derivative.tokenCurrency,
  ) as Bytes;
  //
  trx.outputTokenAmount = event.params.collateralReceived;
  trx.outputTokenAddress = Bytes.fromHexString(
    derivative.collateralCurrency,
  ) as Bytes;
  //
  trx.recipient = event.params.account;

  trx.save();
  addLastTransaction(user, trx);
  user.save();
}

export function handleExchange(event: ExchangeEvent): void {
  log.debug('handleExchange()\n', []);

  let poolAndDerivative1 = getPoolAndDerivative(
    event.params.sourcePool.toHex(),
  );
  let pool1 = poolAndDerivative1.pool;
  let derivative1 = poolAndDerivative1.derivative;

  let poolAndDerivative2 = getPoolAndDerivative(event.params.destPool.toHex());
  let pool2 = poolAndDerivative2.pool;
  let derivative2 = poolAndDerivative2.derivative;

  let user = getOrCreateUserEntity(event.params.account);

  let trx = new Transaction(event.transaction.hash.toHex());
  trx.type = 'exchange';
  trx.poolVersion =
    pool1.version > pool2.version ? pool1.version : pool2.version;
  trx.userAddress = event.params.account;
  trx.timestamp = event.block.timestamp;
  trx.block = event.block.number;

  trx.inputTokenAmount = event.params.numTokensSent;
  trx.inputTokenAddress = Bytes.fromHexString(
    derivative1.tokenCurrency,
  ) as Bytes;
  //
  trx.outputTokenAmount = event.params.destNumTokensReceived;
  trx.outputTokenAddress = Bytes.fromHexString(
    derivative2.tokenCurrency,
  ) as Bytes;
  //
  trx.recipient = event.params.account;

  trx.save();
  addLastTransaction(user, trx);
  user.save();
}
