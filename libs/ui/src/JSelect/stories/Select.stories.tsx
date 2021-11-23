import React, { useState } from 'react';

import {
  Select,
  SingleValueProps,
  SingleValue,
  Option as OptionWrapper,
  OptionProps,
} from '..';
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
        onChange={(e: any) => setValue(e!.label)}
        rowsText="rows"
        options={['USDC', 'jEUR', 'jGBP']}
      />
      Selected value: {value}
    </div>
  );
};

const CustomSelect = styled(Select as Select<Option>)`
  .react-select__control {
    background: #ff8585;
    max-height: none;
  }
  .react-select__single-value {
    font-size: 24px;
    padding: 10px;
  }
`;
const AlignVertically = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 0;
`;

export const multiSelect = () => {
  const [values, setValues] = useState(['jEUR']);

  const options = ['USDC', 'jEUR', 'jGBP'].map<Option>(val => ({
    value: val,
    label: `${val} token`,
    icon: <div style={{ marginRight: '16px' }}>ICON</div>,
  }));

  const handleSelectChange = (symbols: string) => {
    if (values.includes(symbols)) {
      setValues(values.filter(value => value !== symbols));
    } else {
      setValues(oldValues => [...oldValues, symbols]);
    }
  };

  const renderSelectedValues = (): string => {
    if (!values.length) return '';
    if (values.length === 1) return values[0];
    return values.join(', ');
  };

  const OptionComponent = (props: OptionProps<Option, false>) => {
    const {
      data: { icon, label },
    } = props;
    return (
      <OptionWrapper {...props}>
        <AlignVertically>
          {icon}
          {label}
        </AlignVertically>
      </OptionWrapper>
    );
  };
  const SelectValue = (props: SingleValueProps<Option>) => {
    const {
      data: { icon, label },
    } = props;
    return (
      <SingleValue {...props}>
        <AlignVertically>
          {icon}
          {label}
        </AlignVertically>
      </SingleValue>
    );
  };

  return (
    <div style={{ width: '300px' }}>
      <CustomSelect
        selected={renderSelectedValues()}
        onChange={(val: any) => handleSelectChange(String(val!.value))}
        rowsText=""
        options={options}
        optionComponent={OptionComponent}
        singleValueComponent={SelectValue}
      />
      Selected values: {renderSelectedValues()}
    </div>
  );
};
