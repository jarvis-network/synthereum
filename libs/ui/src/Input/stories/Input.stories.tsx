import React, { useState } from 'react';
import { boolean, select, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { InputProps } from '../types';

import { Emoji } from '../../Emoji';
import { emojiList } from '../../Emoji/stories/data';

import { Input } from '..';

export default {
  title: 'Input',
  component: Input,
};

interface StatefulInputProps extends InputProps {
  initialValue?: string;
}

const StatefulInput: React.FC<StatefulInputProps> = ({
  initialValue = '',
  ...props
}) => {
  const [value, setValue] = useState<string>(initialValue);

  return (
    <Input
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
        action(`input text changed: ${e.target.value}`);
      }}
      {...props}
    />
  );
};

const props = {
  label: 'Label',
  initialValue: 'Initial value',
};

export const Default = () => <StatefulInput />;

export const WithInitialValue = () => (
  <StatefulInput initialValue="Initial value" />
);

export const WithLabel = () => <StatefulInput label="Label" />;

export const WithLabelAndInitialValue = () => <StatefulInput {...props} />;

export const Invalid = () => (
  <StatefulInput invalid invalidMessage="Please enter this field!" {...props} />
);

export const WithPrefix = () => (
  <StatefulInput prefix={<Emoji emoji="MoneyMouth" />} {...props} />
);

export const WithSuffix = () => (
  <StatefulInput suffix={<Emoji emoji="MoneyMouth" />} {...props} />
);

export const WithInfo = () => <StatefulInput info="Info" {...props} />;

export const Knobs = () => {
  const enablePrefix = boolean('Prefix', false);
  let prefix;
  if (enablePrefix) {
    prefix = (
      <Emoji emoji={select('Prefix emoji name', emojiList, 'MoneyMouth')} />
    );
  }

  const enableSuffix = boolean('Suffix', false);
  let suffix;
  if (enableSuffix) {
    suffix = (
      <Emoji emoji={select('Suffix emoji name', emojiList, 'MoneyMouth')} />
    );
  }

  return (
    <StatefulInput
      label={text('Placeholder', 'Placeholder')}
      value={text('Value', '')}
      invalid={boolean('Invalid', false)}
      invalidMessage={text('Invalid Message', 'Some error message')}
      info={text('Info message', '')}
      prefix={prefix}
      suffix={suffix}
    />
  );
};
