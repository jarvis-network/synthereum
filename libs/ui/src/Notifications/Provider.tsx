import React, { createContext, useContext, useMemo, useRef } from 'react';

import { NotificationTypeWithOptions } from './types';
import { NotificationsPlacement } from './Placement';

type RegisterPlacement = (name: string, add: AddFn) => () => void;
export type AddFn = (
  text: string,
  type?: NotificationTypeWithOptions,
  time?: number,
) => void;

interface ShowNotificationFn {
  (
    text: string,
    type?: NotificationTypeWithOptions,
    placement?: string,
    time?: number,
  ): void;
  registerPlacement: RegisterPlacement;
}

export const NotificationsContext = createContext<ShowNotificationFn | null>(
  null,
);

export const NotificationsProvider: React.FC = ({ children }) => {
  const placesRef = useRef<Record<string, AddFn>>({});

  const showNotification = useMemo(() => {
    const sn = ((text, type?, placement = 'global', time?) => {
      if (!placesRef.current[placement]) {
        throw new TypeError(`Place named ${placement} is not mounted.`);
      }

      placesRef.current[placement](text, type, time);
    }) as ShowNotificationFn;

    sn.registerPlacement = (name, fn) => {
      // overwrite may happen, it is by purpose, see below
      placesRef.current[name] = fn;

      return () => {
        // check if not overwritten
        // this can actually happen while rendering the frontend (when switching
        // from desktop to mobile) - new instance of the component is mounted
        // before the old one calls the "unmount" callback
        if (placesRef.current[name] === fn) {
          delete placesRef.current[name];
        }
      };
    };

    return sn;
  }, []);

  return (
    <NotificationsContext.Provider value={showNotification}>
      <NotificationsPlacement name="global" />
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): ShowNotificationFn => {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('NotificationsContext not provided');
  return value;
};
