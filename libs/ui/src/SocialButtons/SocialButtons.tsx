import React, { FC, useEffect, useState } from 'react';

import useHover from '../hooks/useHover';
import { styled } from '../Theme';
import { Button } from '../Button';

import { ButtonsMap } from './ButtonsMap';
import {
  LoginButtonType,
  SocialButtonsProps,
  SocialButtonsItemProps,
} from './types';

const Container = styled.div``;

const LabelContainer = styled.div`
  margin: 15px 0;

  > strong {
    color: ${props => props.theme.common.primary};
  }
`;

const IconsContainer = styled.div`
  margin-left: -6px;
  margin-right: -6px;
`;

const IconButtonContainer = styled(Button)`
  font-size: ${props => props.theme.font.sizes.l};
  height: 40px;
  padding: 10px;
  width: 40px;
  background: ${props => props.theme.background.primary};
  border: 1px solid ${props => props.theme.border.primary};
  border-radius: ${props => props.theme.borderRadius.xs};
  margin: 0 6px;

  &:hover {
    background: ${props => props.theme.background.secondary};
  }
`;

export const SocialButtonsItem: FC<SocialButtonsItemProps> = ({
  item,
  onClick,
  onHover,
  onUnhover,
}) => {
  const [ref, isHover] = useHover<HTMLSpanElement>();

  useEffect(() => (isHover ? onHover(item) : onUnhover()), [isHover]);

  return (
    <span ref={ref}>
      {/* @todo Try to pass ref into IconButtonContainer and remove span wrapper */}
      <IconButtonContainer onClick={() => onClick(item)}>
        {ButtonsMap[item].icon}
      </IconButtonContainer>
    </span>
  );
};

export const SocialButtons: FC<SocialButtonsProps> = ({
  buttons,
  onItemSelect,
}) => {
  const [hovered, setHovered] = useState<LoginButtonType | null>(null);

  const resetHovered = () => setHovered(null);

  const items = buttons || (Object.keys(ButtonsMap) as LoginButtonType[]);

  return (
    <Container>
      <LabelContainer>
        Or sign up/in with{' '}
        {hovered && <strong>{ButtonsMap[hovered].label}</strong>}
      </LabelContainer>
      <IconsContainer>
        {items.map(item => (
          <SocialButtonsItem
            key={item}
            item={item}
            onClick={onItemSelect}
            onHover={setHovered}
            onUnhover={resetHovered}
          />
        ))}
      </IconsContainer>
    </Container>
  );
};
