import React, { useState } from 'react';
import { number } from '@storybook/addon-knobs';

import { ReactSelectComponents, Select, SingleValueProps } from '..';
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

export const CustomWidth = () => {
  const width = number('Select width in px', 100, {
    range: true,
    min: 50,
    max: 400,
  });
  const [value, setValue] = useState('10');

  return (
    <div style={{ width: `${width}px` }}>
      <Select
        selected={value}
        onChange={(e: any) => setValue(e)}
        rowsText="rows"
        options={['10', '20']}
      />
    </div>
  );
};

const RedHugeSelect = styled(Select as Select<string, false>)`
  .react-select__control {
    background: #ff8585;
    max-height: none;
  }
  .react-select__single-value {
    font-size: 24px;
    padding: 10px;
  }
`;

export const Styled = () => {
  const [value, setValue] = useState('jEUR');

  return (
    <div style={{ width: '300px' }}>
      <RedHugeSelect
        selected={value}
        onChange={(e: any) => setValue(e?.label)}
        rowsText="rows"
        options={['USDC', 'jEUR', 'jGBP']}
      />
      Selected value: {value}
    </div>
  );
};

const CustomSubComponentSelect = styled(Select as Select<Option, false>)`
  min-width: 100px;
  width: auto;
  margin: 0 0 0 -4px;
  padding: 0;

  .react-select__control {
    max-height: none;
    transition: background-color 300ms;

    &:not(:hover):not(.react-select__control--menu-is-open) {
      background: transparent;
    }
  }

  .react-select__single-value {
    font-size: 20px;
  }

  .react-select__menu-list {
    background: white;
  }
`;
const AlignVertically = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 0;
`;

export const CustomSubComponent = () => {
  const [value, setValue] = useState('jEUR');

  const options = ['USDC', 'jEUR', 'jGBP'].map<Option>(val => ({
    value: val,
    label: `${val} token`,
    icon: <div style={{ marginRight: '16px' }}>ICON</div>,
  }));

  const SingleValue = (props: SingleValueProps<Option, false>) => {
    const {
      data: { icon, label },
    } = props;
    return (
      <ReactSelectComponents.SingleValue {...props}>
        <AlignVertically>
          {icon}
          {label}
        </AlignVertically>
      </ReactSelectComponents.SingleValue>
    );
  };

  return (
    <div style={{ width: '300px' }}>
      <CustomSubComponentSelect
        selected={value}
        onChange={(val: any) => setValue(val?.value)}
        options={options}
        components={{ SingleValue }}
      />
      Selected values: {value}
    </div>
  );
};
