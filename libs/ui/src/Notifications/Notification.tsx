import React, { useEffect, useState } from 'react';

import { styled } from '../Theme';

import { NotificationType, NotificationWithId } from './types';

interface Props extends NotificationWithId {
  onHidden: () => void;
  placement: string;
  className?: string;
}

type STATE = 'before-open' | 'open' | 'close';

interface NotifProps {
  placement: string;
  visible: STATE;
  type: NotificationType;
}

const Notif = styled.div<NotifProps>`
  ${props =>
    props.placement === 'global' ? 'position: fixed;' : 'position: absolute;'}
  transition: transform 300ms ease, opacity 300ms ease;
  z-index: 99;
  left: 50%;
  opacity: ${props => (props.visible === 'open' ? 1 : 0)};
  transform: translateY(${props => (props.visible === 'open' ? 100 : -100)}%)
    translateX(-50%);
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};

  padding: 9px 20px;
  box-shadow: ${props => props.theme.shadow.base};
  display: flex;
  flex-direction: row;
  border-left: 9px solid
    ${props =>
      props.type === NotificationType.pending
        ? '#FECDB1'
        : props.type === NotificationType.success
        ? '#71d2a3'
        : '#feb1b1'};
  border-radius: ${props => props.theme.borderRadius.s};
  width: 80%;
  align-items: center;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    bottom: 100px;
    opacity: 1;
    transition: transform 600ms ease;
    transform: translateX(
      ${props =>
        props.visible === 'before-open'
          ? 100
          : props.visible === 'open'
          ? -50
          : 100}%
    );
  }
`;

const Icon = styled.div`
  margin-right: 20px;
  font-size: 18px;
`;
const Text = styled.div`
  flex: 1;
`;

const iconMap: Record<NotificationType, string> = {
  [NotificationType.pending]: '⏳',
  [NotificationType.success]: '🌈',
  [NotificationType.error]: '❌',
};

export const AnimatedNotification: React.FC<Props> = ({
  onHidden,
  time,
  type,
  text,
  className,
  placement,
}) => {
  const [visible, setVisible] = useState<STATE>('before-open');

  useEffect(() => {
    requestAnimationFrame(() => {
      setVisible('open');
    });
    setTimeout(() => {
      setVisible('close');
    }, time);
  }, []);

  const onAnimEnd = () => {
    if (visible === 'close') {
      onHidden();
    }
  };

  const notifType = typeof type === 'object' ? type.type : type;
  const icon = typeof type === 'object' ? type.icon : iconMap[notifType];

  return (
    <Notif
      visible={visible}
      type={notifType}
      placement={placement}
      onTransitionEnd={onAnimEnd}
      className={className}
    >
      <Icon>{icon}</Icon>
      <Text>{text}</Text>
    </Notif>
  );
};
