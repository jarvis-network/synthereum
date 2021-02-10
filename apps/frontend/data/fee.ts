import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { synthereumConfig } from '@jarvis-network/synthereum-contracts/dist/src/config';

// FIXME: the fee should loaded dynamically from the SC:
const FEE = new FPN(synthereumConfig[42].fees.feePercentage);
// const FEE = new FPN(0.002);

export { FEE };
