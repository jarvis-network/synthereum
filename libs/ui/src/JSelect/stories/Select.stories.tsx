import React, { useState } from 'react';

import { Select } from '..';

export default {
  title: 'Select',
  component: Select,
};

export const Default = () => {
  const [value, setValue] = useState('10');

  return (
    <Select
      selected={value}
      onChange={(e: any) => setValue(e)}
      rowsText="rows"
      options={['10', '20']}
    />
  );
};

export const Select100 = () => {
  const [value, setValue] = useState('10');

  return (
    <div style={{ width: '100px' }}>
      <Select
        selected={value}
        onChange={(e: any) => setValue(e)}
        rowsText="rows"
        options={['10', '20']}
      />
    </div>
  );
};

export const Select200 = () => {
  const [value, setValue] = useState('10');

  return (
    <div style={{ width: '200px' }}>
      <Select
        selected={value}
        onChange={(e: any) => setValue(e)}
        rowsText="rows"
        options={['10', '20']}
      />
    </div>
  );
};
