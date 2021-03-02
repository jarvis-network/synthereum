import React, { useState } from 'react';

import { IconsDropdown } from '..';

export default {
  title: 'Dropdown/IconsDropdown',
  component: IconsDropdown,
};

const noop = () => undefined;

export const Default = () => (
  <IconsDropdown
    items={[
      {
        icon: 'IoIosArrowRoundDown',
        onClick: noop,
      },
      {
        icon: 'IoIosArrowRoundForward',
        onClick: noop,
      },
      {
        icon: 'IoIosArrowUp',
        onClick: noop,
      },
    ]}
  />
);

export const Stateful = () => {
  const [active, setActive] = useState(0);

  const onChange = (index: number) => () => setActive(index);

  return (
    <IconsDropdown
      active={active}
      items={[
        {
          icon: 'IoIosArrowRoundDown',
          onClick: onChange(0),
        },
        {
          icon: 'IoIosArrowRoundForward',
          onClick: onChange(1),
        },
        {
          icon: 'IoIosArrowUp',
          onClick: onChange(2),
        },
      ]}
    />
  );
};
