import React, { useState, createContext, useContext } from 'react';

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

export const NotificationsContext = createContext<
  ShowNotificationFn | undefined
>(undefined);

export const NotificationsProvider: React.FC = ({ children }) => {
  const [places, setPlaces] = useState<Record<string, AddFn>>({});

  const showNotification: ShowNotificationFn = (
    text,
    type?,
    placement = 'global',
    time?,
  ) => {
    if (!places[placement]) {
      throw new TypeError(`Place named ${placement} is not mounted.`);
    }

    places[placement](text, type, time);
  };
  showNotification.registerPlacement = (name, fn) => {
    setPlaces(p => {
      // overwrite may happen, it is by purpose, see below
      const newPlaces = { ...p };
      newPlaces[name] = fn;
      return newPlaces;
    });

    return () => {
      setPlaces(p => {
        // check if not overwritten
        // this can actually happen while rendering the frontend (when switching
        // from desktop to mobile) - new instance of the component is mounted
        // before the old one calls the "unmount" callback
        if (p[name] === fn) {
          const newPlaces = { ...p };
          delete newPlaces[name];
          return newPlaces;
        }
        return p;
      });
    };
  };

  return (
    <NotificationsContext.Provider value={showNotification}>
      <NotificationsPlacement name="global" />
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext)!;
