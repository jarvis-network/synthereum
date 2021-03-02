import { ReactNode } from 'react';

export interface InputProps {
  className?: string;
  info?: string;
  label?: string;
  invalid?: boolean;
  invalidMessage?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  value?: string;
  [key: string]: any;
}
