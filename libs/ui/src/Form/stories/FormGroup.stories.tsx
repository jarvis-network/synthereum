import React from 'react';

import { FormGroup } from '../FormGroup';

import { Label } from '../../Label';
import { Input } from '../../Input';

import { Form } from '..';

export default {
  title: 'Form/FormGroup',
  component: Form,
};

export const Default = () => (
  <Form>
    <FormGroup>
      <Label>Price</Label>
      <Input label="Type amount" />
    </FormGroup>
  </Form>
);

export const Stackable = () => (
  <Form>
    <FormGroup stackable>
      <Label>Price</Label>
      <Input label="Type amount" />
      <Input label="Type amount" />
      <Input label="Type amount" />
    </FormGroup>
  </Form>
);
