import React from 'react';

import { Descriptions, DescriptionsItem, DescriptionsItemTooltip } from '..';

export default {
  title: 'Descriptions',
  component: Descriptions,
};

export const Default = () => (
  <Descriptions>
    <DescriptionsItem label="Slippage">0%</DescriptionsItem>
    <DescriptionsItem label="Fee">0.003 USDC</DescriptionsItem>
    <DescriptionsItemTooltip
      label="Network fee"
      tooltip="The amount of money used to collateralize the amount of money used to collateralize."
    >
      0.03 ETH
    </DescriptionsItemTooltip>
  </Descriptions>
);

export const Grid = () => (
  <Descriptions isGrid>
    <DescriptionsItem label="Slippage" isGrid>
      0%
    </DescriptionsItem>
    <DescriptionsItem label="Fee" isGrid>
      0.003 USDC
    </DescriptionsItem>
    <DescriptionsItemTooltip
      label="Network fee"
      valueTooltip="The amount of money used to collateralize the amount of money used to collateralize."
      isGrid
    >
      0.03 ETH
    </DescriptionsItemTooltip>
  </Descriptions>
);
