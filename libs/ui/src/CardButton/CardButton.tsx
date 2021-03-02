import React, { ReactNode } from 'react';

import { styled } from '../Theme';
import { Button } from '../Button';
import { ButtonProps } from '../Button/types';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { flexColumn, flexRow } from '../common/mixins';
import { IconKeys } from '../Icon/Icon';

export interface CardButtonProps extends ButtonProps {
  title: string | ReactNode;
  subtitle?: string;
  leftButtonIcon?: IconKeys;
  leftSection?: ReactNode;
  arrow?: boolean;
  rightSection?: ReactNode;
}

const CardButtonContainer = styled(Button)`
  background: ${props => props.theme.background.primary};
  padding: 25px;
  ${flexRow()}

  .left {
    margin-right: 25px;

    .button.icon {
      max-height: 45px;
      max-width: 45px;
    }
  }

  .content {
    ${flexColumn()}
    font-size: ${props => props.theme.font.sizes.m};
  }

  .title {
    font-weight: bold;
  }

  .right {
    margin-left: 25px;

    .arrow {
      width: 10px;
    }
  }
`;

export const CardButton: React.FC<CardButtonProps> = ({
  className,
  title,
  subtitle,
  leftSection,
  leftButtonIcon,
  arrow,
  rightSection,
  ...props
}) => (
  <CardButtonContainer className={className || ''} {...props}>
    {(leftButtonIcon || leftSection) && (
      <div className="left">
        {leftButtonIcon && <IconButton icon={leftButtonIcon} />}
        {leftSection && leftSection}
      </div>
    )}

    <div className="content">
      <div className="title">{title}</div>
      {subtitle && <span>{subtitle}</span>}
    </div>

    {(arrow || rightSection) && (
      <div className="right">
        {arrow && <Icon className="arrow" icon="IoIosArrowForward" />}
        {rightSection && rightSection}
      </div>
    )}
  </CardButtonContainer>
);
