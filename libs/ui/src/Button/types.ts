import { ReactNode } from 'react';

export const buttonTypes = [
  'success',
  'primary',
  'dark',
  'danger',
  'transparent',
] as const;

export type ButtonType = typeof buttonTypes[number];

export type ButtonSize = 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | 'xxxl';

export interface ButtonDesignProps {
  rounded?: boolean;
  inverted?: boolean;
  block?: boolean;
  type?: ButtonType;
}

export interface ButtonProps {
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  size?: ButtonSize;
  [key: string]: any;
}

export interface AllButtonProps extends ButtonProps, ButtonDesignProps {}

/**
 * We need to omit "type" here, because type is reserved attribute for button DOM element (type=submit|button)
 * But for back compatibility it better to re-map type propery to buttonType for internal usage
 */
export interface ButtonModifierProps
  extends Pick<
    AllButtonProps,
    'disabled' | 'rounded' | 'inverted' | 'block' | 'size'
  > {
  buttonType?: ButtonType;
}
