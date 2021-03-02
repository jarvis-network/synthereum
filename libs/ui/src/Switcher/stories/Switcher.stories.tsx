import React, { useState } from 'react';

import { Switcher } from '../Switcher';

export default {
  title: 'Switcher',
  component: Switcher,
};

const items = ['stop', 'slow', 'fast', 'instant'];

export const Stuff = () => {
  const [selected, setSelected] = useState(0);

  return (
    <Switcher
      items={items}
      onChange={value => setSelected(items.indexOf(value))}
      selected={selected}
    />
  );
};
