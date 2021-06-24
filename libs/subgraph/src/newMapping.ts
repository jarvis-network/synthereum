import {
  Bytes,
  log,
  DataSourceContext,
  BigInt,
  Address,
} from '@graphprotocol/graph-ts';

import { Transaction, Pool, Derivative } from '../generated/schema';

import {
  PoolDeployed as PoolDeployedEvent,
  // RoleGranted as RoleGrantedEvent,
  // RoleRevoked as RoleRevokedEvent,
} from '../generated/SynthereumDeployer/SynthereumDeployer';

import {
  Mint as MintEvent,
  Redeem as RedeemEvent,
  Exchange as ExchangeEvent,
  SynthereumPoolOnChainPriceFeed as SynthereumPoolOnChainPriceFeedContract,
} from '../generated/templates/SynthereumPoolOnChainPriceFeed/SynthereumPoolOnChainPriceFeed';

import { SynthereumPoolOnChainPriceFeed as SynthereumPoolOnChainPriceFeedTemplate } from '../generated/templates';

import {
  getPoolAndDerivative,
  getOrCreateUserEntity,
  addLastTransaction,
  getOrCreateERC20,
} from './utils';

function createOrGetSynthereumPool(
  address: Address,
  blockNumber: BigInt,
): Pool {
  let pool = Pool.load(address.toHexString());

  if (pool == null) {
    log.warning('createSynthereumPool()\n', []);
    let ctx = new DataSourceContext();
    ctx.setBigInt('startBlock', blockNumber);

    // add the pool as a data source
    SynthereumPoolOnChainPriceFeedTemplate.createWithContext(address, ctx);

    pool = new Pool(address.toHexString());

    let poolContract = SynthereumPoolOnChainPriceFeedContract.bind(address);
    pool.version = BigInt.fromI32(poolContract.version());

    // let collateralCurrency = getOrCreateERC20(poolContract.collateralToken());
    // pool.collateralCurrency = collateralCurrency.id;

    pool.save();
  }

  return pool as Pool;
}

export function handlePoolDeployed(event: PoolDeployedEvent): void {
  let derivativeAddress = event.params.derivative;
  let blockNumber = event.block.number;

  log.warning('handleCreatePerpetual() derivativeAddress = \n', [
    derivativeAddress.toHexString(),
  ]);

  let derivative = new Derivative(derivativeAddress.toHex());
  derivative.pools = new Array<string>(0);

  const pool = createOrGetSynthereumPool(event.params.newPool, blockNumber);
  let pools = derivative.pools;
  if (!pools.includes(pool.id)) {
    pools.push(pool.id);
  }
  derivative.pools = pools;
  pool.derivative = derivative.id;
  pool.save();

  let poolContract = SynthereumPoolOnChainPriceFeedContract.bind(
    event.params.newPool,
  );
  let tokenCurrencyAddress = poolContract.syntheticToken();
  let tokenERC20Entity = getOrCreateERC20(tokenCurrencyAddress);

  let collateralCurrencyAddress = poolContract.collateralToken();
  let collateralERC20Entity = getOrCreateERC20(collateralCurrencyAddress);

  derivative.tokenCurrency = tokenERC20Entity.id;
  derivative.collateralCurrency = collateralERC20Entity.id;
  derivative.save();
}

// #region Swap event handlers
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
  trx.recipient = event.params.recipient;

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
  trx.recipient = event.params.recipient;

  trx.save();
  addLastTransaction(user, trx);
  user.save();
}
// #endregion
