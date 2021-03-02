import { ReactNode } from 'react';

export enum LoginButton {
  facebook,
  google,
  reddit,
  twitch,
  discord,
  apple,
  github,
  linkedin,
  twitter,
}

export type LoginButtonType = keyof typeof LoginButton;

export type LoginButtonsMap = {
  [key in LoginButtonType]: {
    label: string;
    icon: ReactNode;
  };
};

export interface SocialButtonsProps {
  onItemSelect: (selectedItem: LoginButtonType) => void;
  buttons?: LoginButtonType[]; // use all, if prop not exists
}

export interface SocialButtonsItemProps {
  item: LoginButtonType;
  onClick: (item: LoginButtonType) => void;
  onHover: (item: LoginButtonType) => void;
  onUnhover: () => void;
}
