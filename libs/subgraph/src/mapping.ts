import {
  Address,
  Bytes,
  dataSource,
  DataSourceContext,
  log,
  BigInt,
} from '@graphprotocol/graph-ts';

import { IERC20Contract } from '../generated/SynthereumDerivativeFactoryContract/IERC20Contract';

import {
  SynthereumPoolContract as SynthereumPoolContractTemplate,
  PerpetualPoolPartyContract as PerpetualPoolPartyContractTemplate,
} from '../generated/templates';

import { CreatePerpetualCall } from '../generated/SynthereumDerivativeFactoryContract/SynthereumDerivativeFactoryContract';

import {
  RoleGranted as RoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent,
  PerpetualPoolPartyContractABI as PerpetualPoolPartyContract,
} from '../generated/templates/PerpetualPoolPartyContract/PerpetualPoolPartyContractABI';

import {
  Mint as MintEvent,
  Redeem as RedeemEvent,
  Exchange as ExchangeEvent,
  SynthereumPoolContract,
} from '../generated/templates/SynthereumPoolContract/SynthereumPoolContract';

import {
  Pool,
  Derivative,
  ERC20,
  DerivativeFactory,
  Transaction,
  User,
} from '../generated/schema';

let DERIVATIVE_FACTORY_ID = '1';
let LAST_TRANSACTION_COUNT = 30;

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

function getOrCreateERC20(tokenCurrencyAddress: Address): ERC20 {
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

function getOrCreateUserEntity(userAddress: Bytes): User {
  let addr = userAddress.toHexString();
  let preExistingUser = User.load(addr);
  if (preExistingUser != null) return preExistingUser as User;

  let user = new User(addr);
  user.lastTransactions = new Array<string>(LAST_TRANSACTION_COUNT);
  user.save();

  return user;
}

function addLastTransaction(user: User, trx: Transaction): void {
  let lastTransactions = user.lastTransactions;
  lastTransactions.unshift(trx.id);
  lastTransactions.splice(LAST_TRANSACTION_COUNT);
  user.lastTransactions = lastTransactions;
}

function getPoolRole(): Bytes {
  let perpetualPoolPartyContract = PerpetualPoolPartyContract.bind(
    dataSource.address(),
  );
  return perpetualPoolPartyContract.POOL_ROLE();
}

function getOrCreateDerivativeFactoryEntity(): DerivativeFactory {
  let derivativeFactoryEntity = DerivativeFactory.load(DERIVATIVE_FACTORY_ID);
  if (derivativeFactoryEntity == null) {
    derivativeFactoryEntity = new DerivativeFactory(DERIVATIVE_FACTORY_ID);
    derivativeFactoryEntity.derivatives = new Array<string>(0);
  }
  return derivativeFactoryEntity as DerivativeFactory;
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

  let derivativeFactoryEntity = getOrCreateDerivativeFactoryEntity();

  let derivatives = derivativeFactoryEntity.derivatives;
  derivatives.push(derivative.id);
  /* https://thegraph.com/docs/assemblyscript-api
    [...] array properties have to be set again explicitly after changing the array. */
  derivativeFactoryEntity.derivatives = derivatives;

  derivativeFactoryEntity.save();
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

  trx.save();
  addLastTransaction(user, trx);
  user.save();
}
