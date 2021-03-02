import React from 'react';

import {
  Default as FormGroup,
  Stackable as StackableFormGroup,
} from './FormGroup.stories';

import { Form } from '..';

export default {
  title: 'Form',
  component: Form,
};

export const Default = () => (
  <Form>
    <FormGroup />
    <StackableFormGroup />
  </Form>
);
