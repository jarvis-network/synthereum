import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { synthereumConfig } from '@jarvis-network/synthereum-contracts/dist/src/config';

// FIXME: the fee should loaded dynamically from the SC:
const FEE = FPN.fromWei(synthereumConfig[42].fees.feePercentage);
// const FEE = new FPN(0.002);

export { FEE };
