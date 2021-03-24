import React, { useState } from 'react';

import { RadioValue } from '../types';

import { Radio, RadioGroup } from '..';

export default {
  title: 'Button/Radio',
  component: Radio,
};

export const Default = () => (
  <>
    <Radio name="sex" value="male">
      Male
    </Radio>
    <Radio name="sex" value="female" checked>
      Female
    </Radio>
  </>
);

export const Disabled = () => (
  <>
    <Radio name="sex" value="male" disabled checked>
      Male
    </Radio>
    <Radio name="sex" value="female" disabled>
      Female
    </Radio>
  </>
);

export const Group = () => (
  <RadioGroup name="sex">
    <Radio value="male">Male</Radio>
    <Radio value="female">Female</Radio>
  </RadioGroup>
);

export const StatefulGroup = () => {
  const [value, setValue] = useState<RadioValue | undefined>(undefined);

  return (
    <>
      <RadioGroup name="sex" value={value} onChange={setValue}>
        <Radio value="male">Male</Radio>
        <Radio value="female">Female</Radio>
      </RadioGroup>
      <p>Current value: {value}</p>
    </>
  );
};

export const CustomStyles = () => (
  <RadioGroup name="sex" style={{ backgroundColor: 'yellow' }}>
    <Radio value="male" style={{ color: 'red' }}>
      I am the male label
    </Radio>
    <Radio value="female" style={{ color: 'blue' }}>
      I am the female label
    </Radio>
  </RadioGroup>
);
