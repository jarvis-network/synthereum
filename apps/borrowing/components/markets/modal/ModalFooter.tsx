import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import React from 'react';

import { Footer } from './common/shared';

interface Props {
  newRatio: FPN;
  liquidationPrice: FPN;
  fee: FPN;
  currency: string;
}

export const ModalFooter: React.FC<Props> = ({
  newRatio,
  liquidationPrice,
  fee,
  currency,
}) => (
  <Footer
    style={
      fee.eq(new FPN(0))
        ? {
            height: '103px',
            bottom: '-126px',
          }
        : {}
    }
  >
    <div>
      <div>Your Collateralization Ratio</div>
      <div>{newRatio.format(4)}%</div>
    </div>
    <div>
      <div>Liquidation Price</div>
      <div>{liquidationPrice.format(4)}$</div>
    </div>
    {fee.gt(new FPN(0)) && (
      <div>
        <div>Fee</div>
        <div>
          {fee.format(6)} {currency}
        </div>
      </div>
    )}
  </Footer>
);
