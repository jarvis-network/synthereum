import React, { useState } from 'react';

import { CheckboxValue } from '../types';

import { Checkbox, CheckboxGroup } from '..';

export default {
  title: 'Button/Checkbox',
  component: Checkbox,
};

export const Default = () => (
  <>
    <Checkbox name="first-value">I read Terms & Conditions</Checkbox>
    <Checkbox name="second-value" checked>
      I want to subscribe
    </Checkbox>
  </>
);

export const Disabled = () => (
  <>
    <Checkbox name="first-value" checked disabled>
      I read Terms & Conditions
    </Checkbox>
    <Checkbox name="second-value" disabled>
      I want to subscribe
    </Checkbox>
  </>
);

export const Group = () => (
  <CheckboxGroup>
    <Checkbox name="first-value">I read Terms & Conditions</Checkbox>
    <Checkbox name="second-value">I want to subscribe</Checkbox>
  </CheckboxGroup>
);

export const StatefulGroup = () => {
  const [value, setValue] = useState<CheckboxValue[]>([]);

  return (
    <>
      <CheckboxGroup value={value} onChange={setValue}>
        <Checkbox name="first-value">I read Terms & Conditions</Checkbox>
        <Checkbox name="second-value">I want to subscribe</Checkbox>
      </CheckboxGroup>
      <p>Value: {JSON.stringify(value)}</p>
    </>
  );
};

export const CustomStyles = () => (
  <CheckboxGroup style={{ backgroundColor: 'yellow' }}>
    <Checkbox name="first-value" style={{ color: 'red' }}>
      I read Terms & Conditions
    </Checkbox>
    <Checkbox name="second-value" style={{ color: 'blue' }}>
      I want to subscribe
    </Checkbox>
  </CheckboxGroup>
);
