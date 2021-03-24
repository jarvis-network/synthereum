import React from 'react';

import { styled } from '../Theme';

interface Props {
  items: any[];
  onChange: (item: any) => void;
  selected: number;
}

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Container = styled.div`
  border: 1px solid ${props => props.theme.background.secondary};
  border-radius: ${props => props.theme.borderRadius.xs};
`;

const Button = styled.button<{ isActive: boolean }>`
  text-transform: capitalize;
  background: ${props => props.theme.background.primary};
  border: none;
  min-width: 35px;
  height: 20px;
  margin: 1px;
  color: ${props =>
    props.isActive ? props.theme.text.primary : props.theme.text.secondary};
  outline: none;
  font-size: ${props => props.theme.font.sizes.xs};

  &:first-child {
    border-radius: ${props => props.theme.borderRadius.xs} 0 0
      ${props => props.theme.borderRadius.xs};
  }

  &:last-child {
    border-radius: 0 ${props => props.theme.borderRadius.xs}
      ${props => props.theme.borderRadius.xs} 0;
  }

  &:not(:last-child) {
    border-right: 1px solid ${props => props.theme.background.secondary};
  }
`;

export const Switcher: React.FC<Props> = ({ items, onChange, selected }) => (
  <Wrapper>
    <Container>
      {items.map((value, key) => (
        <Button
          key={value}
          onClick={() => onChange(value)}
          isActive={selected === key}
          type="button"
          className={selected === key ? 'active' : ''}
        >
          {value}
        </Button>
      ))}
    </Container>
  </Wrapper>
);
