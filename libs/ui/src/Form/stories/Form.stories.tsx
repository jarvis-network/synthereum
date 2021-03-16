import React from 'react';

import { Form } from '..';

import {
  Default as FormGroup,
  Stackable as StackableFormGroup,
} from './FormGroup.stories';

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
