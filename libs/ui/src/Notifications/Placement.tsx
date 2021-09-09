import React, { useEffect, useState } from 'react';
import { uniqueId } from 'lodash';

import { AddFn, useNotifications } from './Provider';
import { NotificationType, Notification } from './types';
import { AnimatedNotification } from './Notification';

interface Props {
  name: string;
  className?: string;
}

const DEFAULT_TIME = 5000;

export function NotificationsPlacement({
  name,
  className,
}: Props): JSX.Element {
  const [list, setList] = useState<Notification[]>([]);
  const { registerPlacement } = useNotifications();

  useEffect(
    () =>
      registerPlacement(name, ((
        text: string,
        type = NotificationType.success,
        time = DEFAULT_TIME,
      ) => {
        setList(l => [
          ...l,
          {
            id: uniqueId(),
            text,
            type,
            time,
          },
        ]);
      }) as AddFn),
    [name, registerPlacement],
  );

  const notifs = list.map(n => (
    <AnimatedNotification
      key={n.id}
      className={className}
      onHidden={() => setList(l => l.filter(stored => stored.id !== n.id))}
      placement={name}
      {...n}
    />
  ));

  return (notifs as unknown) as JSX.Element;
}
