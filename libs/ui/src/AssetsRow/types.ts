import { ReactNode } from 'react';

export interface AssetProps {
  name: string;
  flag?: string;
  image?: string;
  value?: number | string;
}

export interface AssetsRowProps {
  isOpen?: boolean;
  from: AssetProps;
  to: AssetProps;
}

export interface AssetsRowExpandProps extends Omit<AssetsRowProps, 'isOpen'> {
  descriptions: {
    label: string | ReactNode;
    value: string | ReactNode;
    tooltip?: string;
  }[];
}
