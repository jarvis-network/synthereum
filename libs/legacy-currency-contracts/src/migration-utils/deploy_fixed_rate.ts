import type Web3 from 'web3';
// const { artifacts } = require('hardhat');

export async function deployFixedRate(
  args: any,
  web3: Web3,
  network: any,
  artifacts: any,
): Promise<string> {
  const { FixedRateCurrency } = artifacts;

  const accounts = await web3.eth.getAccounts();

  const fixedRateContract = await FixedRateCurrency.new(
    args.jsynth,
    args.collateral,
    args.pool,
    args.finder,
    args.atomicswap,
    args.admin,
    args.rate,
    args.name,
    args.symbol,
    { from: accounts[0] },
  );
  return fixedRateContract.address;
}
