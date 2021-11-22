import React, { useState } from 'react';

import { Select } from '..';
import { styled } from '../../Theme';

export default {
  title: 'Select',
  component: Select,
};

interface Option {
  value: string;
  label: string;
  icon: JSX.Element;
}

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
  const [value, setValue] = useState(20);

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

const RedHugeSelect = styled(Select as Select<Option>)`
  .react-select__control {
    background: #ff8585;
    max-height: none;
  }
  .react-select__single-value {
    font-size: 24px;
    padding: 10px;
  }
`;

export const CustomizedSelect = () => {
  const [value, setValue] = useState('jEUR');

  return (
    <div style={{ width: '200px' }}>
      <RedHugeSelect
        selected={value}
        onChange={e => setValue(e!.label)}
        rowsText="rows"
        options={['USDC', 'jEUR', 'jGBP']}
      />
      Selected value: {value}
    </div>
  );
};
