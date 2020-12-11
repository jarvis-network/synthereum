import { FPN } from '@jarvis-network/web3-utils/base/fixed-point-number';
import { fees } from '@jarvis-network/synthereum-contracts/dist/src/config/data/fees';

// FIXME: the fee should be calculated per realm:
const FEE = new FPN(fees[42].feePercentage);
// const FEE = new FPN(0.002);

export { FEE };
