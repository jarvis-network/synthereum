import { MouseEvent } from 'react';

export interface AccountButtonProps {
  name?: string;
  wallet: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  image?: string;
}
