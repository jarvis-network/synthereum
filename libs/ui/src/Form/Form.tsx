import React, { ReactNode } from 'react';

import { styled } from '../Theme';

export interface FormProps {
  children: ReactNode;
  className?: string;
}

const FormContainer = styled.form``;

export const Form: React.FC<FormProps> = ({ className, children }) => (
  <FormContainer className={className || ''}>{children}</FormContainer>
);
