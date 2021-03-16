import React, { useEffect, useState } from 'react';

import { AddFn, useNotifications } from './Provider';
import { NotificationType, NotificationWithId } from './types';
import { AnimatedNotification } from './Notification';

interface Props {
  name: string;
  className?: string;
}

const DEFAULT_TIME = 5000;

export const NotificationsPlacement: React.FC<Props> = ({ name, className }) => {
  const [list, setList] = useState<NotificationWithId[]>([]);
  const { registerPlacement } = useNotifications();

  const remove = (id: string) => {
    setList(l => l.filter(stored => stored.id !== id));
  };

  const add: AddFn = (
    text: string,
    type = NotificationType.success,
    time = DEFAULT_TIME,
  ) => {
    setList(l => [
      ...l,
      {
        id: String(Math.random()),
        text,
        type,
        time,
      },
    ]);
  };

  useEffect(() => {
    return registerPlacement(name, add);
  }, [name]);

  const notifs = list.map(n => {
    const rm = () => remove(n.id);
    return (
      <AnimatedNotification
        key={n.id}
        className={className}
        onHidden={rm}
        placement={name}
        {...n}
      />
    );
  });

  return <>{notifs}</>;
};
