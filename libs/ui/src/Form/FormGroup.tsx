import React from 'react';

import { styled } from '../Theme';

export interface FormGroupProps {
  className?: string;
  stackable?: boolean;
}

const FormGroupContainer = styled.div<FormGroupProps>`
  margin-bottom: 20px;

  > .label {
    margin-left: 25px;
  }

  .input {
    margin-top: 15px;
  }

  ${props =>
    props.stackable
      ? `
    .input:not(:first-of-type) {
      margin-top: 0;

      .input-group {
        border-top: 0;
      }
    }
  `
      : ''}
`;

export const FormGroup: React.FC<FormGroupProps> = ({
  className,
  children,
  ...props
}) => (
  <FormGroupContainer className={className || ''} {...props}>
    {children}
  </FormGroupContainer>
);
