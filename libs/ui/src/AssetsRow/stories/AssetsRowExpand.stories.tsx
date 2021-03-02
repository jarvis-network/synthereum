import React from 'react';

import { Icon } from '../../Icon';

import { AssetsRowExpand } from '..';

export default {
  title: 'AssetsRow/AssetsRowExpand',
  component: AssetsRowExpand,
};

const Item = () => (
  <AssetsRowExpand
    from={{
      flag: 'eur',
      name: 'jEUR',
      value: -2,
    }}
    to={{
      flag: 'us',
      name: 'USDC',
      value: 2.72,
    }}
    descriptions={[
      {
        label: 'Type',
        value: 'Radeem',
        tooltip: "Radeem's gonna radeem",
      },
      {
        label: 'Timestamp',
        value: '7/20/20 7:00 PM',
      },
      {
        label: 'See on etherscan',
        value: (
          <Icon icon="IoMdOpen" style={{ justifyContent: 'flex-start' }} />
        ),
      },
      {
        label: 'Status',
        value: 'Pending',
      },
    ]}
  />
);

export const Default = () => (
  <>
    <Item />
    <Item />
    <Item />
    <AssetsRowExpand
      from={{
        image: 'https://is.gd/avataravatar110',
        name: 'jEUR',
        value: -2,
      }}
      to={{
        name: '0xEa...BF5e',
      }}
      descriptions={[
        {
          label: 'Type',
          value: 'Radeem',
          tooltip: "Radeem's gonna radeem",
        },
        {
          label: 'Timestamp',
          value: '7/20/20 7:00 PM',
        },
        {
          label: 'See on etherscan',
          value: (
            <Icon icon="IoMdOpen" style={{ justifyContent: 'flex-start' }} />
          ),
        },
        {
          label: 'Status',
          value: 'Pending',
        },
      ]}
    />
  </>
);
